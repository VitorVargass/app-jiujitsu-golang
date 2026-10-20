package httpapi_test

import (
	"context"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"tatame/backend/internal/attendance"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
)

func TestScheduledAttendanceAndManualEntry(t *testing.T) {
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
	password := "Tatame123!"
	register := func(email string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": "Pessoa teste", "email": email, "password": password})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	email := core.ID() + "@attendance.test"
	admin := register(email)
	outsider := register(core.ID() + "@attendance.test")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Agenda automática"})["id"].(string)
	prefix := "/v1/academies/" + a
	mod := admin.list(prefix + "/modalities")[0]["id"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	today := now.Format("2006-01-02")
	createClass := func(name string, day time.Time, at string) map[string]any {
		return admin.ok("POST", prefix+"/classes", map[string]any{"name": name, "modality_id": mod, "schedules": []any{map[string]any{"weekday": int(day.Weekday()), "start_time": at, "duration_minutes": 60}}})
	}
	schedule := func(c map[string]any) string { return c["schedules"].([]any)[0].(map[string]any)["id"].(string) }
	first := createClass("Treino pelo horário", now, now.Format("15:04"))
	firstSchedule := schedule(first)
	student := func() map[string]any {
		return admin.ok("POST", prefix+"/students", map[string]any{"name": "Aluno para presença", "email": core.ID() + "@attendance.test", "cpf": testCPF(), "birth_date": "1990-01-01", "status": "active"})
	}
	st := student()
	st2 := student()
	device := func() client {
		v := base.ok("POST", "/v1/auth/login", map[string]string{"email": email, "password": password})
		issuer := client{t: t, url: server.URL, token: v["token"].(string)}
		d := issuer.ok("POST", prefix+"/devices", map[string]string{"name": "Tatame de teste"})
		return client{t: t, url: server.URL, token: d["token"].(string)}
	}
	kiosk, other := device(), device()
	options := kiosk.ok("GET", prefix+"/attendance-options", nil)["options"].([]any)
	if len(options) != 1 || options[0].(map[string]any)["session_id"] != nil {
		t.Fatal("schedule needs a manually opened session", options)
	}
	if code, _ := admin.request("POST", prefix+"/check-ins", map[string]string{"cpf": st["cpf"].(string)}, core.ID()); code != 403 {
		t.Fatal("personal session used tablet endpoint", code)
	}
	if code, _ := kiosk.request("POST", prefix+"/attendances", map[string]string{"student_id": st["id"].(string), "schedule_id": firstSchedule, "date": today}, core.ID()); code != 403 {
		t.Fatal("tablet forged manual entry", code)
	}
	if code, _ := kiosk.request("GET", prefix+"/attendance-options?date="+today, nil, ""); code != 422 {
		t.Fatal("tablet accepted chosen date", code)
	}
	if code, _ := kiosk.request("POST", prefix+"/check-ins", map[string]string{"cpf": testCPF()}, core.ID()); code != 404 {
		t.Fatal("unknown student", code)
	}
	var n int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM class_sessions WHERE academy_id=$1", a).Scan(&n); err != nil || n != 0 {
		t.Fatal("failed check-in left an occurrence", err, n)
	}
	key := core.ID()
	input := map[string]string{"cpf": st["cpf"].(string)}
	result := kiosk.okKey(prefix+"/check-ins", input, key)
	if result["class_name"] != "Treino pelo horário" || result["source"] != "tablet" {
		t.Fatal("automatic class identification", result)
	}
	id, session := result["id"], result["session_id"].(string)
	if got := other.okKey(prefix+"/check-ins", input, core.ID()); got["id"] != id || got["duplicate"] != true {
		t.Fatal("two tablets duplicated presence")
	}
	if code, _ := kiosk.request("POST", prefix+"/check-ins", map[string]string{"cpf": st2["cpf"].(string)}, key); code != 409 {
		t.Fatal("key reused with another person", code)
	}
	admin.ok("PATCH", prefix+"/sessions/"+session, map[string]string{"status": "closed"})
	if got := kiosk.okKey(prefix+"/check-ins", input, key); got["id"] != id {
		t.Fatal("lost response retry after close was not recovered")
	}
	if code, _ := kiosk.request("POST", prefix+"/check-ins", input, core.ID()); code != 409 {
		t.Fatal("closed occurrence accepted new tablet event", code)
	}
	manual := admin.okKey(prefix+"/attendances", map[string]string{"student_id": st["id"].(string), "schedule_id": firstSchedule, "date": today}, core.ID())
	if manual["id"] != id || manual["source"] != "tablet" {
		t.Fatal("manual duplicate replaced original provenance")
	}
	// Closing one dated occurrence never expires its weekly class or schedule.
	for _, weeks := range []int{1, 2, 52, 520} {
		next := now.AddDate(0, 0, 7*weeks)
		recurrent, err := (attendance.Repository{DB: db}).Options(ctx, a, "", true, next)
		if err != nil || len(recurrent.Options) != 1 {
			t.Fatalf("weekly class missing after %d weeks: %v %+v", weeks, err, recurrent)
		}
		lesson := recurrent.Options[0]
		if lesson.ScheduleID != firstSchedule || lesson.ClassID != first["id"] || lesson.SessionID != "" || lesson.Date != next.Format("2006-01-02") {
			t.Fatalf("weekly schedule was replaced or reused a closed occurrence: %+v", lesson)
		}
	}
	// A past class counts in its training month, while checked_in_at remains the real audit timestamp.
	past := now.AddDate(0, 0, -35)
	pastClass := createClass("Aula anterior", past, "12:00")
	pastSchedule := schedule(pastClass)
	manualBody := map[string]string{"student_id": st2["id"].(string), "schedule_id": pastSchedule, "date": past.Format("2006-01-02")}
	manualKey := core.ID()
	record := admin.okKey(prefix+"/attendances", manualBody, manualKey)
	if record["source"] != "manager" {
		t.Fatal("manual provenance")
	}
	when, e := time.Parse(time.RFC3339Nano, record["checked_in_at"].(string))
	if e != nil || time.Since(when) > time.Minute {
		t.Fatal("manual entry backdated audit time")
	}
	if got := admin.okKey(prefix+"/attendances", manualBody, manualKey); got["id"] != record["id"] {
		t.Fatal("manual retry duplicated")
	}
	h := admin.ok("GET", prefix+"/attendances?student_id="+st2["id"].(string)+"&month="+past.Format("2006-01")+"&page=1", nil)
	if h["total"] != float64(1) || h["items"].([]any)[0].(map[string]any)["source"] != "manager" {
		t.Fatal("history month/provenance wrong", h)
	}
	dash := admin.ok("GET", prefix+"/dashboard", nil)
	if dash["presences_today"] != float64(1) {
		t.Fatal("past manual entry inflated today", dash)
	}
	if code, _ := outsider.request("POST", prefix+"/attendances", manualBody, core.ID()); code != 403 {
		t.Fatal("other academy manager wrote attendance", code)
	}
	future := now.AddDate(0, 0, 7)
	if code, _ := admin.request("POST", prefix+"/attendances", map[string]string{"student_id": st2["id"].(string), "schedule_id": firstSchedule, "date": future.Format("2006-01-02")}, core.ID()); code != 422 {
		t.Fatal("future manual attendance", code)
	}
	// Overlap requires explicit selection, never chooses the first entry silently.
	second := createClass("Segunda aula simultânea", now, now.Format("15:04"))
	third := createClass("Terceira aula simultânea", now, now.Format("15:04"))
	if code, _ := kiosk.request("POST", prefix+"/check-ins", input, core.ID()); code != 409 {
		t.Fatal("ambiguous class selected automatically", code)
	}
	choice := map[string]string{"cpf": st2["cpf"].(string), "schedule_id": schedule(second), "date": today}
	var wg sync.WaitGroup
	responses := make(chan map[string]any, 2)
	for _, d := range []client{kiosk, other} {
		wg.Add(1)
		go func(d client) { defer wg.Done(); responses <- d.okKey(prefix+"/check-ins", choice, core.ID()) }(d)
	}
	wg.Wait()
	close(responses)
	var same any
	for v := range responses {
		if same == nil {
			same = v["id"]
		} else if same != v["id"] {
			t.Fatal("concurrent automatic check-ins duplicated")
		}
	}
	selectedSession := kiosk.okKey(prefix+"/check-ins", choice, core.ID())["session_id"].(string)
	admin.ok("PATCH", prefix+"/sessions/"+selectedSession, map[string]string{"status": "cancelled"})
	if code, _ := kiosk.request("POST", prefix+"/check-ins", choice, core.ID()); code != 409 {
		t.Fatal("cancelled class accepted", code)
	}
	admin.ok("POST", prefix+"/students/"+st2["id"].(string)+"/archive", nil)
	blocked := map[string]string{"cpf": st2["cpf"].(string), "schedule_id": schedule(third), "date": today}
	if code, _ := kiosk.request("POST", prefix+"/check-ins", blocked, core.ID()); code != 410 {
		t.Fatal("archived student accepted", code)
	}
	// A class that started yesterday remains available after midnight in academy time.
	b := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Virada do dia"})["id"].(string)
	bmod := outsider.list("/v1/academies/" + b + "/modalities")[0]["id"].(string)
	midnight := time.Date(2026, 10, 20, 0, 10, 0, 0, loc)
	outsider.ok("POST", "/v1/academies/"+b+"/classes", map[string]any{"name": "Treino noturno", "modality_id": bmod, "schedules": []any{map[string]any{"weekday": int(midnight.AddDate(0, 0, -1).Weekday()), "start_time": "23:30", "duration_minutes": 90}}})
	overnight, e := (attendance.Repository{DB: db}).Options(ctx, b, "", true, midnight)
	if e != nil || len(overnight.Options) != 1 || overnight.Options[0].Date != "2026-10-19" {
		t.Fatal("cross-midnight schedule not found", e, overnight)
	}
	for _, d := range admin.list(prefix + "/devices") {
		admin.ok("DELETE", prefix+"/devices/"+d["id"].(string), nil)
	}
	if code, _ := kiosk.request("POST", prefix+"/check-ins", input, key); code != 401 {
		t.Fatal("revoked device recovered a stored result", code)
	}
}
