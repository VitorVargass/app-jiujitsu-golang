package memberships

type Request struct {
	ID          string `json:"id"`
	AcademyID   string `json:"academy_id"`
	AcademyName string `json:"academy_name"`
	UserID      string `json:"user_id"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	Status      string `json:"status"`
}
type RequestInput struct {
	AcademyCode string `json:"academy_code"`
	Role        string `json:"role"`
}
type Decision struct {
	Status string `json:"status"`
}
type Update struct {
	Status string   `json:"status"`
	Roles  []string `json:"roles"`
	Belt   string   `json:"belt"`
}
