package auth

import (
	"context"
	"tatame/backend/internal/core"
	"testing"
)

func TestRegistrationRejectsMissingAcknowledgementAndMismatchBeforeDatabase(t *testing.T) {
	s := Service{}
	for _, c := range []Credentials{
		{Password: "Password123!", PasswordConfirmation: "different", TermsVersion: core.LegalVersion, PrivacyVersion: core.LegalVersion},
		{Password: "Password123!", PasswordConfirmation: "Password123!"},
		{Password: "Password123!", PasswordConfirmation: "Password123!", TermsVersion: "old", PrivacyVersion: core.LegalVersion},
	} {
		if _, err := s.Register(context.Background(), c); err == nil {
			t.Fatal("invalid registration accepted")
		}
	}
}
