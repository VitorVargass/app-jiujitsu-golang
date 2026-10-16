package database

import (
	"database/sql"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/pressly/goose/v3"
)

// Use a restored copy, never the application database.
func TestRestoredCopyMigration(t *testing.T) {
	address := os.Getenv("MIGRATION_COPY_DATABASE_URL")
	if address == "" {
		t.Skip("restored dedicated copy required")
	}
	parsed, err := url.Parse(address)
	if err != nil || !strings.Contains(parsed.Path, "_migration_copy_") {
		t.Fatal("MIGRATION_COPY_DATABASE_URL must identify a dedicated _migration_copy_ database")
	}
	db, err := sql.Open("pgx", address)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	queries := map[string]string{
		"users":       "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM users t",
		"academies":   "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM academies t",
		"students":    "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t)-'birth_date' ORDER BY id)::text,'[]')) FROM students t",
		"birth_dates": "SELECT md5(COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'birth',COALESCE(to_jsonb(t)->>'birth_date','')) ORDER BY id)::text,'[]')) FROM students t",
		"modalities":  "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM modalities t",
		"enrollments": "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY academy_id,student_id,modality_id)::text,'[]')) FROM student_modalities t",
		"classes":     "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM classes t",
		"schedules":   "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t)-'deleted_at' ORDER BY id)::text,'[]')) FROM class_schedules t",
		"sessions":    "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM class_sessions t",
		"plans":       "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM plans t",
		"billing":     "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY academy_id,student_id)::text,'[]')) FROM student_billing t",
		"invoices":    "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM invoices t",
		"attendances": "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM attendances t",
		"memberships": "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM memberships t",
	}
	before := map[string]string{}
	for name, q := range queries {
		var signature string
		if err = db.QueryRow(q).Scan(&signature); err != nil {
			t.Fatal(name, err)
		}
		before[name] = signature
	}
	if err = Migrate(address); err != nil {
		t.Fatal(err)
	}
	for name, q := range queries {
		var after string
		if err = db.QueryRow(q).Scan(&after); err != nil {
			t.Fatal(name, err)
		}
		if before[name] != after {
			t.Fatal("existing data changed during migration:", name)
		}
	}
	var indexed bool
	if err = db.QueryRow("SELECT to_regclass('attendances_student_history') IS NOT NULL").Scan(&indexed); err != nil || !indexed {
		t.Fatal("student history index missing", err)
	}
	version, err := goose.GetDBVersion(db)
	if err != nil || version < 7 {
		t.Fatal("migration 007 missing", err)
	}
}
