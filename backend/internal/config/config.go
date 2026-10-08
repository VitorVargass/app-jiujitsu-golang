package config

import "os"

type Config struct{ DatabaseURL, Addr, AllowedOrigins string }

func Load() Config {
	return Config{get("DATABASE_URL", "postgres://tatame:tatame_dev@localhost:5432/tatame?sslmode=disable"), get("HTTP_ADDR", ":8080"), get("ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:19006")}
}
func get(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
