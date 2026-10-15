package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func cleanEnvironment(t *testing.T) {
	t.Helper()
	for _, key := range []string{"DATABASE_URL", "HTTP_ADDR", "ALLOWED_ORIGINS", "ASAAS_CONNECTIONS_FILE", "WEB_DIST_DIR"} {
		t.Setenv(key, "")
		if err := os.Unsetenv(key); err != nil {
			t.Fatal(err)
		}
	}
	t.Chdir(t.TempDir())
}

func writeEnv(t *testing.T, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(".", ".env"), []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}

func TestLoadReadsFileAndServerOnlyValues(t *testing.T) {
	cleanEnvironment(t)
	writeEnv(t, "# configuração local\nDATABASE_URL='postgres://student:fake%40pass@localhost:5432/custom'\nHTTP_ADDR=:8180\nALLOWED_ORIGINS=http://localhost:8081\nASAAS_CONNECTIONS_FILE=private.json\nWEB_DIST_DIR=../mobile/dist\n")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL != "postgres://student:fake%40pass@localhost:5432/custom" || cfg.Addr != ":8180" {
		t.Fatal("configuração do arquivo não foi carregada")
	}
	if os.Getenv("ASAAS_CONNECTIONS_FILE") != "private.json" || os.Getenv("WEB_DIST_DIR") != "../mobile/dist" {
		t.Fatal("configuração dos serviços não foi carregada")
	}
}

func TestProcessEnvironmentHasPriority(t *testing.T) {
	cleanEnvironment(t)
	writeEnv(t, "DATABASE_URL=postgres://file/database\nHTTP_ADDR=:8080\nALLOWED_ORIGINS=auto\n")
	t.Setenv("DATABASE_URL", "postgres://process/database")
	t.Setenv("HTTP_ADDR", ":9090")
	t.Setenv("ALLOWED_ORIGINS", "https://portal.example")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL != "postgres://process/database" || cfg.Addr != ":9090" || cfg.AllowedOrigins != "https://portal.example" {
		t.Fatal("variáveis do processo devem prevalecer")
	}
}

func TestMissingFileIsOptional(t *testing.T) {
	cleanEnvironment(t)
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":8080" || !strings.Contains(cfg.DatabaseURL, "@localhost:5432/tatame") {
		t.Fatal("defaults indisponíveis sem arquivo")
	}
}

func TestInvalidFileDoesNotExposeSecrets(t *testing.T) {
	cleanEnvironment(t)
	writeEnv(t, "DATABASE_URL=\"secret-without-closing-quote\n")
	_, err := Load()
	if err == nil {
		t.Fatal("arquivo inválido deve interromper a inicialização")
	}
	if strings.Contains(err.Error(), "secret-without-closing-quote") {
		t.Fatal("erro expôs conteúdo privado")
	}
}

func TestAutoOriginsIncludeLocalExpoAndNeverWildcard(t *testing.T) {
	cleanEnvironment(t)
	writeEnv(t, "ALLOWED_ORIGINS=auto\n")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(cfg.AllowedOrigins, "http://localhost:8081") || !strings.Contains(cfg.AllowedOrigins, "http://127.0.0.1:8081") || strings.Contains(cfg.AllowedOrigins, "*") {
		t.Fatal("origens locais inválidas")
	}
}
