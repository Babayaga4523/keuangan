-- ============================================================
-- MIGRATION: Chat History
-- Jalankan di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile VARCHAR(50) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Add index for faster queries by profile and date
CREATE INDEX IF NOT EXISTS idx_chat_messages_profile ON chat_messages(profile, created_at DESC);
