-- ─────────────────────────────────────────────────────────────
--  Activity Tracker — Supabase / PostgreSQL Schema
--  Run this once in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- 1. Core tables ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activities (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  emoji        TEXT NOT NULL,
  color        TEXT NOT NULL,
  enabled      BOOLEAN DEFAULT true,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id               BIGSERIAL PRIMARY KEY,
  activity_id      BIGINT NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  date             DATE NOT NULL,
  duration_minutes REAL DEFAULT 60,
  transport_cost   REAL DEFAULT 0,
  total_cost       REAL DEFAULT 0,
  data             JSONB DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment (
  id             BIGSERIAL PRIMARY KEY,
  activity_id    BIGINT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  emoji          TEXT,
  total_cost     REAL NOT NULL DEFAULT 0,
  cost_model     TEXT NOT NULL DEFAULT 'per_session',  -- 'per_session' | 'hourly'
  units_per_pack INTEGER DEFAULT 1,
  hours_per_unit REAL DEFAULT 1,
  amort_sessions INTEGER DEFAULT 30,
  active         BOOLEAN DEFAULT true,
  UNIQUE(activity_id, name)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS activity_expenses (
  id          BIGSERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  category    TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_activity_id      ON sessions(activity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date             ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_activity_date    ON sessions(activity_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_data             ON sessions USING gin(data);
CREATE INDEX IF NOT EXISTS idx_equipment_activity_id     ON equipment(activity_id);
CREATE INDEX IF NOT EXISTS idx_expenses_activity_id      ON activity_expenses(activity_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date             ON activity_expenses(date);

-- 3. Disable RLS (personal app — access controlled by backend)

ALTER TABLE activities        DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment         DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings          DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_expenses DISABLE ROW LEVEL SECURITY;

-- 4. Seed activities ──────────────────────────────────────────

INSERT INTO activities (slug, display_name, emoji, color, sort_order) VALUES
  ('badminton', 'Badminton', '🏸', '#22c55e', 0),
  ('swimming',  'Swimming',  '🏊', '#3b82f6', 1),
  ('gym',       'Gym',       '💪', '#f97316', 2),
  ('run',       'Run',       '🏃', '#ef4444', 3),
  ('cricket',   'Cricket',   '🏏', '#a855f7', 4)
ON CONFLICT (slug) DO NOTHING;

-- 5. Seed equipment ───────────────────────────────────────────

INSERT INTO equipment (activity_id, name, display_name, emoji, total_cost, cost_model, units_per_pack, hours_per_unit, amort_sessions)
SELECT id, 'shuttle', 'Shuttle', '🏸', 1400, 'hourly',      6, 3, NULL FROM activities WHERE slug='badminton'
ON CONFLICT (activity_id, name) DO NOTHING;

INSERT INTO equipment (activity_id, name, display_name, emoji, total_cost, cost_model, units_per_pack, hours_per_unit, amort_sessions)
SELECT id, 'racket', 'Racket', '🏓', 1500, 'per_session', 1, 1,    22 FROM activities WHERE slug='badminton'
ON CONFLICT (activity_id, name) DO NOTHING;

INSERT INTO equipment (activity_id, name, display_name, emoji, total_cost, cost_model, units_per_pack, hours_per_unit, amort_sessions)
SELECT id, 'shoe', 'Shoe', '👟', 1000, 'per_session',   1, 1,    22 FROM activities WHERE slug='badminton'
ON CONFLICT (activity_id, name) DO NOTHING;

INSERT INTO equipment (activity_id, name, display_name, emoji, total_cost, cost_model, units_per_pack, hours_per_unit, amort_sessions)
SELECT id, 'ball', 'Ball', '🏏', 600,  'hourly',        6, 4,  NULL FROM activities WHERE slug='cricket'
ON CONFLICT (activity_id, name) DO NOTHING;

INSERT INTO equipment (activity_id, name, display_name, emoji, total_cost, cost_model, units_per_pack, hours_per_unit, amort_sessions)
SELECT id, 'bat', 'Bat', '🪵', 2000, 'per_session',    1, 1,    40 FROM activities WHERE slug='cricket'
ON CONFLICT (activity_id, name) DO NOTHING;

-- 6. Seed default password (SHA-256 of 'admin') ───────────────

INSERT INTO settings (key, value)
VALUES ('password_hash', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918')
ON CONFLICT (key) DO NOTHING;
