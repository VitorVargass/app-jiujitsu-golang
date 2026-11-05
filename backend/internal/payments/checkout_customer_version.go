package payments

import (
	"context"
	"fmt"
	"tatame/backend/internal/billing"
	"time"
)

func (p *InfinitePay) currentResult(ctx context.Context, c checkoutAttempt, invoice billing.Invoice) (CheckoutResult, error) {
	if c.State != "ready" || !time.Now().Before(c.Expires) {
		return c.result(), nil
	}
	_, fingerprint, err := p.customerForInvoice(ctx, c.Academy, invoice)
	if err != nil {
		return CheckoutResult{}, err
	}
	return c.resultForCustomer(fingerprint), nil
}

func (c checkoutAttempt) resultForCustomer(fingerprint string) CheckoutResult {
	result := c.result()
	if c.State != "ready" || result.Expired || (c.CustomerFingerprint != "" && c.CustomerFingerprint == fingerprint) {
		return result
	}
	result.CustomerChanged = true
	result.Status = "review"
	result.URL = ""
	result.Retryable = false
	remaining := int(time.Until(c.Expires).Minutes()) + 1
	reason := "Os dados do aluno ou pagador mudaram após a emissão."
	if c.CustomerFingerprint == "" {
		reason = "Este link antigo não tem verificação da versão dos dados."
	}
	result.Reason = fmt.Sprintf("%s A InfinitePay não permite editar ou cancelar o link já emitido. Aguarde cerca de %d minuto(s) e gere um novo link com os dados atuais. Se já houve pagamento, confira antes de tentar novamente.", reason, remaining)
	return result
}
