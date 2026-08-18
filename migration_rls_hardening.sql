-- ============================================================
-- 🛡️ MIGRATION: Supabase Row-Level Security (RLS) Hardening
-- Jalankan skrip ini di Supabase SQL Editor (SQL Editor > New query > Run)
-- ============================================================

-- 1. Enable RLS pada seluruh tabel utama
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE saving_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 2. Hapus policy lama jika ada (Clean Slate)
DROP POLICY IF EXISTS "Deny anon write accounts" ON accounts;
DROP POLICY IF EXISTS "Deny anon update accounts" ON accounts;
DROP POLICY IF EXISTS "Service role full access accounts" ON accounts;
DROP POLICY IF EXISTS "Allow select categories" ON categories;

-- 3. Policy: Public/Anon hanya boleh membaca categories publik
CREATE POLICY "Allow select categories" 
ON categories FOR SELECT 
TO anon, authenticated 
USING (true);

-- 4. Policy: Izinkan akses penuh hanya untuk Service Role (Backend Next.js)
-- Catatan: Backend Next.js menggunakan SUPABASE_SERVICE_ROLE_KEY sehingga otomatis bypass RLS secara aman.
-- Policy di bawah memastikan anon/public client dari browser TIDAK BISA insert/update/delete data keuangan sembarangan.

CREATE POLICY "Service role full access accounts" 
ON accounts FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role full access transactions" 
ON transactions FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role full access budgets" 
ON budgets FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role full access saving_goals" 
ON saving_goals FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role full access recurring_transactions" 
ON recurring_transactions FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
