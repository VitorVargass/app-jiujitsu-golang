-- +goose Up
CREATE TABLE account_deletion_requests (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','completed')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 operator_reference text,
 CHECK((status='completed')=(completed_at IS NOT NULL))
);
ALTER TABLE users ADD COLUMN deleted_at timestamptz;

-- The operator must first execute the case-specific data treatment. The
-- reference identifies a restricted record of verification and retention.
-- +goose StatementBegin
CREATE FUNCTION complete_account_deletion(request_id uuid, case_reference text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE uid uuid; pid uuid; state text;
BEGIN
 IF case_reference IS NULL OR length(btrim(case_reference)) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'restricted case reference required'; END IF;
 SELECT user_id,status INTO uid,state FROM account_deletion_requests WHERE id=request_id FOR UPDATE;
 IF uid IS NULL THEN RAISE EXCEPTION 'request not found'; END IF;
 IF state='completed' THEN RETURN; END IF;
 IF state<>'reviewing' THEN RAISE EXCEPTION 'review required'; END IF;
 SELECT person_id INTO pid FROM users WHERE id=uid FOR UPDATE;
 -- Require explicit handoff of all management roles. No creator/owner model
 -- exists in this schema. Sole managers require separate support treatment.
 IF EXISTS(SELECT 1 FROM memberships m JOIN membership_roles r ON r.membership_id=m.id WHERE m.user_id=uid AND m.status='active' AND r.role='admin') THEN
  RAISE EXCEPTION 'explicit academy responsibility handoff or separate closure required';
 END IF;
 DELETE FROM auth_sessions WHERE user_id=uid;
 DELETE FROM student_guardians WHERE user_id=uid;
 DELETE FROM guardian_profiles WHERE user_id=uid;
 DELETE FROM membership_requests WHERE user_id=uid;
 DELETE FROM enrollment_submissions WHERE user_id=uid;
 DELETE FROM checkin_events WHERE principal_id=uid;
 DELETE FROM account_legal_acceptances WHERE user_id=uid;
 UPDATE student_invitations SET revoked_at=COALESCE(revoked_at,now())
 WHERE accepted_by=uid OR (accepted_at IS NULL AND student_id IN(SELECT id FROM students WHERE person_id=pid));
 UPDATE students SET user_id=NULL WHERE user_id=uid;
 DELETE FROM membership_roles WHERE membership_id IN(SELECT id FROM memberships WHERE user_id=uid);
 -- Remove roles first to avoid the legacy student lifecycle trigger.
 UPDATE memberships SET status='blocked',qr_token=gen_random_uuid()::text WHERE user_id=uid;
 UPDATE academy_participants SET qr_token=gen_random_uuid()::text WHERE person_id=pid;
 UPDATE people SET email=NULL WHERE id=pid;
 UPDATE users SET name='Conta excluída',password_hash='!',deleted_at=now() WHERE id=uid;
 -- Shared device tokens belong to academies, not the requesting user.
 UPDATE account_deletion_requests SET status='completed',completed_at=now(),operator_reference=case_reference WHERE id=request_id;
END $$;
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION complete_account_deletion(uuid,text);
ALTER TABLE users DROP COLUMN deleted_at;
DROP TABLE account_deletion_requests;
