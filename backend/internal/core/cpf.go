package core

import "strings"

// NormalizeCPF accepts a bare or formatted CPF. Empty is valid for legacy records.
func NormalizeCPF(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", true
	}
	var digits strings.Builder
	for _, r := range value {
		switch {
		case r >= '0' && r <= '9':
			digits.WriteRune(r)
		case r == '.' || r == '-' || r == ' ':
		default:
			return "", false
		}
	}
	n := digits.String()
	if len(n) != 11 || n == strings.Repeat(n[:1], 11) {
		return "", false
	}
	for length := 9; length <= 10; length++ {
		sum := 0
		for i := 0; i < length; i++ {
			sum += int(n[i]-'0') * (length + 1 - i)
		}
		check := 11 - sum%11
		if check >= 10 {
			check = 0
		}
		if check != int(n[length]-'0') {
			return "", false
		}
	}
	return n, true
}
