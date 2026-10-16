package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"tatame/backend/internal/classes"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
)

func TestWeeklyClassCreationEditingAndHistory(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	if err := database.Migrate(address); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	db, err := database.Open(ctx, address)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	server := httptest.NewServer(httpapi.New(db, ""))
	defer server.Close()
	base := client{t: t, url: server.URL}
	email := core.ID() + "@weekly.test"
	account := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Gestor Agenda", "email": email, "password": "Tatame123!"})
	admin := client{t: t, url: server.URL, token: account["token"].(string)}
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia Agenda"})["id"].(string)
	prefix := "/v1/academies/" + a
	modality := admin.list(prefix + "/modalities")[0]["id"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	today := int(time.Now().In(loc).Weekday())
	weekly := []classes.ScheduleInput{}
	for _, day := range []int{today, (today + 2) % 7, (today + 4) % 7} {
		for _, at := range []string{"19:00", "20:00"} {
			weekly = append(weekly, classes.ScheduleInput{Weekday: day, StartTime: at, Duration: 60})
		}
	}
	body := map[string]any{"name": "Jiu-Jitsu semana completa", "modality_id": modality, "schedules": weekly}
	course := admin.ok("POST", prefix+"/classes", body)
	cid := course["id"].(string)
	if len(course["schedules"].([]any)) != 6 {
		t.Fatal("atomic response missing weekly schedules")
	}
	all := admin.list(prefix + "/classes")
	if len(all) != 1 || len(all[0]["schedules"].([]any)) != 6 {
		t.Fatal("class list missing embedded schedules")
	}
	slots := admin.list(prefix + "/classes/" + cid + "/schedules")
	ids := map[string]string{}
	for _, s := range slots {
		ids[s["start_time"].(string)+"/"+string(rune('0'+int(s["weekday"].(float64))))] = s["id"].(string)
	}
	oldID := ids["19:00:00/"+string(rune('0'+today))]
	if oldID == "" {
		t.Fatal("missing today's schedule")
	}
	session := admin.ok("POST", prefix+"/classes/"+cid+"/sessions", map[string]string{"schedule_id": oldID})
	sid := session["id"].(string)
	cpf := testCPF()
	student := admin.ok("POST", prefix+"/students", map[string]any{"birth_date": "2012-04-12", "name": "Aluno Agenda", "cpf": cpf})
	provisionerData := base.ok("POST", "/v1/auth/login", map[string]string{"email": email, "password": "Tatame123!"})
	provisioner := client{t: t, url: server.URL, token: provisionerData["token"].(string)}
	deviceData := provisioner.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet Agenda"})
	device := client{t: t, url: server.URL, token: deviceData["token"].(string)}
	checkPath := prefix + "/sessions/" + sid + "/check-ins"
	presence := device.okKey(checkPath, map[string]string{"cpf": cpf}, core.ID())
	// Remove a weekly slot whose class session already has attendance.
	updated := []classes.ScheduleInput{}
	for _, s := range weekly {
		if !(s.Weekday == today && s.StartTime == "19:00") {
			updated = append(updated, s)
		}
	}
	body["schedules"] = updated
	body["name"] = "Agenda atualizada"
	changed := admin.ok("PATCH", prefix+"/classes/"+cid, body)
	if changed["name"] != "Agenda atualizada" || len(changed["schedules"].([]any)) != 5 {
		t.Fatal("batch edit failed")
	}
	for _, s := range admin.list(prefix + "/classes/" + cid + "/schedules") {
		key := s["start_time"].(string) + "/" + string(rune('0'+int(s["weekday"].(float64))))
		if s["id"] != ids[key] {
			t.Fatal("unchanged slot changed identity")
		}
	}
	if code, _ := admin.request("POST", prefix+"/classes/"+cid+"/sessions", map[string]string{"schedule_id": oldID}, ""); code != 404 {
		t.Fatal("removed weekly slot opened", code)
	}
	if history := admin.list(prefix + "/sessions/" + sid + "/attendances"); len(history) != 1 || history[0]["student_name"] != student["name"] {
		t.Fatal("weekly edit lost history")
	}
	if got := device.okKey(checkPath, map[string]string{"cpf": cpf}, core.ID()); got["id"] != presence["id"] {
		t.Fatal("open class changed after weekly edit")
	}
	// Old API clients may still update a class without sending schedules.
	admin.ok("PATCH", prefix+"/classes/"+cid, map[string]any{"active": false})
	if len(admin.list(prefix+"/classes/"+cid+"/schedules")) != 5 {
		t.Fatal("legacy PATCH cleared weekly slots")
	}
	// Invalid batch cannot partially change metadata or the weekly calendar.
	for _, invalid := range []any{[]classes.ScheduleInput{}, append(updated, updated[0]), []classes.ScheduleInput{{Weekday: 9, StartTime: "19:00", Duration: 60}}, []classes.ScheduleInput{{Weekday: 1, StartTime: "25:00", Duration: 60}}} {
		if code, _ := admin.request("PATCH", prefix+"/classes/"+cid, map[string]any{"name": "must not save", "schedules": invalid}, ""); code != 422 {
			t.Fatal("invalid batch accepted", code)
		}
	}
	after := admin.list(prefix + "/classes")[0]
	if after["name"] != "Agenda atualizada" || len(after["schedules"].([]any)) != 5 {
		t.Fatal("invalid batch partially saved")
	}
	// Reactivating a removed natural slot preserves the original schedule/session identity.
	restored := admin.ok("POST", prefix+"/classes/"+cid+"/schedules", map[string]any{"weekday": today, "start_time": "19:00", "duration_minutes": 90})
	if restored["id"] != oldID {
		t.Fatal("legacy add cannot restore removed slot")
	}
	if code, _ := admin.request("POST", prefix+"/classes/"+cid+"/schedules", map[string]any{"weekday": today, "start_time": "19:00", "duration_minutes": 90}, ""); code != 409 {
		t.Fatal("duplicate individual slot", code)
	}
	// Force a database failure after the class insert: both inserts must roll back.
	bad := []classes.ScheduleInput{{Weekday: 1, StartTime: "17:00", Duration: 60}, {Weekday: 9, StartTime: "18:00", Duration: 60}}
	_, err = (classes.Repository{DB: db}).CreateClass(ctx, a, classes.ClassInput{Name: "Rollback agenda", ModalityID: modality, Schedules: &bad})
	if err == nil {
		t.Fatal("expected constraint failure")
	}
	var count int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM classes WHERE academy_id=$1 AND name='Rollback agenda'", a).Scan(&count); err != nil || count != 0 {
		t.Fatal("orphan class after failed batch", count, err)
	}
	_, err = (classes.Repository{DB: db}).UpdateClass(ctx, a, cid, classes.ClassInput{Name: "Rollback metadata", Schedules: &bad})
	if err == nil {
		t.Fatal("expected batch edit constraint failure")
	}
	if current := admin.list(prefix + "/classes")[0]; current["name"] != "Agenda atualizada" || len(current["schedules"].([]any)) != 6 {
		t.Fatal("failed edit partially saved metadata or calendar")
	}
	outsiderAccount := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Outro Gestor", "email": core.ID() + "@weekly.test", "password": "Tatame123!"})
	outsider := client{t: t, url: server.URL, token: outsiderAccount["token"].(string)}
	if code, _ := outsider.request("PATCH", prefix+"/classes/"+cid, body, ""); code != 403 {
		t.Fatal("cross academy edit", code)
	}
	// Repeated saves of the same calendar preserve slot identities and do not duplicate rows.
	body["schedules"] = weekly
	admin.ok("PATCH", prefix+"/classes/"+cid, body)
	admin.ok("PATCH", prefix+"/classes/"+cid, body)
	if len(admin.list(prefix+"/classes/"+cid+"/schedules")) != 6 {
		t.Fatal("repeated save duplicated slots")
	}
}
