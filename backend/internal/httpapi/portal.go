package httpapi

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func WithPortal(api http.Handler, root string) http.Handler {
	if root == "" {
		root = "../mobile/dist"
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return api
	}
	if _, e := os.Stat(filepath.Join(absolute, "index.html")); e != nil {
		return api
	}
	files := http.FileServer(http.Dir(absolute))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/v1/") || r.URL.Path == "/healthz" || r.URL.Path == "/openapi.json" {
			api.ServeHTTP(w, r)
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" {
			http.Error(w, "Method not allowed", 405)
			return
		}
		clean := path.Clean("/" + r.URL.Path)
		target := filepath.Join(absolute, filepath.FromSlash(clean))
		if stat, e := os.Stat(target); e == nil && !stat.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		if path.Ext(clean) != "" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, filepath.Join(absolute, "index.html"))
	})
}
