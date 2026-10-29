-- +goose Up
-- Do not merge or delete existing identities automatically.
-- +goose StatementBegin
DO $$ BEGIN
 IF EXISTS(SELECT cpf FROM academy_participants WHERE cpf<>'' GROUP BY cpf HAVING count(DISTINCT person_id)>1) THEN
  RAISE EXCEPTION 'global_cpf_conflict: review existing CPF identities before applying migration 017';
 END IF;
END $$;
-- +goose StatementEnd
CREATE INDEX participants_cpf_lookup ON academy_participants(cpf) WHERE cpf<>'';
-- +goose StatementBegin
CREATE FUNCTION enforce_global_cpf_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.cpf='' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tatamemix:cpf:'||NEW.cpf,0));
 IF EXISTS(SELECT 1 FROM academy_participants WHERE cpf=NEW.cpf AND person_id<>NEW.person_id) THEN
  RAISE EXCEPTION USING ERRCODE='23505',CONSTRAINT='participants_global_cpf_identity',MESSAGE='CPF already belongs to an existing identity';
 END IF;
 RETURN NEW;
END $$;
-- +goose StatementEnd
CREATE TRIGGER participants_global_cpf_identity BEFORE INSERT OR UPDATE OF cpf,person_id
 ON academy_participants FOR EACH ROW EXECUTE FUNCTION enforce_global_cpf_identity();

-- +goose Down
DROP TRIGGER participants_global_cpf_identity ON academy_participants;
DROP FUNCTION enforce_global_cpf_identity();
DROP INDEX participants_cpf_lookup;
