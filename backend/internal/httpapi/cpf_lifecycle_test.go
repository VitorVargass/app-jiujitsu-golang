package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"net/url"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"tatame/backend/internal/billing"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
)

var cpfSequence atomic.Int64

func testCPF() string {
	value := fmt.Sprintf("%09d", 100000000+cpfSequence.Add(1))
	for length := 9; length <= 10; length++ {
		sum := 0
		for i := 0; i < length; i++ {
			sum += int(value[i]-'0') * (length + 1 - i)
		}
		digit := (sum * 10) % 11
		if digit == 10 {
			digit = 0
		}
		value += fmt.Sprint(digit)
	}
	return value
}

func TestCPFArchiveRestoreAndClassDeletion(t *testing.T) {
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
	register := func(name string) client {
		v := base.ok("POST", "/v1/auth/register", map[string]string{"name": name, "email": core.ID() + "@cpf.test", "password": "Tatame123!"})
		return client{t: t, url: server.URL, token: v["token"].(string)}
	}
	admin, outsider, owner := register("Gestor CPF"), register("Gestor isolado"), register("Aluno CPF")
	a := admin.ok("POST", "/v1/academies", map[string]string{"name": "Academia CPF"})["id"].(string)
	other := outsider.ok("POST", "/v1/academies", map[string]string{"name": "Outra CPF"})["id"].(string)
	prefix := "/v1/academies/" + a
	jj := admin.list(prefix + "/modalities")[0]["id"].(string)
	cpf := testCPF()
	formatted := cpf[:3] + "." + cpf[3:6] + "." + cpf[6:9] + "-" + cpf[9:]
	body := map[string]any{"birth_date": "2012-04-12", "name": "Aluno retornando", "cpf": formatted, "status": "active", "modality_ids": []string{jj}, "billing": map[string]any{"enabled": true, "amount_cents": 18000, "due_day": 10, "first_month": time.Now().In(time.FixedZone("BR", -10800)).Format("2006-01"), "payer_name": "Responsável", "payer_document": "52998224725"}}
	invalid := map[string]any{"name": "Sem CPF"}
	if code, _ := admin.request("POST", prefix+"/students", invalid, ""); code != 422 {
		t.Fatal("CPF required", code)
	}
	invalid["cpf"] = "11111111111"
	if code, _ := admin.request("POST", prefix+"/students", invalid, ""); code != 422 {
		t.Fatal("invalid CPF", code)
	}
	student := admin.ok("POST", prefix+"/students", body)
	sid, legacyCode := student["id"].(string), student["student_code"].(string)
	if student["cpf"] != cpf {
		t.Fatal("CPF not normalized")
	}
	if code, _ := admin.request("POST", prefix+"/students", body, ""); code != 409 {
		t.Fatal("duplicate CPF", code)
	}
	outsider.ok("POST", "/v1/academies/"+other+"/students", map[string]any{"birth_date": "2012-04-12", "name": "Mesmo CPF outra academia", "cpf": cpf})
	inv := admin.ok("POST", prefix+"/students/"+sid+"/invitations", nil)
	owner.ok("POST", "/v1/invitations/"+inv["token"].(string)+"/accept", nil)
	credential := owner.ok("GET", prefix+"/me/student-credential", nil)
	qr := credential["qr_token"].(string)
	course := admin.ok("POST", prefix+"/classes", map[string]string{"name": "Turma para excluir", "modality_id": jj})
	cid := course["id"].(string)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	schedule := admin.ok("POST", prefix+"/classes/"+cid+"/schedules", map[string]any{"weekday": int(time.Now().In(loc).Weekday()), "start_time": "19:00", "duration_minutes": 60})
	session := admin.ok("POST", prefix+"/classes/"+cid+"/sessions", map[string]string{"schedule_id": schedule["id"].(string)})
	ssid := session["id"].(string)
	provisioner := register("Gestor tablet")
	// Provisioning exchanges only this manager session for the device credential.
	// Grant an independent admin membership to keep the original manager session usable.
	_, err = db.Exec(ctx, "INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,(SELECT user_id FROM auth_sessions WHERE token_hash=$3),'active',$4,$5)", core.ID(), a, core.Hash(provisioner.token), core.Digits(), core.Token())
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, "INSERT INTO membership_roles(membership_id,role) SELECT id,'admin' FROM memberships WHERE academy_id=$1 AND user_id=(SELECT user_id FROM auth_sessions WHERE token_hash=$2)", a, core.Hash(provisioner.token))
	if err != nil {
		t.Fatal(err)
	}
	deviceData := provisioner.ok("POST", prefix+"/devices", map[string]string{"name": "Tablet CPF"})
	device := client{t: t, url: server.URL, token: deviceData["token"].(string)}
	checkPath := prefix + "/sessions/" + ssid + "/check-ins"
	key := core.ID()
	first := device.okKey(checkPath, map[string]string{"cpf": formatted}, key)
	if repeated := device.okKey(checkPath, map[string]string{"cpf": cpf}, key); repeated["id"] != first["id"] {
		t.Fatal("normalized retry differs")
	}
	if _, exposed := first["cpf"]; exposed {
		t.Fatal("CPF exposed by kiosk")
	}
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for _, identifier := range []map[string]string{{"cpf": cpf}, {"qr_token": qr}} {
		wg.Add(1)
		go func(identifier map[string]string) {
			defer wg.Done()
			code, _ := device.request("POST", checkPath, identifier, core.ID())
			codes <- code
		}(identifier)
	}
	wg.Wait()
	close(codes)
	for code := range codes {
		if code != 200 {
			t.Fatal("concurrent check-in", code)
		}
	}
	var n int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM attendances WHERE academy_id=$1 AND session_id=$2 AND membership_id=$3", a, ssid, sid).Scan(&n); err != nil || n != 1 {
		t.Fatal("duplicate attendance", n, err)
	}
	if code, _ := device.request("POST", checkPath, map[string]string{"cpf": testCPF()}, key); code != 409 {
		t.Fatal("key conflict", code)
	}
	// Legacy code retries retain their original serialized payload hash after adding CPF.
	oldKey := core.ID()
	old := device.okKey(checkPath, map[string]string{"student_code": legacyCode}, oldKey)
	var hash string
	err = db.QueryRow(ctx, "SELECT payload_hash FROM checkin_events WHERE academy_id=$1 AND event_key=$2", a, oldKey).Scan(&hash)
	oldRaw, _ := json.Marshal(struct {
		Session string
		Input   struct {
			QRToken      string `json:"qr_token"`
			StudentCode  string `json:"student_code"`
			MembershipID string `json:"membership_id"`
		}
	}{Session: ssid, Input: struct {
		QRToken      string `json:"qr_token"`
		StudentCode  string `json:"student_code"`
		MembershipID string `json:"membership_id"`
	}{StudentCode: legacyCode}})
	if err != nil || hash != core.Hash(string(oldRaw)) || old["id"] != first["id"] {
		t.Fatal("legacy retry hash changed", err)
	}
	if code, _ := outsider.request("POST", prefix+"/students/"+sid+"/archive", nil, ""); code != 403 {
		t.Fatal("archive tenant authorization", code)
	}
	if code, _ := owner.request("POST", prefix+"/students/"+sid+"/archive", nil, ""); code != 403 {
		t.Fatal("student archiving", code)
	}
	if code, _ := device.request("POST", checkPath, map[string]string{"cpf": testCPF()}, core.ID()); code != 404 {
		t.Fatal("unknown CPF", code)
	}
	if code, _ := device.request("POST", checkPath, map[string]string{"cpf": cpf, "qr_token": qr}, core.ID()); code != 422 {
		t.Fatal("multiple identifiers", code)
	}
	beforeInvoices := admin.ok("GET", prefix+"/invoices?student_id="+sid, nil)["total"]
	archived := admin.ok("POST", prefix+"/students/"+sid+"/archive", nil)
	if archived["archived_at"] == nil || archived["status"] != "inactive" || archived["billing"].(map[string]any)["enabled"] != false {
		t.Fatal("archive state", archived)
	}
	admin.ok("POST", prefix+"/students/"+sid+"/archive", nil)
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = billing.GenerateTx(ctx, tx, a, sid, time.Now().AddDate(2, 0, 0)); err != nil {
		_ = tx.Rollback(ctx)
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if got := admin.ok("GET", prefix+"/invoices?student_id="+sid, nil)["total"]; got != beforeInvoices {
		t.Fatal("archived student generated future debt")
	}
	if total := admin.ok("GET", prefix+"/students", nil)["total"]; total != float64(0) {
		t.Fatal("archived in default list")
	}
	if total := admin.ok("GET", prefix+"/students?status=archived", nil)["total"]; total != float64(1) {
		t.Fatal("missing archived list")
	}
	if total := admin.ok("GET", prefix+"/students?search="+url.QueryEscape(formatted), nil)["total"]; total != float64(1) {
		t.Fatal("exact CPF cannot find archived student")
	}
	if code, _ := device.request("POST", checkPath, map[string]string{"cpf": cpf}, core.ID()); code != 410 {
		t.Fatal("archived check-in accepted", code)
	}
	if code, _ := admin.request("PATCH", prefix+"/students/"+sid, body, ""); code != 409 {
		t.Fatal("patch restored archived student", code)
	}
	if code, _ := admin.request("POST", prefix+"/students", body, ""); code != 409 {
		t.Fatal("duplicate archived CPF", code)
	}
	// Existing account may still read old invoices and attendance while archived.
	owner.ok("GET", prefix+"/me/invoices", nil)
	if len(owner.list(prefix+"/me/attendances")) != 1 {
		t.Fatal("archived student history lost")
	}
	restored := admin.ok("POST", prefix+"/students/"+sid+"/restore", nil)
	if restored["archived_at"] != nil || restored["status"] != "active" || restored["student_code"] != legacyCode || restored["billing"].(map[string]any)["enabled"] != false {
		t.Fatal("restoration changed identity/billing")
	}
	if got := owner.ok("GET", prefix+"/me/student-credential", nil); got["qr_token"] != qr || got["cpf"] != cpf {
		t.Fatal("restored credential changed")
	}
	if got := device.okKey(checkPath, map[string]string{"cpf": cpf}, core.ID()); got["id"] != first["id"] {
		t.Fatal("restored attendance duplicated")
	}
	if got := admin.ok("GET", prefix+"/invoices?student_id="+sid, nil)["total"]; got != beforeInvoices {
		t.Fatal("archive/restore generated debt")
	}
	// Omitted CPF in an older PATCH preserves it.
	delete(body, "cpf")
	body["billing"].(map[string]any)["enabled"] = false
	if got := admin.ok("PATCH", prefix+"/students/"+sid, body)["cpf"]; got != cpf {
		t.Fatal("legacy edit cleared CPF")
	}
	body["cpf"] = ""
	if code, _ := admin.request("PATCH", prefix+"/students/"+sid, body, ""); code != 422 {
		t.Fatal("CPF cleared", code)
	}
	delete(body, "cpf")
	body["billing"].(map[string]any)["enabled"] = true
	admin.ok("PATCH", prefix+"/students/"+sid, body)
	if current := admin.ok("POST", prefix+"/students/"+sid+"/restore", nil); current["billing"].(map[string]any)["enabled"] != true {
		t.Fatal("idempotent restore disabled an active contract")
	}
	if code, _ := owner.request("DELETE", prefix+"/classes/"+cid, nil, ""); code != 403 {
		t.Fatal("student deleting class", code)
	}
	if code, _ := outsider.request("DELETE", prefix+"/classes/"+cid, nil, ""); code != 403 {
		t.Fatal("class tenant authorization", code)
	}
	admin.ok("DELETE", prefix+"/classes/"+cid, nil)
	admin.ok("DELETE", prefix+"/classes/"+cid, nil)
	if len(admin.list(prefix+"/classes")) != 0 {
		t.Fatal("deleted class in list")
	}
	if len(device.list(prefix+"/sessions")) != 0 {
		t.Fatal("deleted class still open on kiosk")
	}
	if code, _ := admin.request("POST", prefix+"/classes/"+cid+"/sessions", map[string]string{"schedule_id": schedule["id"].(string)}, ""); code != 404 {
		t.Fatal("deleted class reopened", code)
	}
	if code, _ := admin.request("PATCH", prefix+"/classes/"+cid, map[string]any{"active": true}, ""); code != 404 {
		t.Fatal("deleted class reactivated", code)
	}
	if code, _ := admin.request("POST", prefix+"/classes/"+cid+"/schedules", map[string]any{"weekday": 1, "start_time": "18:00", "duration_minutes": 60}, ""); code != 404 {
		t.Fatal("schedule added to deleted class", code)
	}
	if code, _ := device.request("POST", checkPath, map[string]string{"cpf": cpf}, core.ID()); code != 404 {
		t.Fatal("deleted class check-in", code)
	}
	if len(admin.list(prefix+"/sessions/"+ssid+"/attendances")) != 1 {
		t.Fatal("deleted class history lost")
	}
	if got := device.okKey(checkPath, map[string]string{"cpf": cpf}, key)["id"]; got != first["id"] {
		t.Fatal("successful retry lost after class deletion")
	}
}

// okKey exercises the public HTTP check-in endpoint with an explicit retry key.
func (c client) okKey(path string, body any, key string) map[string]any {
	c.t.Helper()
	code, result := c.request("POST", path, body, key)
	if code != 200 {
		c.t.Fatalf("POST %s: %d %v", path, code, result)
	}
	return result
}
