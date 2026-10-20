package payments

import (
	"net/http"
	"tatame/backend/internal/core"
)

func (h Handler) Discount(w http.ResponseWriter, r *http.Request) {
	var in DiscountInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Manager.Discount(r.Context(), r.PathValue("academy"), r.PathValue("invoice"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) ManualPayment(w http.ResponseWriter, r *http.Request) {
	var in ManualPaymentInput
	if e := core.Decode(w, r, &in); e != nil {
		core.Fail(w, e)
		return
	}
	v, e := h.Manager.ManualPayment(r.Context(), r.PathValue("academy"), r.PathValue("invoice"), in)
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
func (h Handler) History(w http.ResponseWriter, r *http.Request) {
	v, e := h.Manager.History(r.Context(), r.PathValue("academy"), r.PathValue("invoice"))
	if e != nil {
		core.Fail(w, e)
		return
	}
	core.Write(w, 200, v)
}
