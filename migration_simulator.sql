-- Migration untuk menyimpan konfigurasi Simulator secara persisten per profil
-- Jalankan kode ini di Supabase SQL Editor Anda

CREATE TABLE IF NOT EXISTS public.simulator_configs (
    profile TEXT NOT NULL PRIMARY KEY,
    selected_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.simulator_configs ENABLE ROW LEVEL SECURITY;

-- Create policies (mengizinkan read/write terbuka karena app ini dikontrol via cookies lokal)
CREATE POLICY "Enable all actions for simulator configs" ON public.simulator_configs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create trigger untuk auto-update kolom updated_at
CREATE OR REPLACE FUNCTION update_simulator_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_simulator_configs_updated_at
    BEFORE UPDATE ON public.simulator_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_simulator_configs_updated_at();
