package students

type Billing struct {
	Enabled       bool   `json:"enabled"`
	AmountCents   int64  `json:"amount_cents"`
	DueDay        int    `json:"due_day"`
	FirstMonth    string `json:"first_month"`
	PayerName     string `json:"payer_name"`
	PayerDocument string `json:"payer_document"`
}
type Student struct {
	ID          string   `json:"id"`
	AcademyID   string   `json:"academy_id"`
	UserID      string   `json:"user_id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Phone       string   `json:"phone"`
	Status      string   `json:"status"`
	Belt        string   `json:"belt"`
	PlanID      string   `json:"plan_id"`
	StudentCode string   `json:"student_code"`
	Modalities  []string `json:"modality_ids"`
	Billing     *Billing `json:"billing"`
}
type Input struct {
	Name       string   `json:"name"`
	Email      string   `json:"email"`
	Phone      string   `json:"phone"`
	Status     string   `json:"status"`
	Belt       string   `json:"belt"`
	PlanID     string   `json:"plan_id"`
	Modalities []string `json:"modality_ids"`
	Billing    *Billing `json:"billing"`
}
type Catalog struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Active      bool     `json:"active"`
	AmountCents int64    `json:"amount_cents,omitempty"`
	Modalities  []string `json:"modality_ids,omitempty"`
}
type Page[T any] struct {
	Items    []T `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}
