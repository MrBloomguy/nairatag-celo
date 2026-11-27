/**
 * @file api/agent-card.js
 * @description Combined ERC-8004 & A2A Agent Registration JSON endpoint (`agentURI`).
 * Indexers like 8004scan.xyz and A2A clients read this document to discover the agent's
 * Self Agent ID proof status, Altana smart wallet capabilities, and A2A/MCP endpoints.
 */

import { generateRegistrationJSON } from '@selfxyz/agent-sdk';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bbpdupijsgdghemfpijr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_3mRhhwX9BhnJyobyCX7uWw_h2-idCPf';
const SELF_REGISTRY_CELO_MAINNET = '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944';
const ALTANA_CELO_KEYSTORE = '0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rawTag = String(req.query?.tag || 'nairatag').trim().replace(/^[₦$@#]/, '').toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(rawTag)) {
    return res.status(400).json({ error: 'Invalid agent tag' });
  }

  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host || 'celo.nairatag.ng';
  const host = String(forwardedHost).split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const origin = `${proto}://${host}`;

  let record = null;
  try {
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/nairatag_agent_identities?tag=eq.${encodeURIComponent(rawTag)}&select=*`;
    const dbRes = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (dbRes.ok) {
      const rows = await dbRes.json();
      record = rows?.[0]?.record || null;
    }
  } catch {
    // Fall back to default metadata if DB lookup is unreachable
  }

  const canonicalName = record?.name || `₦${rawTag.toUpperCase()}`;
  const description = record?.description || `Human-backed sovereign NairaTag agent (₦${rawTag.toUpperCase()}) verified via Self Protocol with an Altana smart wallet on Celo Mainnet.`;
  const image = `https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=${encodeURIComponent(rawTag)}`;
  const a2aEndpoint = `${origin}/api/a2a?tag=${encodeURIComponent(rawTag)}`;
  const mcpEndpoint = `${origin}/api/mcp?tag=${encodeURIComponent(rawTag)}`;
  const webEndpoint = `${origin}/agent/${encodeURIComponent(rawTag)}`;

  const registrationDoc = generateRegistrationJSON({
    name: canonicalName,
    description,
    image,
    services: [
      { name: 'A2A', endpoint: a2aEndpoint, version: '0.3.0' },
      { name: 'MCP', endpoint: mcpEndpoint, version: '1.0' },
      { name: 'web', endpoint: webEndpoint },
    ],
    a2a: {
      version: '1.0.0',
      url: a2aEndpoint,
      provider: { name: 'NairaTag Protocol', url: origin },
      capabilities: { streaming: false, pushNotifications: false },
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
    },
  });

  const agentId = record?.self?.agentId ?? record?.erc8004?.tokenId ?? null;
  const active = record ? Boolean(record.self?.verified) : rawTag === 'nairatag';

  const combined = {
    ...registrationDoc,
    active,
    security: [{ bearer: [] }],
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
      {
        id: 'nairatag-pay',
        name: 'NairaTag Stablecoin Settlement',
        description: 'Receive and send USD₮ / cNGN on Celo Mainnet via Altana session keys and Textile FX.',
        tags: ['payments', 'celo', 'altana', 'usdt', 'cngn'],
      },
    ],
    registrations: agentId != null
      ? [{ agentId: Number(agentId) || agentId, agentRegistry: `eip155:42220:${SELF_REGISTRY_CELO_MAINNET}` }]
      : [{ agentRegistry: `eip155:42220:${SELF_REGISTRY_CELO_MAINNET}` }],
    supportedTrust: ['reputation', 'crypto-economic'],
    altana: {
      walletAddress: record?.altana?.walletAddress || null,
      keystoreAddress: ALTANA_CELO_KEYSTORE,
      sessionStatus: record?.altana?.sessionStatus || 'unprovisioned',
      allowedActions: record?.altana?.allowedActions || { send: false, swap: false, unlimited: false },
    },
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  return res.status(200).json(combined);
}
