-- +goose Up
-- Configurable ranks: the academy can replace these presets without rewriting student history.
-- +goose StatementBegin
CREATE FUNCTION default_belt_options(modality_name text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN lower(modality_name) LIKE '%jiu%' OR lower(modality_name) LIKE '%bjj%'
 OR replace(replace(lower(modality_name),'-',''),' ','') LIKE '%nogi%'
 THEN '[{"label":"Faixa Branca","colors":["#F5F5F5"]},{"label":"Faixa Cinza e Branca","colors":["#929292","#F5F5F5"]},{"label":"Faixa Cinza","colors":["#929292"]},{"label":"Faixa Cinza e Preta","colors":["#929292","#151515"]},{"label":"Faixa Amarela e Branca","colors":["#E5C432","#F5F5F5"]},{"label":"Faixa Amarela","colors":["#E5C432"]},{"label":"Faixa Amarela e Preta","colors":["#E5C432","#151515"]},{"label":"Faixa Laranja e Branca","colors":["#DF842F","#F5F5F5"]},{"label":"Faixa Laranja","colors":["#DF842F"]},{"label":"Faixa Laranja e Preta","colors":["#DF842F","#151515"]},{"label":"Faixa Verde e Branca","colors":["#368552","#F5F5F5"]},{"label":"Faixa Verde","colors":["#368552"]},{"label":"Faixa Verde e Preta","colors":["#368552","#151515"]},{"label":"Faixa Azul","colors":["#386DCE"]},{"label":"Faixa Roxa","colors":["#885BB0"]},{"label":"Faixa Marrom","colors":["#855B3A"]},{"label":"Faixa Preta","colors":["#151515"]},{"label":"Faixa Vermelha e Preta","colors":["#BD3434","#151515"]},{"label":"Faixa Vermelha e Branca","colors":["#BD3434","#F5F5F5"]},{"label":"Faixa Vermelha","colors":["#BD3434"]}]'::jsonb ELSE '[]'::jsonb END
$$;
-- +goose StatementEnd
ALTER TABLE modalities ADD COLUMN amount_cents bigint NOT NULL DEFAULT 0 CHECK(amount_cents BETWEEN 0 AND 100000000);
ALTER TABLE modalities ADD COLUMN belt_options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(belt_options)='array');
UPDATE modalities SET belt_options=default_belt_options(name);
ALTER TABLE students ADD COLUMN alternate_phone text NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN charge_mode text NOT NULL DEFAULT 'custom' CHECK(charge_mode IN('custom','plan','modalities'));
ALTER TABLE student_modalities ADD COLUMN belt text NOT NULL DEFAULT '';
ALTER TABLE student_modalities ADD COLUMN amount_cents bigint NOT NULL DEFAULT 0 CHECK(amount_cents BETWEEN 0 AND 100000000);
UPDATE student_modalities sm SET belt=s.belt FROM students s, modalities m
 WHERE sm.academy_id=s.academy_id AND sm.student_id=s.id
 AND m.academy_id=sm.academy_id AND m.id=sm.modality_id AND jsonb_array_length(m.belt_options)>0;
ALTER TABLE student_billing DROP CONSTRAINT student_billing_amount_cents_check;
ALTER TABLE student_billing ADD CHECK(amount_cents BETWEEN 0 AND 100000000 AND (NOT enabled OR amount_cents>0));
-- Existing contracts remain custom; no invoice or billing activation is created by this migration.
-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN RAISE EXCEPTION 'Restore a backup instead of discarding modality ranks and contracted prices'; END $$;
-- +goose StatementEnd
