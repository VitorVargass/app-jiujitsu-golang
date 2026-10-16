package classes

import "time"

type Class struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	TeacherID    string     `json:"teacher_membership_id"`
	TeacherName  string     `json:"teacher_name"`
	ModalityID   string     `json:"modality_id"`
	ModalityName string     `json:"modality_name"`
	Active       bool       `json:"active"`
	Schedules    []Schedule `json:"schedules"`
}
type ClassInput struct {
	Name         string           `json:"name"`
	TeacherID    string           `json:"teacher_membership_id"`
	Active       *bool            `json:"active"`
	ModalityID   string           `json:"modality_id"`
	ClearTeacher bool             `json:"clear_teacher"`
	Schedules    *[]ScheduleInput `json:"schedules"`
}
type Schedule struct {
	ID        string `json:"id"`
	ClassID   string `json:"class_id"`
	Weekday   int    `json:"weekday"`
	StartTime string `json:"start_time"`
	Duration  int    `json:"duration_minutes"`
}
type ScheduleInput struct {
	Weekday   int    `json:"weekday"`
	StartTime string `json:"start_time"`
	Duration  int    `json:"duration_minutes"`
}
type Session struct {
	ID              string    `json:"id"`
	ClassID         string    `json:"class_id"`
	ClassName       string    `json:"class_name"`
	TeacherID       string    `json:"teacher_membership_id"`
	TeacherName     string    `json:"teacher_name"`
	StartsAt        time.Time `json:"starts_at"`
	Status          string    `json:"status"`
	AttendanceCount int       `json:"attendance_count"`
}
type OpenInput struct {
	ScheduleID string `json:"schedule_id"`
	Date       string `json:"date"`
}
type StatusInput struct {
	Status string `json:"status"`
}
