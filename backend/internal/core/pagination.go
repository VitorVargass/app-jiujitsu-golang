package core

import (
	"net/http"
	"strconv"
)

type Page[T any] struct {
	Items    []T `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

func Pagination(r *http.Request) (int, int, error) {
	p, n := 1, 25
	var e error
	if s := r.URL.Query().Get("page"); s != "" {
		p, e = strconv.Atoi(s)
		if e != nil || p < 1 || p > 100000 {
			return 0, 0, E(422, "invalid_page", "Página inválida.")
		}
	}
	if s := r.URL.Query().Get("page_size"); s != "" {
		n, e = strconv.Atoi(s)
		if e != nil || n < 1 || n > 100 {
			return 0, 0, E(422, "invalid_page_size", "Use entre 1 e 100 registros por página.")
		}
	}
	return p, n, nil
}
