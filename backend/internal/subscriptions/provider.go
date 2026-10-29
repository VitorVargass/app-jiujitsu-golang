package subscriptions

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Provider struct {
	BaseURL     string
	HTTP        *http.Client
	Key, Handle string
}

func newProvider(c Config) *Provider {
	return &Provider{BaseURL: "https://api.checkout.infinitepay.io", Key: c.APIKey, Handle: c.Handle,
		HTTP: &http.Client{Timeout: 12 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}
func Load(db *pgxpool.Pool) (*Manager, error) {
	c := Config{Enabled: os.Getenv("TATAMEMIX_BILLING_ENABLED") == "true", APIKey: strings.TrimSpace(os.Getenv("TATAMEMIX_INFINITEPAY_API_KEY")), Handle: strings.TrimPrefix(strings.TrimSpace(os.Getenv("TATAMEMIX_INFINITEPAY_HANDLE")), "$"), PublicURL: strings.TrimRight(os.Getenv("PAYMENTS_PUBLIC_URL"), "/")}
	if c.Enabled {
		u, e := url.Parse(c.PublicURL)
		if e != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" || c.APIKey == "" || c.Handle == "" {
			return nil, errors.New("TatameMix billing requires platform API key, handle and public HTTPS origin")
		}
	}
	return New(db, c), nil
}

type providerError struct{ Status int }

func (e *providerError) Error() string { return "subscription provider rejected request" }
func (p *Provider) request(ctx context.Context, path string, in, out any) error {
	raw, e := json.Marshal(in)
	if e != nil {
		return e
	}
	req, e := http.NewRequestWithContext(ctx, "POST", p.BaseURL+path, bytes.NewReader(raw))
	if e != nil {
		return errors.New("subscription request unavailable")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Api-Key", p.Key)
	res, e := p.HTTP.Do(req)
	if e != nil {
		return errors.New("subscription provider unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return &providerError{res.StatusCode}
	}
	if e = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out); e != nil {
		return errors.New("invalid subscription provider response")
	}
	return nil
}
func validURL(raw string) bool {
	u, e := url.Parse(raw)
	return e == nil && u.Scheme == "https" && u.Host == "checkout.infinitepay.io" && u.User == nil && u.Fragment == ""
}
