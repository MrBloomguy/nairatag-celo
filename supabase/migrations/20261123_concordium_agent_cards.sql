-- Durable public Agent Card bytes for the Concordium Testnet integration.
-- Writes and reads are performed only by the Vercel API using Supabase's
-- server-side service role. Browser clients receive no direct table access.

CREATE TABLE IF NOT EXISTS public.nairatag_concordium_agent_cards (
  tag TEXT PRIMARY KEY CHECK (tag ~ '^[a-z0-9_]{3,32}$' AND tag !~ '^_' AND tag !~ '_$' AND tag !~ '__'),
  card_json TEXT NOT NULL CHECK (octet_length(card_json) <= 32768),
  card_hash TEXT NOT NULL CHECK (card_hash ~ '^[0-9a-f]{64}$'),
  evm_owner TEXT NOT NULL CHECK (evm_owner ~ '^0x[0-9a-f]{40}$'),
  concordium_owner TEXT NOT NULL CHECK (length(concordium_owner) BETWEEN 32 AND 64),
  version INTEGER NOT NULL CHECK (version > 0),
  last_publish_nonce TEXT NOT NULL UNIQUE CHECK (last_publish_nonce ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nairatag_concordium_agent_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nairatag_concordium_agent_cards FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.nairatag_concordium_agent_cards FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.nairatag_concordium_agent_cards TO service_role;

COMMENT ON TABLE public.nairatag_concordium_agent_cards IS
  'Versioned Concordium Agent Card JSON. Public reads are served by the API; no browser direct access.';
