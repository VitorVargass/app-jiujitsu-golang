package attendance

import "time"

type Input struct {
	StudentID    string `json:"student_id,omitempty"`
	QRToken      string `json:"qr_token"`
	StudentCode  string `json:"student_code"`
	MembershipID string `json:"membership_id"`
	CPF          string `json:"cpf,omitempty"`
}
type Result struct {
	SessionID     string     `json:"session_id,omitempty"`
	ClassName     string     `json:"class_name,omitempty"`
	StartsAt      *time.Time `json:"starts_at,omitempty"`
	Source        string     `json:"source,omitempty"`
	ParticipantID string     `json:"participant_id"`
	StudentID     string     `json:"student_id,omitempty"`
	ID            string     `json:"id"`
	MembershipID  string     `json:"membership_id"`
	StudentName   string     `json:"student_name"`
	Belt          string     `json:"belt"`
	CheckedInAt   time.Time  `json:"checked_in_at"`
	Duplicate     bool       `json:"duplicate"`
}
type History struct {
	Source        string     `json:"source"`
	ParticipantID string     `json:"participant_id"`
	PersonID      string     `json:"person_id"`
	ID            string     `json:"id"`
	StudentID     string     `json:"student_id"`
	SessionID     string     `json:"session_id"`
	ClassName     string     `json:"class_name"`
	StudentName   string     `json:"student_name"`
	Belt          string     `json:"belt"`
	CheckedInAt   time.Time  `json:"checked_in_at"`
	ModalityName  string     `json:"modality_name,omitempty"`
	StartsAt      *time.Time `json:"starts_at,omitempty"`
}
