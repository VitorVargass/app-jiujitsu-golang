package academies

type Academy struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Code         string   `json:"code"`
	Timezone     string   `json:"timezone"`
	MembershipID string   `json:"membership_id"`
	Roles        []string `json:"roles"`
	Status       string   `json:"status"`
	Belt         string   `json:"belt"`
}
type CreateInput struct {
	Name     string `json:"name"`
	Timezone string `json:"timezone"`
}
