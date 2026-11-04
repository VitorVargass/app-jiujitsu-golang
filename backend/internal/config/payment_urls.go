package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

// PaymentOrigins keeps browser returns separate from server-to-server callbacks.
// PAYMENTS_PUBLIC_URL remains the fallback for existing single-origin deployments.
func PaymentOrigins() (portal, api string, err error) {
	legacy := strings.TrimSpace(os.Getenv("PAYMENTS_PUBLIC_URL"))
	read := func(name string) (string, error) {
		raw := strings.TrimSpace(os.Getenv(name))
		if raw == "" { raw = legacy }
		if raw == "" { return "", nil }
		u, e := url.Parse(raw)
		if e != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
			return "", fmt.Errorf("%s must be a public HTTPS origin", name)
		}
		return strings.TrimRight(raw, "/"), nil
	}
	portal, err = read("PAYMENTS_PORTAL_URL")
	if err != nil { return }
	api, err = read("PAYMENTS_API_URL")
	return
}
