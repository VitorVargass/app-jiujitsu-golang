package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPortalDeepLinksAndAPIBoundary(t *testing.T) {
	root := t.TempDir()
	if e := os.WriteFile(filepath.Join(root, "index.html"), []byte("<html>Tatame portal</html>"), 0600); e != nil {
		t.Fatal(e)
	}
	handler := WithPortal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Error(w, "API route missing", 404) }), root)
	for _, path := range []string{"/invite/token", "/pay/academy/invoice"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 || !strings.Contains(w.Body.String(), "Tatame portal") {
			t.Fatal(path, w.Code)
		}
	}
	for _, path := range []string{"/v1/unknown", "/missing.js"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 404 || strings.Contains(w.Body.String(), "Tatame portal") {
			t.Fatal("incorrect SPA fallback", path, w.Code)
		}
	}
}
