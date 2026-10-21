package config

import (
	"errors"
	"net"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct{ DatabaseURL, Addr, AllowedOrigins string }

// Load reads .env from the backend working directory. Process variables take priority.
func Load() (Config, error) {
	if err := godotenv.Load(".env"); err != nil && !errors.Is(err, os.ErrNotExist) {
		// A dotenv parser error may contain credentials. Do not include the file contents.
		return Config{}, errors.New("não foi possível carregar backend/.env: confira o formato e a permissão de leitura")
	}
	cfg := Config{
		DatabaseURL:    get("DATABASE_URL", "postgres://tatame:tatame_dev@localhost:5432/tatame?sslmode=disable"),
		Addr:           get("HTTP_ADDR", ":"+get("PORT", "8080")),
		AllowedOrigins: get("ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:19006"),
	}
	if cfg.AllowedOrigins == "auto" {
		cfg.AllowedOrigins = localOrigins()
	}
	return cfg, nil
}

// Local Expo web origins are derived at API startup; native Expo Go does not use CORS.
func localOrigins() string {
	hosts := []string{"localhost", "127.0.0.1"}
	addresses, _ := net.InterfaceAddrs()
	seen := map[string]bool{"127.0.0.1": true}
	for _, address := range addresses {
		ip, _, err := net.ParseCIDR(address.String())
		if err != nil || ip.To4() == nil || ip.IsLoopback() || !ip.IsGlobalUnicast() || seen[ip.String()] {
			continue
		}
		hosts = append(hosts, ip.String())
		seen[ip.String()] = true
	}
	var origins []string
	for _, host := range hosts {
		for _, port := range []string{"8081", "19006"} {
			origins = append(origins, "http://"+net.JoinHostPort(host, port))
		}
	}
	return strings.Join(origins, ",")
}

func get(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
