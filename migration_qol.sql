-- ============================================================
-- MIGRATION: Quality of Life (QoL) Features
-- Jalankan di Supabase SQL Editor (Production / Vercel Database)
-- ============================================================

-- 1. Tambah kolom receipt_url dan tags ke tabel transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT;
