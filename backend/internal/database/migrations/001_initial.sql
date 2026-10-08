-- +goose Up
CREATE TABLE users (
 id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE academies (
 id uuid PRIMARY KEY, name text NOT NULL, code text NOT NULL UNIQUE,
 timezone text NOT NULL DEFAULT 'America/Sao_Paulo', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id),
 user_id uuid NOT NULL REFERENCES users(id), status text NOT NULL CHECK(status IN('active','blocked')),
 belt text NOT NULL DEFAULT 'Faixa Branca', student_code text NOT NULL, qr_token text NOT NULL UNIQUE,
 UNIQUE(academy_id,user_id), UNIQUE(academy_id,student_code), UNIQUE(academy_id,id)
);
CREATE TABLE membership_roles (
 membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN('student','teacher','admin')), PRIMARY KEY(membership_id,role)
);
CREATE TABLE membership_requests (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id),
 user_id uuid NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN('student','teacher')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(academy_id,user_id,role)
);
CREATE TABLE classes (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id),
 name text NOT NULL, teacher_membership_id uuid NOT NULL, active boolean NOT NULL DEFAULT true,
 UNIQUE(academy_id,id),
 FOREIGN KEY(academy_id,teacher_membership_id) REFERENCES memberships(academy_id,id)
);
CREATE TABLE class_schedules (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, class_id uuid NOT NULL,
 weekday int NOT NULL CHECK(weekday BETWEEN 0 AND 6), start_time time NOT NULL,
 duration_minutes int NOT NULL CHECK(duration_minutes BETWEEN 15 AND 240),
 FOREIGN KEY(academy_id,class_id) REFERENCES classes(academy_id,id),
 UNIQUE(academy_id,class_id,weekday,start_time), UNIQUE(academy_id,class_id,id)
);
CREATE TABLE class_sessions (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, class_id uuid NOT NULL,
 schedule_id uuid NOT NULL, starts_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN('open','closed','cancelled')),
 FOREIGN KEY(academy_id,class_id,schedule_id) REFERENCES class_schedules(academy_id,class_id,id),
 UNIQUE(academy_id,class_id,starts_at), UNIQUE(academy_id,id)
);
CREATE TABLE devices (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES academies(id),
 name text NOT NULL, token_hash text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE attendances (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, session_id uuid NOT NULL, membership_id uuid NOT NULL,
 recorded_by_user_id uuid REFERENCES users(id), device_id uuid REFERENCES devices(id),
 checked_in_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(academy_id,session_id) REFERENCES class_sessions(academy_id,id),
 FOREIGN KEY(academy_id,membership_id) REFERENCES memberships(academy_id,id),
 UNIQUE(academy_id,session_id,membership_id)
);
CREATE TABLE checkin_events (
 academy_id uuid NOT NULL REFERENCES academies(id), principal_id uuid NOT NULL,
 event_key uuid NOT NULL, payload_hash text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(academy_id,principal_id,event_key)
);
CREATE INDEX attendances_academy_time ON attendances(academy_id,checked_in_at);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX sessions_academy_time ON class_sessions(academy_id,starts_at);

-- +goose Down
DROP TABLE checkin_events, attendances, devices, class_sessions, class_schedules,
 classes, membership_requests, membership_roles, memberships, academies, auth_sessions, users;
