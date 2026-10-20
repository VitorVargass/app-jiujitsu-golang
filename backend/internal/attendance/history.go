package attendance

import (
	"context"
	"tatame/backend/internal/core"
)

func (r Repository) PagedHistory(ctx context.Context, a, session, student, month, class, participant string, page, size int) (core.Page[History], error) {
	out := core.Page[History]{Items: []History{}, Page: page, PageSize: size}
	joins := ` FROM attendances p
 JOIN academy_participants ap ON ap.id=p.participant_id AND ap.academy_id=p.academy_id
 LEFT JOIN students st ON st.participant_id=ap.id AND st.academy_id=ap.academy_id
 LEFT JOIN users u ON u.person_id=ap.person_id
 JOIN class_sessions s ON s.id=p.session_id AND s.academy_id=p.academy_id
 JOIN classes c ON c.id=s.class_id AND c.academy_id=s.academy_id
 JOIN academies a ON a.id=p.academy_id
 LEFT JOIN modalities m ON m.id=c.modality_id AND m.academy_id=c.academy_id
 WHERE p.academy_id=$1 AND ($2::text='' OR p.session_id::text=$2) AND ($3::text='' OR st.id::text=$3)
 AND ($4::text='' OR s.starts_at>=((NULLIF($4,'')||'-01')::date::timestamp AT TIME ZONE a.timezone)
 AND s.starts_at<(((NULLIF($4,'')||'-01')::date+INTERVAL '1 month') AT TIME ZONE a.timezone))
 AND ($5::text='' OR c.id::text=$5) AND ($6::text='' OR ap.id::text=$6)`
	args := []any{a, session, student, month, class, participant}
	if err := r.DB.QueryRow(ctx, "SELECT count(*)"+joins, args...).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := r.DB.Query(ctx, `SELECT p.id,COALESCE(st.id::text,''),p.session_id,c.name,COALESCE(st.name,u.name,'Participante'),
 COALESCE((SELECT student_rank_label(sm.belt,sm.degrees) FROM student_modalities sm WHERE sm.academy_id=st.academy_id AND sm.student_id=st.id AND sm.modality_id=c.modality_id),st.belt,'Sem graduação'),
 p.checked_in_at,COALESCE(m.name,''),s.starts_at,ap.id,ap.person_id,CASE WHEN p.recorded_by_user_id IS NOT NULL THEN 'manager' ELSE 'tablet' END`+joins+" ORDER BY s.starts_at DESC,p.checked_in_at DESC,p.id LIMIT $7 OFFSET $8", append(args, size, (page-1)*size)...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var v History
		if err = rows.Scan(&v.ID, &v.StudentID, &v.SessionID, &v.ClassName, &v.StudentName, &v.Belt, &v.CheckedInAt, &v.ModalityName, &v.StartsAt, &v.ParticipantID, &v.PersonID, &v.Source); err != nil {
			return out, err
		}
		out.Items = append(out.Items, v)
	}
	return out, rows.Err()
}
