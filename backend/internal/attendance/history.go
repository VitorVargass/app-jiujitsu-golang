package attendance

import (
	"context"
	"tatame/backend/internal/core"
)

func (r Repository) PagedHistory(ctx context.Context, a, session, student, month, class string, page, size int) (core.Page[History], error) {
	out := core.Page[History]{Items: []History{}, Page: page, PageSize: size}
	joins := ` FROM attendances p JOIN class_sessions s ON s.id=p.session_id AND s.academy_id=p.academy_id JOIN classes c ON c.id=s.class_id AND c.academy_id=s.academy_id JOIN students st ON st.id=p.membership_id AND st.academy_id=p.academy_id JOIN academies a ON a.id=p.academy_id LEFT JOIN modalities m ON m.id=c.modality_id AND m.academy_id=c.academy_id
 WHERE p.academy_id=$1 AND ($2::text='' OR p.session_id::text=$2) AND ($3::text='' OR st.id::text=$3) AND ($4::text='' OR p.checked_in_at>=((NULLIF($4,'')||'-01')::date::timestamp AT TIME ZONE a.timezone) AND p.checked_in_at<(((NULLIF($4,'')||'-01')::date+INTERVAL '1 month') AT TIME ZONE a.timezone)) AND ($5::text='' OR c.id::text=$5)`
	args := []any{a, session, student, month, class}
	if e := r.DB.QueryRow(ctx, "SELECT count(*)"+joins, args...).Scan(&out.Total); e != nil {
		return out, e
	}
	rows, e := r.DB.Query(ctx, "SELECT p.id,st.id,p.session_id,c.name,st.name,COALESCE((SELECT student_rank_label(sm.belt,sm.degrees) FROM student_modalities sm WHERE sm.academy_id=st.academy_id AND sm.student_id=st.id AND sm.modality_id=c.modality_id),st.belt),p.checked_in_at,COALESCE(m.name,''),s.starts_at"+joins+" ORDER BY p.checked_in_at DESC,p.id LIMIT $6 OFFSET $7", append(args, size, (page-1)*size)...)
	if e != nil {
		return out, e
	}
	defer rows.Close()
	for rows.Next() {
		var v History
		if e = rows.Scan(&v.ID, &v.StudentID, &v.SessionID, &v.ClassName, &v.StudentName, &v.Belt, &v.CheckedInAt, &v.ModalityName, &v.StartsAt); e != nil {
			return out, e
		}
		out.Items = append(out.Items, v)
	}
	return out, rows.Err()
}
