package database

import (
	"database/sql"
	"encoding/json"
	"github.com/pressly/goose/v3"
	"os"
	"strings"
	"tatame/backend/internal/core"
	"testing"
)

func TestIdentityMigrationRequiresReviewedLink(t *testing.T) {
	address := os.Getenv("IDENTITY_CONFLICT_DATABASE_URL")
	if address == "" {
		t.Skip("fresh dedicated conflict database required")
	}
	db, err := sql.Open("pgx", address)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	goose.SetBaseFS(migrations)
	if err = goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	if err = goose.UpTo(db, "migrations", 7); err != nil {
		t.Fatal(err)
	}
	user, academy, student := core.ID(), core.ID(), core.ID()
	email := core.ID() + "@legacy.test"
	qr := core.Token()
	token := core.Hash(core.Token())
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{"INSERT INTO users(id,name,email,password_hash) VALUES($1,'Gestor legado',$2,'preserve-hash')", []any{user, email}},
		{"INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')", []any{token, user}},
		{"INSERT INTO academies(id,name,code) VALUES($1,'Legada',$2)", []any{academy, core.Token()}},
		{"INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)", []any{core.ID(), academy, user, core.Digits(), core.Token()}},
		{"INSERT INTO students(id,academy_id,name,email,cpf,student_code,qr_token) VALUES($1,$2,'Gestor aluno',$3,'52998224725','12345678',$4)", []any{student, academy, email, qr}},
	} {
		if _, err = db.Exec(q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("IDENTITY_MERGE_APPROVALS", "")
	if err = Migrate(address); err == nil || !strings.Contains(err.Error(), "identity_migration_conflict") {
		t.Fatal("unreviewed identities were merged", err)
	}
	var version int64
	version, err = goose.GetDBVersion(db)
	if err != nil || version != 7 {
		t.Fatal("failed migration not rolled back", err)
	}
	var stillThere bool
	if err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='email')").Scan(&stillThere); err != nil || !stillThere {
		t.Fatal("partial schema survived", err)
	}
	approved, _ := json.Marshal(map[string]string{student: user})
	t.Setenv("IDENTITY_MERGE_APPROVALS", string(approved))
	if err = Migrate(address); err != nil {
		t.Fatal(err)
	}
	var linked, part, savedQR, hash string
	if err = db.QueryRow("SELECT s.user_id,s.participant_id,p.qr_token FROM students s JOIN academy_participants p ON p.id=s.participant_id WHERE s.id=$1", student).Scan(&linked, &part, &savedQR); err != nil || linked != user || part != student || savedQR != qr {
		t.Fatal("reviewed migration lost link or credential", err)
	}
	if err = db.QueryRow("SELECT u.password_hash FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=$1", token).Scan(&hash); err != nil || hash != "preserve-hash" {
		t.Fatal("account or session changed", err)
	}
}
