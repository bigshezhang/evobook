-- Add mode column to onboarding_sessions if it doesn't exist
ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS mode TEXT;

COMMENT ON COLUMN onboarding_sessions.mode IS 'Deep | Fast | Light';
