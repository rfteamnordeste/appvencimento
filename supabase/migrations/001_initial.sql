-- ============================================================
-- RF Team — Migration 001: Schema inicial + RLS
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: academies
-- ============================================================
CREATE TABLE IF NOT EXISTS academies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  pix_key     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'America/Fortaleza',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: profiles
-- Liga o usuário Supabase Auth a uma academia
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id  UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- TABELA: students
-- ============================================================
CREATE TYPE student_status AS ENUM ('active', 'inactive');

CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id    UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone_raw     TEXT NOT NULL,
  phone_e164    TEXT NOT NULL,
  due_day       SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  monthly_value NUMERIC(10,2),
  status        student_status NOT NULL DEFAULT 'active',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_academy_id ON students(academy_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

-- ============================================================
-- TABELA: billing_cycles
-- Ciclos de vencimento calculados por aluno/mês
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_cycles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  due_date    DATE NOT NULL,
  cycle_key   TEXT NOT NULL UNIQUE, -- academy_id||student_id||due_date (idempotência)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_cycles_student_id ON billing_cycles(student_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_due_date ON billing_cycles(due_date);

-- ============================================================
-- TABELA: message_templates
-- ============================================================
CREATE TYPE reminder_type AS ENUM ('d10', 'd5', 'd0');

CREATE TABLE IF NOT EXISTS message_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id    UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  reminder_type reminder_type NOT NULL,
  content       TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(academy_id, reminder_type)
);

-- ============================================================
-- TABELA: reminder_logs
-- ============================================================
CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE reminder_channel AS ENUM ('whatsapp_link', 'whatsapp_api');

CREATE TABLE IF NOT EXISTS reminder_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_cycle_id UUID REFERENCES billing_cycles(id) ON DELETE SET NULL,
  reminder_type    reminder_type NOT NULL,
  scheduled_for    DATE NOT NULL,
  sent_at          TIMESTAMPTZ,
  status           reminder_status NOT NULL DEFAULT 'pending',
  channel          reminder_channel NOT NULL DEFAULT 'whatsapp_link',
  wa_link          TEXT,
  message_text     TEXT,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_student_id ON reminder_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_scheduled_for ON reminder_logs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_status ON reminder_logs(status);

-- ============================================================
-- FUNÇÃO: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_academies_updated_at
  BEFORE UPDATE ON academies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: retorna o academy_id do usuário logado
CREATE OR REPLACE FUNCTION get_user_academy_id()
RETURNS UUID AS $$
  SELECT academy_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- academies
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academies_select_own" ON academies
  FOR SELECT USING (id = get_user_academy_id());

CREATE POLICY "academies_update_own" ON academies
  FOR UPDATE USING (id = get_user_academy_id());

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

-- students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_select_own" ON students
  FOR SELECT USING (academy_id = get_user_academy_id());

CREATE POLICY "students_insert_own" ON students
  FOR INSERT WITH CHECK (academy_id = get_user_academy_id());

CREATE POLICY "students_update_own" ON students
  FOR UPDATE USING (academy_id = get_user_academy_id());

-- billing_cycles (acesso via student)
ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_cycles_select_own" ON billing_cycles
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE academy_id = get_user_academy_id())
  );

CREATE POLICY "billing_cycles_insert_own" ON billing_cycles
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE academy_id = get_user_academy_id())
  );

-- message_templates
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_own" ON message_templates
  FOR SELECT USING (academy_id = get_user_academy_id());

CREATE POLICY "templates_insert_own" ON message_templates
  FOR INSERT WITH CHECK (academy_id = get_user_academy_id());

CREATE POLICY "templates_update_own" ON message_templates
  FOR UPDATE USING (academy_id = get_user_academy_id());

-- reminder_logs (acesso via student)
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminder_logs_select_own" ON reminder_logs
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE academy_id = get_user_academy_id())
  );

CREATE POLICY "reminder_logs_insert_own" ON reminder_logs
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE academy_id = get_user_academy_id())
  );

CREATE POLICY "reminder_logs_update_own" ON reminder_logs
  FOR UPDATE USING (
    student_id IN (SELECT id FROM students WHERE academy_id = get_user_academy_id())
  );
