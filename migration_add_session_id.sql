-- ============================================================
-- MIGRATION: Add Chat Sessions support
-- Jalankan perintah ini di Supabase SQL Editor Anda
-- ============================================================

-- 1. Tambahkan kolom session_id ke chat_messages dengan nilai default 'default'
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id VARCHAR(100) DEFAULT 'default';

-- 2. Buat index baru untuk performa query pencarian sesi
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(profile, session_id);
