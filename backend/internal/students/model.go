package students

import "time"

type Billing struct {
	Enabled       bool   `json:"enabled"`
	AmountCents   int64  `json:"amount_cents"`
	DueDay        int    `json:"due_day"`
	FirstMonth    string `json:"first_month"`
	PayerName     string `json:"payer_name"`
	PayerDocument string `json:"payer_document"`
}
type BeltOption struct {
	Label  string   `json:"label"`
	Colors []string `json:"colors"`
}
type ModalityDetail struct {
	ModalityID  string `json:"modality_id"`
	Belt        string `json:"belt"`
	Degrees     int    `json:"degrees"`
	AmountCents int64  `json:"amount_cents"`
}

// Omitted degrees preserve a saved value when an older client edits an enrollment.
type EnrollmentInput struct {
	ModalityID  string `json:"modality_id"`
	Belt        string `json:"belt"`
	Degrees     *int   `json:"degrees"`
	AmountCents int64  `json:"amount_cents"`
}
type Student struct {
	StartedOn       string           `json:"started_on"`
	PersonID        string           `json:"person_id"`
	ParticipantID   string           `json:"participant_id"`
	EmailLocked     bool             `json:"email_locked"`
	ID              string           `json:"id"`
	AcademyID       string           `json:"academy_id"`
	UserID          string           `json:"user_id"`
	Name            string           `json:"name"`
	Email           string           `json:"email"`
	CPF             string           `json:"cpf"`
	BirthDate       string           `json:"birth_date"`
	ArchivedAt      *time.Time       `json:"archived_at"`
	Phone           string           `json:"phone"`
	AlternatePhone  string           `json:"alternate_phone"`
	Status          string           `json:"status"`
	Belt            string           `json:"belt"`
	ChargeMode      string           `json:"charge_mode"`
	PlanID          string           `json:"plan_id"`
	StudentCode     string           `json:"student_code"`
	Modalities      []string         `json:"modality_ids"`
	ModalityDetails []ModalityDetail `json:"modality_details"`
	Billing         *Billing         `json:"billing"`
}
type Input struct {
	RejectExistingIdentity bool              `json:"-"`
	StartedOn              *string           `json:"started_on"`
	ExpectedStartedOn      *string           `json:"expected_started_on"`
	ReuseIdentity          bool              `json:"reuse_existing_identity"`
	UseMyAccount           bool              `json:"use_my_account"`
	Name                   string            `json:"name"`
	Email                  string            `json:"email"`
	CPF                    *string           `json:"cpf"`
	BirthDate              *string           `json:"birth_date"`
	Phone                  string            `json:"phone"`
	AlternatePhone         string            `json:"alternate_phone"`
	Status                 string            `json:"status"`
	Belt                   string            `json:"belt"`
	ChargeMode             string            `json:"charge_mode"`
	PlanID                 string            `json:"plan_id"`
	Modalities             []string          `json:"modality_ids"`
	ModalityDetails        []EnrollmentInput `json:"modality_details"`
	Billing                *Billing          `json:"billing"`
}
type Catalog struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Active      bool         `json:"active"`
	AmountCents int64        `json:"amount_cents"`
	Modalities  []string     `json:"modality_ids,omitempty"`
	BeltOptions []BeltOption `json:"belt_options,omitempty"`
}
type Page[T any] struct {
	Items    []T `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}
