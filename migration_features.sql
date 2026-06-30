-- ============================================================
-- MIGRATION: 4 High Impact Features
-- Jalankan di Supabase SQL Editor (Production / Vercel Database)
-- ============================================================

-- 1. Tambah kolom low_balance_threshold ke accounts
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS low_balance_threshold DECIMAL(15,2) DEFAULT 0;

-- 2. Buat tabel budgets
CREATE TABLE IF NOT EXISTS budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount       DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  month        INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INT NOT NULL CHECK (year >= 2020),
  profile      VARCHAR(50) NOT NULL DEFAULT 'silva',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, month, year, profile)
);

-- 3. Buat tabel recurring_transactions
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount        DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  type          transaction_type NOT NULL,
  description   TEXT,
  frequency     VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'
                CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY')),
  day_of_month  INT CHECK (day_of_month BETWEEN 1 AND 28),
  next_due      DATE NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  profile       VARCHAR(50) NOT NULL DEFAULT 'silva',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index untuk performa
CREATE INDEX IF NOT EXISTS idx_budgets_profile_month 
  ON budgets(profile, year, month);
CREATE INDEX IF NOT EXISTS idx_recurring_next_due 
  ON recurring_transactions(next_due, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_profile 
  ON recurring_transactions(profile);

-- 5. PostgreSQL function: fn_update_transaction (edit transaksi + rollback saldo)
CREATE OR REPLACE FUNCTION fn_update_transaction(
    p_tx_id       UUID,
    p_amount      DECIMAL(15,2),
    p_category_id UUID,
    p_description TEXT,
    p_date        DATE
)
RETURNS VOID AS $$
DECLARE
    v_old_amount  DECIMAL(15,2);
    v_old_type    transaction_type;
    v_account_id  UUID;
BEGIN
    SELECT amount, type, account_id
    INTO v_old_amount, v_old_type, v_account_id
    FROM transactions
    WHERE id = p_tx_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaksi tidak ditemukan: %', p_tx_id;
    END IF;

    IF v_old_type = 'TRANSFER' THEN
        RAISE EXCEPTION 'Transaksi transfer tidak bisa diedit, hapus dan buat ulang';
    END IF;

    -- Rollback saldo lama
    UPDATE accounts
    SET balance = balance + CASE 
        WHEN v_old_type = 'INCOME' THEN -v_old_amount 
        ELSE v_old_amount 
    END
    WHERE id = v_account_id;

    -- Apply saldo baru
    UPDATE accounts
    SET balance = balance + CASE 
        WHEN v_old_type = 'INCOME' THEN p_amount 
        ELSE -p_amount 
    END
    WHERE id = v_account_id;

    -- Cek saldo tidak negatif
    IF EXISTS (SELECT 1 FROM accounts WHERE id = v_account_id AND balance < 0) THEN
        RAISE EXCEPTION 'Saldo tidak mencukupi setelah edit transaksi';
    END IF;

    -- Update data transaksi
    UPDATE transactions
    SET amount           = p_amount,
        category_id      = p_category_id,
        description      = p_description,
        transaction_date = p_date
    WHERE id = p_tx_id;
END;
$$ LANGUAGE plpgsql;
