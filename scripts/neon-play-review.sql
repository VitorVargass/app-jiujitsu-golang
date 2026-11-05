-- Execute o arquivo inteiro no SQL Editor do Neon, no banco usado pela API.
-- Senha da conta de revisao definida conforme solicitado pelo responsavel.
-- Requer o esquema atual do projeto (migracoes ate 019).
-- Cria apenas uma conta administradora e uma academia vazia de demonstracao.
-- Acesso de cortesia ate 05/11/2036, sem registrar pagamento ficticio.
-- Nao registra aceite de termos em nome do revisor e nao conecta bancos.
-- Reexecucao com o mesmo email/codigo aborta sem modificar contas existentes.

ROLLBACK;
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '5s';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $review$
DECLARE
  review_email text := 'googleplay-review@tatamemix.com.br';
  review_password text := 'tatamemix123';
  person_uuid uuid := gen_random_uuid();
  user_uuid uuid := gen_random_uuid();
  academy_uuid uuid := gen_random_uuid();
  membership_uuid uuid := gen_random_uuid();
  password_bcrypt text;
BEGIN
  IF octet_length(review_password) NOT BETWEEN 8 AND 72 THEN
    RAISE EXCEPTION 'A senha deve ter de 8 a 72 bytes.';
  END IF;

  -- Serializa execucoes deste script; nao reaproveita identidades existentes.
  PERFORM pg_advisory_xact_lock(hashtextextended('tatamemix:googleplay-review', 0));
  IF EXISTS (SELECT 1 FROM people WHERE email = review_email)
     OR EXISTS (SELECT 1 FROM academies WHERE code = 'playreview') THEN
    RAISE EXCEPTION 'Conta ou academia de revisao ja existe. Nada foi alterado; nao sobrescreva a conta.';
  END IF;

  password_bcrypt := crypt(review_password, gen_salt('bf', 12));
  IF crypt(review_password, password_bcrypt) IS DISTINCT FROM password_bcrypt THEN
    RAISE EXCEPTION 'Falha na verificacao da senha.';
  END IF;

  INSERT INTO people(id, email) VALUES (person_uuid, review_email);
  INSERT INTO users(id, person_id, name, password_hash)
  VALUES (user_uuid, person_uuid, 'Google Play Reviewer', password_bcrypt);

  INSERT INTO academies(id, name, code, timezone)
  VALUES (academy_uuid, 'TatameMix Demo - Google Play', 'playreview', 'America/Sao_Paulo');

  -- NULL no trial evita a regra de bloqueio apos o teste de cinco dias.
  -- Renovacao desligada evita gerar um ciclo de cobranca ao abrir a assinatura.
  INSERT INTO platform_subscriptions(
    academy_id, selected_plan_id, trial_ends_at, paid_until,
    billing_day, renewal_enabled
  ) VALUES (
    academy_uuid, 'large', NULL, '2036-11-05 00:00:00+00', 5, false
  );

  -- Triggers do projeto geram o numero de cinco digitos e o participante.
  INSERT INTO memberships(id, academy_id, user_id, status, student_code, qr_token)
  VALUES (membership_uuid, academy_uuid, user_uuid, 'active', '00000',
          encode(gen_random_bytes(32), 'hex'));
  INSERT INTO membership_roles(membership_id, role)
  VALUES (membership_uuid, 'admin');

  INSERT INTO modalities(id, academy_id, name, belt_options)
  SELECT gen_random_uuid(), academy_uuid, name, default_belt_options(name)
  FROM (VALUES ('Jiu-Jitsu'), ('No-Gi'), ('Muay Thai')) AS items(name);

  IF NOT EXISTS (
    SELECT 1 FROM academy_participants
    WHERE academy_id = academy_uuid AND person_id = person_uuid
  ) THEN
    RAISE EXCEPTION 'Participante nao foi criado pelos triggers. Transacao cancelada.';
  END IF;
END
$review$;

COMMIT;

-- Resultado esperado: uma linha; papel admin; trial NULL; acesso ate 2036.
SELECT p.email, u.name, a.name AS academy, a.id AS academy_id,
       m.status, r.role, s.selected_plan_id, s.trial_ends_at,
       s.paid_until AS complimentary_access_until, s.renewal_enabled
FROM people p
JOIN users u ON u.person_id = p.id
JOIN memberships m ON m.user_id = u.id
JOIN academies a ON a.id = m.academy_id
JOIN membership_roles r ON r.membership_id = m.id
JOIN platform_subscriptions s ON s.academy_id = a.id
WHERE p.email = 'googleplay-review@tatamemix.com.br'
  AND a.code = 'playreview';

