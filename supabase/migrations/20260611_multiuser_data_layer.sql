-- Multi-user data layer: profiles, user attribution, RLS

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  color        text NOT NULL DEFAULT '#F59E0B'
);

INSERT INTO profiles (id, display_name, color) VALUES
  ('35f1ad46-2264-40d0-beba-c5895daaa649', 'Dominik', '#8B5CF6'),
  ('a0ed7ff1-0c39-4ddb-8045-ec904ce5afcb', 'Lukas',   '#3B82F6')
ON CONFLICT (id) DO NOTHING;

-- 2. User attribution + Gebiet on sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gebiet  text;

UPDATE sessions
SET user_id = 'a0ed7ff1-0c39-4ddb-8045-ec904ce5afcb'
WHERE user_id IS NULL;

-- 3. User attribution + GPS + do-not-return on contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id          uuid REFERENCES auth.users(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lat              double precision;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lng              double precision;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS do_not_return    boolean;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS do_not_return_note text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS do_not_return_at   timestamptz;

UPDATE contacts
SET user_id = 'a0ed7ff1-0c39-4ddb-8045-ec904ce5afcb'
WHERE user_id IS NULL;

-- 4. Note field on door_taps
ALTER TABLE door_taps ADD COLUMN IF NOT EXISTS note text;

-- 5. Expand door_taps outcome to include nie_wieder (and all values already in use)
ALTER TABLE door_taps DROP CONSTRAINT IF EXISTS door_taps_outcome_check;
ALTER TABLE door_taps ADD CONSTRAINT door_taps_outcome_check
  CHECK (outcome = ANY (ARRAY[
    'nicht_da','kein_int','gesprach','kontakt','termin',
    'kein_zugang','wiedervorlage','nie_wieder'
  ]));

-- 6. Expand call_attempts: result field + user attribution
ALTER TABLE call_attempts ADD COLUMN IF NOT EXISTS result  text;
ALTER TABLE call_attempts DROP CONSTRAINT IF EXISTS call_attempts_result_check;
ALTER TABLE call_attempts ADD CONSTRAINT call_attempts_result_check
  CHECK (result IS NULL OR result = ANY (ARRAY[
    'termin','kein_int','spaeter','schon_kunde','falsche_nummer'
  ]));
ALTER TABLE call_attempts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 7. Row Level Security

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE door_taps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_attempts ENABLE ROW LEVEL SECURITY;

-- Drop before recreate (idempotent)
DROP POLICY IF EXISTS "profiles_read_all"       ON profiles;
DROP POLICY IF EXISTS "profiles_edit_own"       ON profiles;
DROP POLICY IF EXISTS "sessions_read_all"       ON sessions;
DROP POLICY IF EXISTS "sessions_write_own"      ON sessions;
DROP POLICY IF EXISTS "contacts_read_all"       ON contacts;
DROP POLICY IF EXISTS "contacts_write_own"      ON contacts;
DROP POLICY IF EXISTS "door_taps_read_all"      ON door_taps;
DROP POLICY IF EXISTS "door_taps_write_own"     ON door_taps;
DROP POLICY IF EXISTS "call_attempts_read_all"  ON call_attempts;
DROP POLICY IF EXISTS "call_attempts_write_own" ON call_attempts;

-- profiles: read all, edit own
CREATE POLICY "profiles_read_all"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_edit_own"
  ON profiles FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- sessions: read all, write own
CREATE POLICY "sessions_read_all"
  ON sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_write_own"
  ON sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- contacts: read all, write own
CREATE POLICY "contacts_read_all"
  ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contacts_write_own"
  ON contacts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- door_taps: read all, write via session ownership
CREATE POLICY "door_taps_read_all"
  ON door_taps FOR SELECT TO authenticated USING (true);
CREATE POLICY "door_taps_write_own"
  ON door_taps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = door_taps.session_id
        AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = door_taps.session_id
        AND sessions.user_id = auth.uid()
    )
  );

-- call_attempts: read all, write own
CREATE POLICY "call_attempts_read_all"
  ON call_attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "call_attempts_write_own"
  ON call_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
