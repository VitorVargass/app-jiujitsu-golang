package payments

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
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

// URLs are fixed in production. Tests inject a local client, never credentials.
type InfinitePay struct {
	DB        *pgxpool.Pool
	Key       []byte
	PublicURL string
	Enabled   bool
	BaseURL   string
	HTTP      *http.Client
}

func LoadInfinitePay(db *pgxpool.Pool) (*InfinitePay, error) {
	p := &InfinitePay{DB: db, BaseURL: "https://api.checkout.infinitepay.io", HTTP: &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
	raw := os.Getenv("PAYMENTS_MASTER_KEY")
	if raw != "" {
		var e error
		p.Key, e = base64.StdEncoding.DecodeString(raw)
		if e != nil || len(p.Key) != 32 {
			return nil, errors.New("PAYMENTS_MASTER_KEY must be a base64-encoded 32-byte key")
		}
	}
	p.PublicURL = strings.TrimRight(os.Getenv("PAYMENTS_PUBLIC_URL"), "/")
	if p.PublicURL != "" {
		u, e := url.Parse(p.PublicURL)
		if e != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
			return nil, errors.New("PAYMENTS_PUBLIC_URL must be a public HTTPS origin")
		}
	}
	p.Enabled = os.Getenv("INFINITEPAY_ENABLED") == "true"
	if p.Enabled && (len(p.Key) != 32 || p.PublicURL == "") {
		return nil, errors.New("InfinitePay requires PAYMENTS_MASTER_KEY and PAYMENTS_PUBLIC_URL")
	}
	return p, nil
}
func (p *InfinitePay) seal(academy, id, key string) ([]byte, error) {
	block, e := aes.NewCipher(p.Key)
	if e != nil {
		return nil, e
	}
	g, e := cipher.NewGCM(block)
	if e != nil {
		return nil, e
	}
	nonce := make([]byte, g.NonceSize())
	if _, e = rand.Read(nonce); e != nil {
		return nil, e
	}
	return g.Seal(nonce, nonce, []byte(key), []byte(academy+":"+id)), nil
}
func (p *InfinitePay) open(academy, id string, data []byte) (string, error) {
	block, e := aes.NewCipher(p.Key)
	if e != nil {
		return "", errors.New("payment credential unavailable")
	}
	g, e := cipher.NewGCM(block)
	if e != nil {
		return "", e
	}
	if len(data) < g.NonceSize() {
		return "", errors.New("payment credential unavailable")
	}
	plain, e := g.Open(nil, data[:g.NonceSize()], data[g.NonceSize():], []byte(academy+":"+id))
	if e != nil {
		return "", errors.New("payment credential unavailable")
	}
	return string(plain), nil
}
func (p *InfinitePay) request(ctx context.Context, path, key string, in, out any) error {
	raw, e := json.Marshal(in)
	if e != nil {
		return e
	}
	req, e := http.NewRequestWithContext(ctx, "POST", p.BaseURL+path, bytes.NewReader(raw))
	if e != nil {
		return errors.New("payment request unavailable")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Api-Key", key)
	res, e := p.HTTP.Do(req)
	if e != nil {
		return errors.New("payment provider unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return &InfiniteHTTPError{res.StatusCode}
	}
	if e = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out); e != nil {
		return errors.New("invalid payment provider response")
	}
	return nil
}

type InfiniteHTTPError struct{ Status int }

func (e *InfiniteHTTPError) Error() string { return "payment provider rejected request" }
func validCheckoutURL(raw string) bool {
	u, e := url.Parse(raw)
	return e == nil && u.Scheme == "https" && u.User == nil && u.Host == "checkout.infinitepay.io" && u.Fragment == ""
}
