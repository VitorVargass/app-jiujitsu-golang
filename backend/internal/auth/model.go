package auth

type User struct {
	PersonID string `json:"person_id"`
	ID       string `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
}
type Credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}
type LoginResult struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
