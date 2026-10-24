package memberships

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"tatame/backend/internal/core"
)

func (r Repository) Managers(ctx context.Context, academy string) ([]Manager, error) {
	rows, err := r.DB.Query(ctx, `SELECT m.id,u.id,u.name,p.email,m.status FROM memberships m
 JOIN membership_roles mr ON mr.membership_id=m.id AND mr.role='admin'
 JOIN users u ON u.id=m.user_id JOIN people p ON p.id=u.person_id
 WHERE m.academy_id=$1 ORDER BY u.name,u.id`, academy)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Manager{}
	for rows.Next() {
		var value Manager
		if err = rows.Scan(&value.ID, &value.UserID, &value.Name, &value.Email, &value.Status); err != nil {
			return nil, err
		}
		result = append(result, value)
	}
	return result, rows.Err()
}

// Account creation and its academy role are committed together. No session is issued.
func (r Repository) CreateManager(ctx context.Context, academy, actor string, in CreateManagerInput, hash string) (Manager, error) {
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return Manager{}, err
	}
	defer tx.Rollback(ctx)
	var locked string
	if err = tx.QueryRow(ctx, "SELECT id FROM academies WHERE id=$1 FOR UPDATE", academy).Scan(&locked); err != nil {
		return Manager{}, err
	}
	// Serialize against role changes and recheck the actor inside the transaction.
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN membership_roles mr ON mr.membership_id=m.id
 WHERE m.academy_id=$1 AND m.user_id=$2 AND m.status='active' AND mr.role='admin')`, academy, actor).Scan(&allowed)
	if err != nil {
		return Manager{}, err
	}
	if !allowed {
		return Manager{}, core.E(403, "forbidden", "Somente um gestor ativo pode adicionar gestores.")
	}
	// This upsert also serializes concurrent registrations of the same canonical email.
	var person string
	err = tx.QueryRow(ctx, `INSERT INTO people(id,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id`, core.ID(), in.Email).Scan(&person)
	if err != nil {
		return Manager{}, err
	}
	value := Manager{Email: in.Email, Status: "active"}
	err = tx.QueryRow(ctx, "SELECT id,name FROM users WHERE person_id=$1 FOR UPDATE", person).Scan(&value.UserID, &value.Name)
	exists := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Manager{}, err
	}
	if exists && !in.LinkExisting {
		return Manager{}, core.E(409, "account_exists", "Este e-mail já tem conta. Escolha vincular conta existente; a senha será preservada.")
	}
	if !exists && in.LinkExisting {
		return Manager{}, core.E(404, "account_not_found", "Não existe conta de acesso com esse e-mail. Escolha criar uma nova conta.")
	}
	if !exists {
		value.UserID = core.ID()
		value.Name = in.Name
		if _, err = tx.Exec(ctx, "INSERT INTO users(id,person_id,name,password_hash) VALUES($1,$2,$3,$4)", value.UserID, person, value.Name, hash); err != nil {
			return Manager{}, err
		}
	}
	var status string
	var admin bool
	err = tx.QueryRow(ctx, `SELECT m.id,m.status,EXISTS(SELECT 1 FROM membership_roles mr WHERE mr.membership_id=m.id AND mr.role='admin')
 FROM memberships m WHERE m.academy_id=$1 AND m.user_id=$2 FOR UPDATE`, academy, value.UserID).Scan(&value.ID, &status, &admin)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Manager{}, err
	}
	if err == nil {
		if admin && status == "active" {
			return Manager{}, core.E(409, "already_manager", "Esta pessoa já é gestora desta academia.")
		}
		if status != "active" {
			if _, err = tx.Exec(ctx, "UPDATE memberships SET status='active' WHERE academy_id=$1 AND id=$2", academy, value.ID); err != nil {
				return Manager{}, err
			}
		}
	} else {
		value.ID = core.ID()
		if _, err = tx.Exec(ctx, `INSERT INTO memberships(id,academy_id,user_id,status,student_code,qr_token) VALUES($1,$2,$3,'active',$4,$5)`, value.ID, academy, value.UserID, core.Digits(), core.Token()); err != nil {
			return Manager{}, err
		}
	}
	if _, err = tx.Exec(ctx, "INSERT INTO membership_roles(membership_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING", value.ID); err != nil {
		return Manager{}, err
	}
	return value, tx.Commit(ctx)
}
