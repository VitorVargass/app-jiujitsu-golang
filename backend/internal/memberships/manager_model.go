package memberships

type Manager struct {
	IsOwner   bool   `json:"is_owner"`
	CanRemove bool   `json:"can_remove"`
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Status    string `json:"status"`
}

type CreateManagerInput struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	LinkExisting bool   `json:"link_existing"`
}
