package auth

type User struct {
	PasswordChangeRequired bool   `json:"password_change_required"`
	PersonID               string `json:"person_id"`
	ID                     string `json:"id"`
	Name                   string `json:"name"`
	Email                  string `json:"email"`
}
type Credentials struct {
	PasswordConfirmation string `json:"password_confirmation"`
	TermsVersion         string `json:"terms_version"`
	PrivacyVersion       string `json:"privacy_version"`
	Name                 string `json:"name"`
	Email                string `json:"email"`
	Password             string `json:"password"`
}
type LoginResult struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
