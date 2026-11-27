-- Persistent storage for NairaTag Agent Identities, Self ID verification, Altana Smart Wallets, and Scoped Session Permissions
CREATE TABLE IF NOT EXISTS public.nairatag_agent_identities (
  tag TEXT PRIMARY KEY,
  owner_address TEXT,
  altana_wallet_address TEXT,
  self_verified BOOLEAN NOT NULL DEFAULT FALSE,
  session_status TEXT NOT NULL DEFAULT 'unprovisioned',
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nairatag_agent_identities_owner
  ON public.nairatag_agent_identities (LOWER(owner_address));

CREATE INDEX IF NOT EXISTS idx_nairatag_agent_identities_altana_wallet
  ON public.nairatag_agent_identities (LOWER(altana_wallet_address));

ALTER TABLE public.nairatag_agent_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read agent identities" ON public.nairatag_agent_identities;
CREATE POLICY "Public read agent identities"
  ON public.nairatag_agent_identities
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role full access agent identities" ON public.nairatag_agent_identities;
CREATE POLICY "Service role full access agent identities"
  ON public.nairatag_agent_identities
  FOR ALL
  USING (true)
  WITH CHECK (true);
