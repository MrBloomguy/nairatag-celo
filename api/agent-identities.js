/**
 * @file api/agent-identities.js
 * @description Persistent PostgreSQL REST API for NairaTag Agent Identities,
 * Self ID verification state, Altana Smart Wallets, and Session Permissions.
 * Backed by Supabase `nairatag_agent_identities`.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bbpdupijsgdghemfpijr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_3mRhhwX9BhnJyobyCX7uWw_h2-idCPf';

const PROHIBITED_SECRET_KEYS = new Set([
  'privateKey',
  'private_key',
  'secret',
  'secretKey',
  'secret_key',
  'seed',
  'mnemonic',
  'signerKey',
  'signer_key',
  'passkeySecret',
]);

function assertZeroSecrets(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (PROHIBITED_SECRET_KEYS.has(key)) {
      throw new Error(`SECURITY_VIOLATION: Prohibited secret key '${currentPath}'`);
    }
    if (value && typeof value === 'object') {
      assertZeroSecrets(value, currentPath);
    }
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const base = SUPABASE_URL.replace(/\/$/, '');
  const endpoint = `${base}/rest/v1/nairatag_agent_identities`;

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const rawTag = req.query?.tag;
      const queryUrl = rawTag
        ? `${endpoint}?tag=eq.${encodeURIComponent(String(rawTag).replace(/^[₦$@#]/, '').toLowerCase())}&select=*`
        : `${endpoint}?select=*&order=updated_at.desc`;

      const response = await fetch(queryUrl, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.status(response.status).json({ ok: false, error: text || `Supabase query failed (${response.status})` });
      }

      const rows = await response.json();
      return res.status(200).json({ ok: true, count: rows.length, rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const normalizedTag = String(body.tag || body.record?.tag || '').trim().replace(/^[₦$@#]/, '').toLowerCase();
      if (!normalizedTag) {
        return res.status(400).json({ ok: false, error: 'Valid agent tag is required.' });
      }

      const record = body.record || body;
      assertZeroSecrets(record);

      const payload = {
        tag: normalizedTag,
        owner_address: record.ownerAddress || null,
        altana_wallet_address: record.altana?.walletAddress || null,
        self_verified: Boolean(record.self?.verified),
        session_status: record.altana?.sessionStatus || 'unprovisioned',
        record: { ...record, tag: normalizedTag, updatedAt: Date.now() },
        updated_at: new Date().toISOString(),
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.status(response.status).json({ ok: false, error: text || `Supabase upsert failed (${response.status})` });
      }

      const saved = await response.json();
      return res.status(200).json({ ok: true, row: saved?.[0] || payload });
    }

    if (req.method === 'DELETE') {
      const normalizedTag = String(req.query?.tag || '').trim().replace(/^[₦$@#]/, '').toLowerCase();
      if (!normalizedTag) {
        return res.status(400).json({ ok: false, error: 'Valid agent tag is required.' });
      }

      const response = await fetch(`${endpoint}?tag=eq.${encodeURIComponent(normalizedTag)}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.status(response.status).json({ ok: false, error: text || `Supabase delete failed (${response.status})` });
      }

      return res.status(200).json({ ok: true, deleted: normalizedTag });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Internal server error' });
  }
}
