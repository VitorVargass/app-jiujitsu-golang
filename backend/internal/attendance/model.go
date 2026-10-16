package attendance

import "time"

type Input struct {
	QRToken      string `json:"qr_token"`
	StudentCode  string `json:"student_code"`
	MembershipID string `json:"membership_id"`
	CPF          string `json:"cpf,omitempty"`
}
type Result struct {
	ID           string    `json:"id"`
	MembershipID string    `json:"membership_id"`
	StudentName  string    `json:"student_name"`
	Belt         string    `json:"belt"`
	CheckedInAt  time.Time `json:"checked_in_at"`
	Duplicate    bool      `json:"duplicate"`
}
type History struct {
	ID           string     `json:"id"`
	StudentID    string     `json:"student_id"`
	SessionID    string     `json:"session_id"`
	ClassName    string     `json:"class_name"`
	StudentName  string     `json:"student_name"`
	Belt         string     `json:"belt"`
	CheckedInAt  time.Time  `json:"checked_in_at"`
	ModalityName string     `json:"modality_name,omitempty"`
	StartsAt     *time.Time `json:"starts_at,omitempty"`
}
