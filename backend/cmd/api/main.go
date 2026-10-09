package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"tatame/backend/internal/config"
	"tatame/backend/internal/database"
	"tatame/backend/internal/httpapi"
	"tatame/backend/internal/payments"
	"time"
	_ "time/tzdata"
)

func main() {
	cfg := config.Load()
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if e := database.Migrate(cfg.DatabaseURL); e != nil {
		slog.Error("migration failed", "error", e)
		os.Exit(1)
	}
	db, e := database.Open(context.Background(), cfg.DatabaseURL)
	if e != nil {
		slog.Error("database failed", "error", e)
		os.Exit(1)
	}
	defer db.Close()
	bank, e := payments.Load(db, os.Getenv("ASAAS_CONNECTIONS_FILE"))
	if e != nil {
		slog.Error("payment configuration failed", "error", e)
		os.Exit(1)
	}
	server := &http.Server{Addr: cfg.Addr, Handler: httpapi.WithPortal(httpapi.NewWithPayments(db, cfg.AllowedOrigins, bank), os.Getenv("WEB_DIST_DIR")), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go bank.Run(ctx)
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	slog.Info("Tatame API ready", "address", cfg.Addr)
	if e = server.ListenAndServe(); e != nil && !errors.Is(e, http.ErrServerClosed) {
		slog.Error("server failed", "error", e)
		os.Exit(1)
	}
}
