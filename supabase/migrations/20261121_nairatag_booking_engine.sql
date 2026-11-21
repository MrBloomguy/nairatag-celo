-- ============================================================================
-- NairaTag Booking Engine — Production Database Migration Schema
-- Network: Celo Mainnet (Chain ID: 42220)
-- Target: Supabase / PostgreSQL 15+
-- ============================================================================

-- Enable btree_gist extension for range exclusion constraints (double-booking prevention)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Services Table
CREATE TABLE IF NOT EXISTS nairatag_services (
  id TEXT PRIMARY KEY,
  agent_tag TEXT NOT NULL,
  canonical_tag TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('fixed', 'hourly', 'per_session', 'quote')),
  price NUMERIC(18, 6) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USDT', 'cNGN', 'CELO')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  booking_mode TEXT NOT NULL CHECK (booking_mode IN ('instant', 'approval_required', 'request_quote')),
  availability_mode TEXT NOT NULL CHECK (availability_mode IN ('working_hours', 'fixed_slots', 'manual')),
  advance_payment_required BOOLEAN NOT NULL DEFAULT true,
  human_booking_enabled BOOLEAN NOT NULL DEFAULT true,
  agent_booking_enabled BOOLEAN NOT NULL DEFAULT true,
  requires_self_verification BOOLEAN NOT NULL DEFAULT false,
  cancellation_policy TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for marketplace discovery
CREATE INDEX IF NOT EXISTS idx_services_category_active ON nairatag_services (category, active);
CREATE INDEX IF NOT EXISTS idx_services_agent_tag ON nairatag_services (agent_tag);

-- 2. Bookings Table
CREATE TABLE IF NOT EXISTS nairatag_bookings (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES nairatag_services(id) ON DELETE RESTRICT,
  service_title TEXT NOT NULL,
  provider_agent_tag TEXT NOT NULL,
  provider_canonical_tag TEXT NOT NULL,
  category TEXT NOT NULL,
  customer_tag TEXT,
  customer_address TEXT,
  customer_name TEXT NOT NULL,
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('human', 'agent')),
  slot_start_time TIMESTAMPTZ NOT NULL,
  slot_end_time TIMESTAMPTZ NOT NULL CHECK (slot_end_time > slot_start_time),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price NUMERIC(18, 6) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USDT', 'cNGN', 'CELO')),
  pricing_model TEXT NOT NULL,
  booking_mode TEXT NOT NULL,
  cancellation_policy TEXT,
  customer_notes TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'draft',
      'pending_provider_approval',
      'pending_payment',
      'payment_processing',
      'confirmed',
      'in_progress',
      'completed',
      'rejected',
      'expired',
      'cancelled',
      'payment_failed',
      'refunded'
    )
  ),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'pending_settlement', 'settled', 'failed', 'refunded')),
  payment_tx_hash TEXT,
  requires_self_verification BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- DATABASE-LEVEL DOUBLE-BOOKING PREVENTATIVE EXCLUSION CONSTRAINT:
  -- Guarantees that two active reservations for the same service can NEVER overlap in time,
  -- regardless of concurrent requests across multiple server instances or process restarts.
  CONSTRAINT prevent_double_booking_overlap EXCLUDE USING gist (
    service_id WITH =,
    tstzrange(slot_start_time, slot_end_time) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'rejected', 'expired', 'payment_failed'))
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_bookings_customer_tag ON nairatag_bookings (customer_tag);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_tag ON nairatag_bookings (provider_agent_tag);
CREATE INDEX IF NOT EXISTS idx_bookings_status_expires ON nairatag_bookings (status, expires_at);

-- 3. Booking Payment Authorizations Table
CREATE TABLE IF NOT EXISTS nairatag_booking_authorizations (
  authorization_id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES nairatag_bookings(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES nairatag_services(id),
  provider_agent_tag TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  payment_token TEXT NOT NULL CHECK (payment_token IN ('USDT', 'cNGN', 'CELO')),
  token_address TEXT NOT NULL,
  amount NUMERIC(18, 6) NOT NULL CHECK (amount > 0),
  amount_atomic TEXT NOT NULL,
  recipient TEXT NOT NULL,
  requires_self_verification BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT false,
  payment_digest TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_booking_id ON nairatag_booking_authorizations (booking_id);

-- Row Level Security (RLS)
ALTER TABLE nairatag_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE nairatag_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nairatag_booking_authorizations ENABLE ROW LEVEL SECURITY;

-- Public read access to active services
CREATE POLICY p_services_public_read ON nairatag_services
  FOR SELECT USING (active = true);

-- Authenticated/public read for customer bookings
CREATE POLICY p_bookings_read ON nairatag_bookings
  FOR SELECT USING (true);
