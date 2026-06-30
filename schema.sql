-- ============================================================
-- BLUEPRINT v2.0 — Sistem Keuangan Pribadi (Amanah Finance)
-- Stack: Supabase PostgreSQL
-- ============================================================

-- ============================================================
-- CLEANUP: Drop existing objects (fresh install)
-- ============================================================
DROP TRIGGER IF EXISTS trg_saving_goals_updated_at ON saving_goals;
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
DROP FUNCTION IF EXISTS fn_fund_saving_goal(UUID, UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS fn_delete_transaction(UUID);
DROP FUNCTION IF EXISTS fn_create_transfer(UUID, UUID, DECIMAL, TEXT, DATE);
DROP FUNCTION IF EXISTS fn_create_transaction(UUID, UUID, DECIMAL, transaction_type, TEXT, DATE);
DROP FUNCTION IF EXISTS fn_update_timestamp();
DROP FUNCTION IF EXISTS increment_balance(UUID, DECIMAL);
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS saving_goals CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TYPE IF EXISTS account_type;
DROP TYPE IF EXISTS transaction_type;

-- ============================================================
-- SECTION 1: TYPES
-- ============================================================
CREATE TYPE transaction_type AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE account_type AS ENUM ('CASH', 'BANK', 'E_WALLET');

-- ============================================================
-- SECTION 2: TABLES
-- ============================================================

-- 2A. Rekening / Dompet
CREATE TABLE accounts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    type         account_type NOT NULL DEFAULT 'CASH',
    balance      DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency     VARCHAR(3) NOT NULL DEFAULT 'IDR',
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    profile      VARCHAR(50) DEFAULT 'silva',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- 2B. Kategori Transaksi
CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(10) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    icon       VARCHAR(50),
    color      VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2C. Transaksi Utama
CREATE TABLE transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id             UUID REFERENCES categories(id) ON DELETE SET NULL,
    destination_account_id  UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    amount                  DECIMAL(15, 2) NOT NULL,
    type                    transaction_type NOT NULL,
    transaction_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    description             TEXT,
    profile                 VARCHAR(50) DEFAULT 'silva',
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT transfer_needs_destination
        CHECK (type != 'TRANSFER' OR destination_account_id IS NOT NULL),
    CONSTRAINT non_transfer_no_destination
        CHECK (type = 'TRANSFER' OR destination_account_id IS NULL),
    CONSTRAINT no_self_transfer
        CHECK (account_id IS DISTINCT FROM destination_account_id),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- 2D. Target Tabungan
CREATE TABLE saving_goals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(100) NOT NULL,
    target_amount  DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
    deadline       DATE,
    is_completed   BOOLEAN NOT NULL DEFAULT FALSE,
    profile        VARCHAR(50) DEFAULT 'silva',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 3: INDEXES (Performance)
-- ============================================================
CREATE INDEX idx_transactions_account_id    ON transactions(account_id);
CREATE INDEX idx_transactions_dest_account  ON transactions(destination_account_id);
CREATE INDEX idx_transactions_date          ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_type          ON transactions(type);
CREATE INDEX idx_transactions_category      ON transactions(category_id);

-- ============================================================
-- SECTION 4: TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_saving_goals_updated_at
    BEFORE UPDATE ON saving_goals
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ============================================================
-- SECTION 5: ATOMIC POSTGRESQL FUNCTIONS
-- ============================================================

-- FN 1: CREATE INCOME / EXPENSE (dengan row-level lock & cek saldo)
CREATE OR REPLACE FUNCTION fn_create_transaction(
    p_account_id  UUID,
    p_category_id UUID,
    p_amount      DECIMAL(15, 2),
    p_type        transaction_type,
    p_description TEXT,
    p_date        DATE
)
RETURNS UUID AS $$
DECLARE
    v_tx_id          UUID;
    v_current_balance DECIMAL(15, 2);
BEGIN
    SELECT balance INTO v_current_balance
    FROM accounts WHERE id = p_account_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Akun tidak ditemukan: %', p_account_id;
    END IF;

    IF p_type = 'EXPENSE' AND v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Saldo tidak mencukupi. Saldo: Rp %, Dibutuhkan: Rp %',
            v_current_balance, p_amount;
    END IF;

    INSERT INTO transactions (account_id, category_id, amount, type, transaction_date, description)
    VALUES (p_account_id, p_category_id, p_amount, p_type, p_date, p_description)
    RETURNING id INTO v_tx_id;

    UPDATE accounts
    SET balance = balance + CASE WHEN p_type = 'INCOME' THEN p_amount ELSE -p_amount END
    WHERE id = p_account_id;

    RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;


-- FN 2: CREATE TRANSFER (atomic, deadlock-safe)
CREATE OR REPLACE FUNCTION fn_create_transfer(
    p_from_account_id UUID,
    p_to_account_id   UUID,
    p_amount          DECIMAL(15, 2),
    p_description     TEXT,
    p_date            DATE
)
RETURNS UUID AS $$
DECLARE
    v_tx_id        UUID;
    v_from_balance DECIMAL(15, 2);
BEGIN
    IF p_from_account_id = p_to_account_id THEN
        RAISE EXCEPTION 'Akun sumber dan tujuan tidak boleh sama';
    END IF;

    -- Lock kedua akun dengan urutan UUID konsisten (cegah deadlock)
    IF p_from_account_id < p_to_account_id THEN
        SELECT balance INTO v_from_balance FROM accounts WHERE id = p_from_account_id FOR UPDATE;
        PERFORM id FROM accounts WHERE id = p_to_account_id FOR UPDATE;
    ELSE
        PERFORM id FROM accounts WHERE id = p_to_account_id FOR UPDATE;
        SELECT balance INTO v_from_balance FROM accounts WHERE id = p_from_account_id FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Satu atau kedua akun tidak ditemukan';
    END IF;

    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'Saldo tidak mencukupi untuk transfer. Saldo: Rp %, Dibutuhkan: Rp %',
            v_from_balance, p_amount;
    END IF;

    INSERT INTO transactions (
        account_id, destination_account_id, amount, type, transaction_date, description
    )
    VALUES (p_from_account_id, p_to_account_id, p_amount, 'TRANSFER', p_date, p_description)
    RETURNING id INTO v_tx_id;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_from_account_id;
    UPDATE accounts SET balance = balance + p_amount WHERE id = p_to_account_id;

    RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;


-- FN 3: DELETE TRANSACTION (dengan rollback saldo otomatis)
CREATE OR REPLACE FUNCTION fn_delete_transaction(p_tx_id UUID)
RETURNS VOID AS $$
DECLARE
    v_tx transactions%ROWTYPE;
BEGIN
    SELECT * INTO v_tx FROM transactions WHERE id = p_tx_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaksi tidak ditemukan: %', p_tx_id;
    END IF;

    CASE v_tx.type
        WHEN 'INCOME' THEN
            UPDATE accounts SET balance = balance - v_tx.amount WHERE id = v_tx.account_id;
        WHEN 'EXPENSE' THEN
            UPDATE accounts SET balance = balance + v_tx.amount WHERE id = v_tx.account_id;
        WHEN 'TRANSFER' THEN
            UPDATE accounts SET balance = balance + v_tx.amount WHERE id = v_tx.account_id;
            UPDATE accounts SET balance = balance - v_tx.amount WHERE id = v_tx.destination_account_id;
    END CASE;

    DELETE FROM transactions WHERE id = p_tx_id;
END;
$$ LANGUAGE plpgsql;


-- FN 4: FUND SAVING GOAL (setor ke tabungan dari rekening)
CREATE OR REPLACE FUNCTION fn_fund_saving_goal(
    p_account_id  UUID,
    p_goal_id     UUID,
    p_amount      DECIMAL(15, 2),
    p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_balance        DECIMAL(15, 2);
    v_goal_remaining DECIMAL(15, 2);
BEGIN
    SELECT balance INTO v_balance FROM accounts WHERE id = p_account_id FOR UPDATE;
    SELECT (target_amount - current_amount) INTO v_goal_remaining
        FROM saving_goals WHERE id = p_goal_id FOR UPDATE;

    IF v_balance IS NULL OR v_goal_remaining IS NULL THEN
        RAISE EXCEPTION 'Akun atau target tabungan tidak ditemukan';
    END IF;

    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Saldo tidak mencukupi untuk setor tabungan. Saldo: Rp %, Dibutuhkan: Rp %',
            v_balance, p_amount;
    END IF;

    IF p_amount > v_goal_remaining THEN
        RAISE EXCEPTION 'Jumlah melebihi sisa target tabungan (sisa: Rp %)', v_goal_remaining;
    END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id;

    UPDATE saving_goals
    SET
        current_amount = current_amount + p_amount,
        is_completed   = (current_amount + p_amount >= target_amount)
    WHERE id = p_goal_id;

    INSERT INTO transactions (account_id, amount, type, transaction_date, description)
    VALUES (p_account_id, p_amount, 'EXPENSE', CURRENT_DATE,
            COALESCE(p_description, 'Setoran tabungan'));
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 6: SEED DATA
-- ============================================================
INSERT INTO accounts (name, type, balance) VALUES
('Dompet Utama (Cash)', 'CASH', 500000.00),
('Bank BCA', 'BANK', 2500000.00),
('Bank Mandiri', 'BANK', 1500000.00);

INSERT INTO categories (name, type, icon, color) VALUES
('Makanan & Minuman', 'EXPENSE', 'restaurant', '#ef4444'),
('Transportasi', 'EXPENSE', 'directions_car', '#f97316'),
('Belanja Bulanan', 'EXPENSE', 'shopping_cart', '#eab308'),
('Kesehatan', 'EXPENSE', 'medical_services', '#22c55e'),
('Hiburan', 'EXPENSE', 'sports_esports', '#a855f7'),
('Tagihan & Utilitas', 'EXPENSE', 'receipt_long', '#64748b'),
('Gaji & Pendapatan', 'INCOME', 'payments', '#10b981'),
('Investasi', 'INCOME', 'trending_up', '#3b82f6'),
('Bonus', 'INCOME', 'card_giftcard', '#f59e0b');

INSERT INTO saving_goals (name, target_amount, current_amount, deadline) VALUES
('Dana Darurat', 10000000.00, 3500000.00, '2027-06-01'),
('Umroh', 25000000.00, 8000000.00, '2027-12-31');

-- ============================================================
-- SECTION 7: PROFILE PROPAGATION TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION tr_set_transaction_profile()
RETURNS TRIGGER AS $$
BEGIN
    SELECT profile INTO NEW.profile FROM accounts WHERE id = NEW.account_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tg_set_transaction_profile
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION tr_set_transaction_profile();
