package classes

import (
	"context"
	"strings"
	"tatame/backend/internal/access"
	"tatame/backend/internal/core"
	"time"
)

type Service struct {
	Repo   Repository
	Access access.Service
}

func (s Service) Teacher(ctx context.Context, a, id string) error {
	if !core.ValidID(id) {
		return core.E(422, "invalid_teacher", "Selecione um professor ativo.")
	}
	ok, err := s.Repo.TeacherActive(ctx, a, id)
	if err != nil {
		return err
	}
	if !ok {
		return core.E(422, "invalid_teacher", "O professor precisa estar ativo nesta academia.")
	}
	return nil
}
func (s Service) Save(ctx context.Context, a, id string, in ClassInput) (Class, error) {
	if _, err := s.Access.Require(ctx, a, "admin"); err != nil {
		return Class{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.ModalityID != "" {
		var ok bool
		if !core.ValidID(in.ModalityID) {
			return Class{}, core.E(422, "invalid_modality", "Modalidade inválida.")
		}
		if err := s.Repo.DB.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM modalities WHERE academy_id=$1 AND id=$2 AND active)", a, in.ModalityID).Scan(&ok); err != nil {
			return Class{}, err
		}
		if !ok {
			return Class{}, core.E(422, "invalid_modality", "Selecione uma modalidade ativa desta academia.")
		}
	} else if id == "" {
		if err := s.Repo.DB.QueryRow(ctx, "SELECT id FROM modalities WHERE academy_id=$1 AND active ORDER BY name LIMIT 1", a).Scan(&in.ModalityID); err != nil {
			return Class{}, core.E(422, "invalid_modality", "Cadastre uma modalidade ativa.")
		}
	}
	if id == "" {
		if len(in.Name) < 2 || len(in.Name) > 100 {
			return Class{}, core.E(422, "invalid_name", "Informe o nome da turma.")
		}
		if in.TeacherID != "" {
			if err := s.Teacher(ctx, a, in.TeacherID); err != nil {
				return Class{}, err
			}
		}
		return s.Repo.CreateClass(ctx, a, in)
	}
	if !core.ValidID(id) {
		return Class{}, core.E(404, "not_found", "Turma não encontrada.")
	}
	if in.Name != "" && (len(in.Name) < 2 || len(in.Name) > 100) {
		return Class{}, core.E(422, "invalid_name", "Nome inválido.")
	}
	if in.TeacherID != "" {
		if in.TeacherID != "" {
			if err := s.Teacher(ctx, a, in.TeacherID); err != nil {
				return Class{}, err
			}
		}
	}
	return s.Repo.UpdateClass(ctx, a, id, in)
}
func (s Service) AddSchedule(ctx context.Context, a, c string, in ScheduleInput) (Schedule, error) {
	if _, err := s.Access.Require(ctx, a, "admin"); err != nil {
		return Schedule{}, err
	}
	if !core.ValidID(c) {
		return Schedule{}, core.E(404, "not_found", "Turma não encontrada.")
	}
	if _, err := time.Parse("15:04", in.StartTime); err != nil || in.Weekday < 0 || in.Weekday > 6 || in.Duration < 15 || in.Duration > 240 {
		return Schedule{}, core.E(422, "invalid_schedule", "Informe dia, horário HH:MM e duração entre 15 e 240 minutos.")
	}
	return s.Repo.AddSchedule(ctx, a, c, in)
}
func (s Service) Open(ctx context.Context, a, c string, in OpenInput) (Session, error) {
	if _, err := s.Access.Class(ctx, a, c); err != nil {
		return Session{}, err
	}
	if !core.ValidID(in.ScheduleID) {
		return Session{}, core.E(422, "invalid_schedule", "Selecione o horário da aula.")
	}
	zone, start, weekday, active, err := s.Repo.ScheduleForOpen(ctx, a, c, in.ScheduleID)
	if err != nil {
		return Session{}, err
	}
	if !active {
		return Session{}, core.E(404, "not_found", "Horário ou turma não disponível.")
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return Session{}, err
	}
	today := time.Now().In(loc).Format("2006-01-02")
	if in.Date == "" {
		in.Date = today
	}
	at, err := time.ParseInLocation("2006-01-02 15:04:05", in.Date+" "+start, loc)
	if err != nil || in.Date != today || int(at.Weekday()) != weekday {
		return Session{}, core.E(422, "invalid_date", "Abra a aula no dia correspondente ao horário.")
	}
	v, err := s.Repo.Open(ctx, a, c, in.ScheduleID, at.UTC())
	if err != nil {
		return v, err
	}
	if v.Status != "open" {
		return v, core.E(409, "session_closed", "Esta aula já foi encerrada ou cancelada.")
	}
	return v, nil
}
func (s Service) Close(ctx context.Context, a, id, status string) error {
	if !core.ValidID(id) {
		return core.E(404, "not_found", "Aula não encontrada.")
	}
	c, err := s.Repo.SessionClass(ctx, a, id)
	if err != nil {
		return err
	}
	if _, err = s.Access.Class(ctx, a, c); err != nil {
		return err
	}
	if status != "closed" && status != "cancelled" {
		return core.E(422, "invalid_status", "Encerre ou cancele a aula.")
	}
	return s.Repo.SetStatus(ctx, a, id, status)
}
