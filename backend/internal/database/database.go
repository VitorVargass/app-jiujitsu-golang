package database

import (
	"context"
	"database/sql"
	"embed"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrations embed.FS

func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	p, e := pgxpool.New(ctx, url)
	if e != nil {
		return nil, e
	}
	if e = p.Ping(ctx); e != nil {
		p.Close()
		return nil, e
	}
	return p, nil
}
func Migrate(url string) error {
	db, e := sql.Open("pgx", url)
	if e != nil {
		return e
	}
	defer db.Close()
	goose.SetBaseFS(migrations)
	if e = goose.SetDialect("postgres"); e != nil {
		return e
	}
	return goose.Up(db, "migrations")
}
