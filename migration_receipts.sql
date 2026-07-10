-- ============================================================
-- MIGRATION: RECEIPT SCANNER LOGS & ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS receipt_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_hash       VARCHAR(64) UNIQUE NOT NULL,
    transaction_id   UUID REFERENCES transactions(id) ON DELETE SET NULL,
    profile          VARCHAR(50) DEFAULT 'silva',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_image_hash UNIQUE (image_hash)
);

CREATE TABLE IF NOT EXISTS receipt_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_log_id   UUID REFERENCES receipt_logs(id) ON DELETE CASCADE,
    name             VARCHAR(200) NOT NULL,
    price            DECIMAL(15, 2) NOT NULL,
    qty              INTEGER NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index for duplicate check optimization
CREATE INDEX IF NOT EXISTS idx_receipt_logs_hash ON receipt_logs(image_hash);
