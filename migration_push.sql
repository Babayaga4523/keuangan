-- ============================================================
-- MIGRATION: WEB PUSH NOTIFICATION BILL REMINDERS
-- ============================================================

-- 1. Enum Channel Pengingat
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_channel') THEN
        CREATE TYPE reminder_channel AS ENUM ('webpush', 'telegram', 'email');
    END IF;
END$$;

-- 2. Skema Tabel Push Subscriptions (Composite Unique)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile     VARCHAR(50) NOT NULL CHECK (profile IN ('yoga', 'silva')),
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_endpoint_profile UNIQUE (endpoint, profile)
);

-- 3. Modifikasi recurring_transactions
ALTER TABLE recurring_transactions 
ADD COLUMN IF NOT EXISTS reminder_offsets INT[] DEFAULT '{3,1,0}',
ADD COLUMN IF NOT EXISTS notify_profiles VARCHAR(50)[] DEFAULT NULL;

-- 4. Skema Tabel Logs Notifikasi
CREATE TABLE IF NOT EXISTS bill_reminder_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id      UUID NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    offset_days  INT NOT NULL,
    period_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    channel      reminder_channel NOT NULL DEFAULT 'webpush',
    sent_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_reminder UNIQUE (bill_id, offset_days, period_month, channel)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_profile ON push_subscriptions(profile);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_bill ON bill_reminder_logs(bill_id);
