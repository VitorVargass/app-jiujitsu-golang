package main

import (
	"context"
	"fmt"
	"log"
	"tatame/backend/internal/academies"
	"tatame/backend/internal/access"
	"tatame/backend/internal/auth"
	"tatame/backend/internal/classes"
	"tatame/backend/internal/config"
	"tatame/backend/internal/core"
	"tatame/backend/internal/database"
	"tatame/backend/internal/memberships"
	"time"
	_ "time/tzdata"
)

func main() {
	cfg := config.Load()
	must(database.Migrate(cfg.DatabaseURL))
	db, e := database.Open(context.Background(), cfg.DatabaseURL)
	must(e)
	defer db.Close()
	ctx := context.Background()
	as := auth.Service{Repo: auth.Repository{DB: db}}
	users := map[string]string{}
	for _, item := range []struct{ Name, Email string }{{"Gestor Demo", "gestor@tatame.demo"}, {"Professor Carlos", "professor@tatame.demo"}, {"João Silva", "aluno@tatame.demo"}, {"Ana Souza", "ana@tatame.demo"}} {
		var id string
		e = db.QueryRow(ctx, "SELECT id FROM users WHERE email=$1", item.Email).Scan(&id)
		if e != nil {
			v, err := as.Register(ctx, auth.Credentials{Name: item.Name, Email: item.Email, Password: "Tatame123!"})
			must(err)
			id = v.User.ID
		}
		users[item.Email] = id
	}
	admin := core.WithPrincipal(ctx, core.Principal{UserID: users["gestor@tatame.demo"]})
	ac := academies.Service{Repo: academies.Repository{DB: db}}
	ms := memberships.Service{Repo: memberships.Repository{DB: db}, Access: access.Service{DB: db}}
	cs := classes.Service{Repo: classes.Repository{DB: db}, Access: access.Service{DB: db}}
	for _, name := range []string{"Gracie Barra • Centro", "Tatame • Zona Sul"} {
		var a academies.Academy
		e = db.QueryRow(ctx, "SELECT id,name,code FROM academies WHERE name=$1 ORDER BY created_at LIMIT 1", name).Scan(&a.ID, &a.Name, &a.Code)
		if e != nil {
			a, e = ac.Create(admin, academies.CreateInput{Name: name})
			must(e)
		}
		for _, item := range []struct{ Email, Role string }{{"professor@tatame.demo", "teacher"}, {"aluno@tatame.demo", "student"}, {"ana@tatame.demo", "student"}} {
			var exists bool
			must(db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE academy_id=$1 AND user_id=$2 AND role=$3)`, a.ID, users[item.Email], item.Role).Scan(&exists))
			if !exists {
				q, err := ms.Request(core.WithPrincipal(ctx, core.Principal{UserID: users[item.Email]}), memberships.RequestInput{AcademyCode: a.Code, Role: item.Role})
				must(err)
				must(ms.Repo.Decide(admin, a.ID, q.ID, "approved"))
			}
		}
		teacher, err := cs.Access.Membership(ctx, a.ID, users["professor@tatame.demo"])
		must(err)
		var cid string
		e = db.QueryRow(ctx, "SELECT id FROM classes WHERE academy_id=$1 AND name='Jiu-Jitsu Adulto'", a.ID).Scan(&cid)
		if e != nil {
			v, err := cs.Save(admin, a.ID, "", classes.ClassInput{Name: "Jiu-Jitsu Adulto", TeacherID: teacher.ID})
			must(err)
			cid = v.ID
		}
		loc, err := time.LoadLocation("America/Sao_Paulo")
		must(err)
		weekday := int(time.Now().In(loc).Weekday())
		var sid string
		e = db.QueryRow(ctx, "SELECT id FROM class_schedules WHERE academy_id=$1 AND class_id=$2 AND weekday=$3 AND start_time='19:00'", a.ID, cid, weekday).Scan(&sid)
		if e != nil {
			v, err := cs.AddSchedule(admin, a.ID, cid, classes.ScheduleInput{Weekday: weekday, StartTime: "19:00", Duration: 60})
			must(err)
			sid = v.ID
		}
		_, err = cs.Open(admin, a.ID, cid, classes.OpenInput{ScheduleID: sid})
		if err != nil {
			fmt.Println("Aula de demonstração já encerrada:", err)
		}
		fmt.Printf("%s | código: %s\n", a.Name, a.Code)
	}
	fmt.Println("Contas: gestor@tatame.demo, professor@tatame.demo, aluno@tatame.demo, ana@tatame.demo | senha de demonstração: Tatame123!")
}
func must(e error) {
	if e != nil {
		log.Fatal(e)
	}
}
