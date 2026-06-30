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

-- 6. Inisialisasi rekening awal untuk Yoga
INSERT INTO accounts (id, name, type, balance, currency, is_active, profile)
VALUES 
  ('6a084c0c-b9b5-4b53-93d3-157dc2095f9c', 'SeaBank (Yoga)', 'BANK', 2000000.00, 'IDR', true, 'yoga'),
  ('87e6fa89-4081-4202-b258-c5b967ffbb3e', 'GoPay (Yoga)', 'BANK', 1000000.00, 'IDR', true, 'yoga')
ON CONFLICT (id) DO UPDATE SET balance = EXCLUDED.balance;

-- 7. Inisialisasi target tabungan awal untuk Yoga (Tanpa kolom 'icon')
INSERT INTO saving_goals (id, name, target_amount, current_amount, deadline, profile)
VALUES 
  ('d4b8f596-f6b9-43c2-a42e-1d54e8cb2f54', 'Dana Darurat (Yoga)', 15000000.00, 2000000.00, '2026-12-31', 'yoga'),
  ('4f29ea12-9c31-41bb-b02e-6d9b04ab2f34', 'Beli Motor (Yoga)', 25000000.00, 5000000.00, '2027-06-30', 'yoga')
ON CONFLICT (id) DO NOTHING;
