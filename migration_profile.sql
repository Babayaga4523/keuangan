-- SQL Migration: Menambahkan Multi-Profile (Silva & Yoga)

-- 1. Tambahkan kolom profile ke tabel accounts (default 'silva')
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS profile VARCHAR(50) DEFAULT 'silva';

-- 2. Tambahkan kolom profile ke tabel saving_goals (default 'silva')
ALTER TABLE saving_goals ADD COLUMN IF NOT EXISTS profile VARCHAR(50) DEFAULT 'silva';

-- 3. Tambahkan kolom profile ke tabel transactions (default 'silva')
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS profile VARCHAR(50) DEFAULT 'silva';

-- 4. Buat fungsi trigger untuk menyalin profile dari tabel accounts ke transactions secara otomatis
CREATE OR REPLACE FUNCTION tr_set_transaction_profile()
RETURNS TRIGGER AS $$
BEGIN
    SELECT profile INTO NEW.profile FROM accounts WHERE id = NEW.account_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Daftarkan trigger ke tabel transactions
DROP TRIGGER IF EXISTS tg_set_transaction_profile ON transactions;
CREATE TRIGGER tg_set_transaction_profile
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION tr_set_transaction_profile();

-- 6. Inisialisasi rekening awal untuk Yoga (agar datanya terpisah)
INSERT INTO accounts (id, name, type, balance, currency, is_active, profile)
VALUES 
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SeaBank (Yoga)', 'BANK', 2000000.00, 'IDR', true, 'yoga'),
  ('f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', 'GoPay (Yoga)', 'BANK', 1000000.00, 'IDR', true, 'yoga')
ON CONFLICT (id) DO UPDATE SET balance = EXCLUDED.balance;

-- 7. Inisialisasi target tabungan awal untuk Yoga (agar datanya terpisah)
INSERT INTO saving_goals (id, name, target_amount, current_amount, icon, deadline, profile)
VALUES 
  ('12345678-1234-1234-1234-123456789012', 'Dana Darurat (Yoga)', 15000000.00, 2000000.00, 'Shield', '2026-12-31', 'yoga'),
  ('87654321-4321-4321-4321-210987654321', 'Beli Motor (Yoga)', 25000000.00, 5000000.00, 'TrendingUp', '2027-06-30', 'yoga')
ON CONFLICT (id) DO NOTHING;
