package devices

type Device struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}
type Input struct {
	Name string `json:"name"`
}
type Credential struct {
	ID        string `json:"id"`
	Token     string `json:"token"`
	AcademyID string `json:"academy_id"`
	Name      string `json:"name"`
}
