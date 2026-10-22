package database

import (
	"database/sql"
	"github.com/pressly/goose/v3"
	"net/url"
	"os"
	"strings"
	"testing"
)

func TestRestoredCopyMigration(t *testing.T) {
	address := os.Getenv("MIGRATION_COPY_DATABASE_URL")
	if address == "" {
		t.Skip("restored dedicated copy required")
	}
	parsed, err := url.Parse(address)
	if err != nil || !strings.Contains(parsed.Path, "_migration_copy_") {
		t.Fatal("dedicated copy database required")
	}
	db, err := sql.Open("pgx", address)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if approvals := os.Getenv("MIGRATION_COPY_APPROVALS"); approvals != "" {
		t.Setenv("IDENTITY_MERGE_APPROVALS", approvals)
	}
	version, err := goose.GetDBVersion(db)
	if err != nil || version != 7 {
		t.Fatal("restore must start at schema 007", err, version)
	}
	stable := map[string]string{
		"users":          "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t)-'email'-'person_id' ORDER BY id)::text,'[]')) FROM users t",
		"students":       "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t)-'email'-'cpf'-'student_code'-'qr_token'-'user_id'-'person_id'-'participant_id' ORDER BY id)::text,'[]')) FROM students t",
		"academies":      "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM academies t",
		"modalities":     "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM modalities t",
		"enrollments":    "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY academy_id,student_id,modality_id)::text,'[]')) FROM student_modalities t",
		"classes":        "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM classes t",
		"schedules":      "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM class_schedules t",
		"sessions":       "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM class_sessions t",
		"plans":          "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM plans t",
		"billing":        "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY academy_id,student_id)::text,'[]')) FROM student_billing t",
		"invoices":       "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM invoices t",
		"memberships":    "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t)-'student_code' ORDER BY id)::text,'[]')) FROM memberships t",
		"auth_sessions":  "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY token_hash)::text,'[]')) FROM auth_sessions t",
		"devices":        "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM devices t",
		"checkin_events": "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY academy_id,principal_id,event_key)::text,'[]')) FROM checkin_events t",
	}
	beforeQueries := map[string]string{}
	afterQueries := map[string]string{}
	for name, q := range stable {
		beforeQueries[name] = q
		afterQueries[name] = q
	}
	afterQueries["invoices"] = strings.ReplaceAll(afterQueries["invoices"], "to_jsonb(t)", "(to_jsonb(t)-'discount_cents'-'discount_reason'-'payment_method')")
	afterQueries["students"] = strings.ReplaceAll(afterQueries["students"], "to_jsonb(t)-'email'", "to_jsonb(t)-'started_on'-'activity_tracking_started_at'-'email'")
	beforeQueries["user_emails"] = "SELECT md5(COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'email',lower(btrim(u.email))) ORDER BY u.id)::text,'[]')) FROM users u"
	afterQueries["user_emails"] = "SELECT md5(COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'email',p.email) ORDER BY u.id)::text,'[]')) FROM users u JOIN people p ON p.id=u.person_id"
	beforeQueries["student_credentials"] = "SELECT md5(COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'cpf',s.cpf,'qr',s.qr_token) ORDER BY s.id)::text,'[]')) FROM students s"
	afterQueries["student_credentials"] = "SELECT md5(COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'cpf',p.cpf,'qr',p.qr_token) ORDER BY s.id)::text,'[]')) FROM students s JOIN academy_participants p ON p.academy_id=s.academy_id AND p.id=s.participant_id"
	beforeQueries["attendances"] = "SELECT md5(COALESCE(jsonb_agg((to_jsonb(t)-'membership_id')||jsonb_build_object('participant_id',t.membership_id) ORDER BY id)::text,'[]')) FROM attendances t"
	afterQueries["attendances"] = "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM attendances t"
	before := map[string]string{}
	for name, q := range beforeQueries {
		var value string
		if err = db.QueryRow(q).Scan(&value); err != nil {
			t.Fatal(name, err)
		}
		before[name] = value
	}
	if err = Migrate(address); err != nil {
		t.Fatal(err)
	}
	for name, q := range afterQueries {
		var value string
		if err = db.QueryRow(q).Scan(&value); err != nil {
			t.Fatal(name, err)
		}
		if value != before[name] {
			t.Fatal("existing data changed:", name)
		}
	}
	var columns int
	if err = db.QueryRow("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='email'").Scan(&columns); err != nil || columns != 1 {
		t.Fatal("email is not canonical", err)
	}
	var indexed bool
	if err = db.QueryRow("SELECT to_regclass('attendances_participant_history') IS NOT NULL").Scan(&indexed); err != nil || !indexed {
		t.Fatal("participant history index missing", err)
	}
	version, err = goose.GetDBVersion(db)
	if err != nil || version != 12 {
		t.Fatal("migration 008 missing", version, err)
	}
}
