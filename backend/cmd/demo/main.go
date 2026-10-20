// demo inspects the local database and can populate one explicitly selected academy.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"tatame/backend/internal/config"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/demodata"
)

func main() {
	academy := flag.String("academy", "", "ID da academia existente")
	apply := flag.Bool("apply", false, "Gravar os exemplos fictícios")
	backup := flag.String("backup", "", "Arquivo .dump novo, obrigatório para gravar")
	pgdump := flag.String("pg-dump", "pg_dump", "Caminho do pg_dump")
	flag.Parse()
	cfg, err := config.Load()
	must(err)
	parsed, err := url.Parse(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Conexão local inválida")
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "localhost" && host != "127.0.0.1" && host != "::1" {
		log.Fatal("Esta ferramenta é limitada ao PostgreSQL local")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Não foi possível conectar ao PostgreSQL local; confirme se o serviço está iniciado.")
	}
	defer db.Close()
	var version int64
	if err = db.QueryRow(ctx, "SELECT COALESCE(max(version_id) FILTER (WHERE is_applied),0) FROM goose_db_version").Scan(&version); err != nil {
		log.Fatal("Não foi possível conferir a versão do banco")
	}
	if version < 11 {
		log.Fatal("Atualize a API e o banco até a migração 011 antes de criar os exemplos.")
	}
	if !*apply {
		rows, err := db.Query(ctx, `SELECT a.id,a.name,a.timezone,(SELECT count(*) FROM students WHERE academy_id=a.id),(SELECT count(*) FROM classes WHERE academy_id=a.id AND deleted_at IS NULL),(SELECT count(*) FROM invoices WHERE academy_id=a.id),(SELECT string_agg(u.name,', ' ORDER BY u.name) FROM memberships m JOIN membership_roles r ON r.membership_id=m.id JOIN users u ON u.id=m.user_id WHERE m.academy_id=a.id AND r.role='admin' AND m.status='active') FROM academies a ORDER BY a.created_at`)
		must(err)
		defer rows.Close()
		all := []map[string]any{}
		for rows.Next() {
			var id, name, zone string
			var owner *string
			var students, classes, invoices int64
			must(rows.Scan(&id, &name, &zone, &students, &classes, &invoices, &owner))
			all = append(all, map[string]any{"id": id, "name": name, "timezone": zone, "students": students, "classes": classes, "invoices": invoices, "managers": owner})
		}
		must(rows.Err())
		printJSON(map[string]any{"database": strings.TrimPrefix(parsed.Path, "/"), "schema": version, "academies": all, "preview": "Sem -apply, nenhum dado é alterado. O conjunto inclui 18 alunos Demo e usa os horários existentes."})
		return
	}
	if !core.ValidID(*academy) || *backup == "" {
		log.Fatal("Informe -academy e um arquivo -backup novo antes de usar -apply.")
	}
	var actor string
	if err = db.QueryRow(ctx, "SELECT m.user_id FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.academy_id=$1 AND r.role='admin' AND m.status='active' ORDER BY m.id LIMIT 1", *academy).Scan(&actor); err != nil {
		log.Fatal("Academia ou gestor ativo não encontrado")
	}
	must(saveBackup(ctx, parsed, *pgdump, *backup))
	result, err := demodata.Seed(ctx, db, *academy, actor, time.Now())
	must(err)
	printJSON(map[string]any{"result": result, "backup": *backup, "note": "Dados fictícios identificados por Demo. Nenhuma chamada ao Asaas ou envio de mensagem."})
}
func saveBackup(ctx context.Context, address *url.URL, binary, path string) error {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	if strings.ToLower(filepath.Ext(absolute)) != ".dump" {
		return errors.New("o backup deve usar extensão .dump")
	}
	if err = os.MkdirAll(filepath.Dir(absolute), 0700); err != nil {
		return err
	}
	file, err := os.OpenFile(absolute, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return errors.New("o backup precisa ser um arquivo novo e gravável")
	}
	defer file.Close()
	port := address.Port()
	if port == "" {
		port = "5432"
	}
	password, _ := address.User.Password()
	command := exec.CommandContext(ctx, binary, "--format=custom", "--no-owner", "--no-privileges")
	command.Env = append(os.Environ(), "PGHOST="+address.Hostname(), "PGPORT="+port, "PGDATABASE="+strings.TrimPrefix(address.Path, "/"), "PGUSER="+address.User.Username(), "PGPASSWORD="+password, "PGSSLMODE="+address.Query().Get("sslmode"))
	command.Stdout = file
	if err = command.Run(); err != nil {
		return errors.New("backup falhou; nenhum dado de demonstração foi gravado")
	}
	return file.Sync()
}
func printJSON(value any) {
	encoded, err := json.MarshalIndent(value, "", "  ")
	must(err)
	fmt.Println(string(encoded))
}
func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
