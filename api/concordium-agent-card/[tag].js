import { createHash } from 'node:crypto';
import { createPublicClient, http, isAddress, verifyMessage } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { celo } from 'viem/chains';
import { CELO_NAIRATAG_REGISTRY_ADDRESS } from '../../src/config/celo.js';

const TABLE = 'nairatag_concordium_agent_cards';
const GENESIS_PREFIX = '4221332d34e1694168c2a0c0b3fd0f27';
const CIS8_CONTRACT = { index: 12801, subindex: 0 };
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const OWNER_OF_ABI = [{
  type: 'function', name: 'ownerOf', stateMutability: 'view',
  inputs: [{ name: 'tag', type: 'string' }], outputs: [{ name: '', type: 'address' }],
}];

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(JSON.stringify(body));
}

function normalizeTag(value) {
  const tag = String(value || '').trim().replace(/^[₦$@#]/, '').toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(tag) || tag.startsWith('_') || tag.endsWith('_') || tag.includes('__')) {
    throw new Error('Invalid NairaTag.');
  }
  return tag;
}

function requestOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim().toLowerCase();
  const allowedHosts = new Set(
    String(process.env.CONCORDIUM_CARD_ALLOWED_HOSTS || 'arc.nairatag.ng,celo.nairatag.ng,concordium.nairatag.ng')
      .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
  );
  if (!host || !allowedHosts.has(host) || protocol !== 'https') {
    throw new Error('This host is not configured for NairaTag Concordium cards.');
  }
  return `https://${host}`;
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server-side Supabase credentials are not configured.');
  return { url, key };
}

async function supabaseRequest(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${TABLE}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* Return a generic storage error below. */ }
  if (!response.ok) throw new Error(`Card database request failed (${response.status}).`);
  return payload;
}

async function callMcpOwnerOfKey(externalKey) {
  const response = await fetch('https://agent-registry-mcp.concordium.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: `nairatag-card-owner-${Date.now()}`, method: 'tools/call',
      params: { name: 'owner_of_key', arguments: { network: 'testnet', external_key: externalKey } },
    }),
  });
  if (!response.ok) throw new Error('Concordium CIS-8 lookup is temporarily unavailable.');
  const envelope = await response.json();
  const result = envelope.result;
  const text = result?.content?.find((item) => item.type === 'text')?.text;
  let value = result?.structuredContent;
  if (value === undefined && text !== undefined) {
    try { value = JSON.parse(text); } catch { throw new Error('Concordium returned an invalid CIS-8 lookup.'); }
  }
  if (!result || result.isError || value === undefined) throw new Error('Concordium CIS-8 lookup failed.');
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return value.owner_account || value.concordium_account
    || value.registration?.owner_account || value.registration?.concordium_account
    || value.owner || value.account || null;
}

function publishMessage({ tag, evmOwner, concordiumOwner, cardUrl, cardHash, externalKey, expectedVersion, nonce }) {
  return [
    'NairaTag Concordium Agent Card publish v1',
    `Tag: ${tag}`,
    `EVM owner: ${evmOwner.toLowerCase()}`,
    `Concordium owner: ${concordiumOwner}`,
    `EVM public key: ${externalKey.public_key_hex.toLowerCase()}`,
    `Card URL: ${cardUrl}`,
    `Card SHA-256: ${cardHash}`,
    `Expected version: ${expectedVersion}`,
    `One-time nonce: ${nonce}`,
    'This signature publishes Agent Card metadata only. It does not authorize a blockchain transaction or asset transfer.',
  ].join('\n');
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

async function assertTagOwner(tag, owner) {
  const client = createPublicClient({
    chain: celo,
    transport: http(process.env.CELO_MAINNET_RPC_URL || 'https://forno.celo.org'),
  });
  let onChainOwner;
  try {
    onChainOwner = await client.readContract({
      address: CELO_NAIRATAG_REGISTRY_ADDRESS,
      abi: OWNER_OF_ABI,
      functionName: 'ownerOf',
      args: [tag],
    });
  } catch {
    throw new Error('NairaTag owner verification is temporarily unavailable.');
  }
  if (!onChainOwner || normalizeAddress(onChainOwner) === ZERO_ADDRESS || normalizeAddress(onChainOwner) !== normalizeAddress(owner)) {
    throw new Error('The signing wallet does not own this NairaTag.');
  }
}

function validateCard(cardJson, cardHash, cardUrl, tag, concordiumOwner, externalKey) {
  if (typeof cardJson !== 'string' || Buffer.byteLength(cardJson, 'utf8') > 32768) {
    throw new Error('Agent Card JSON is missing or exceeds 32 KB.');
  }
  const actualHash = createHash('sha256').update(Buffer.from(cardJson, 'utf8')).digest('hex');
  if (!/^[0-9a-f]{64}$/.test(String(cardHash || '')) || actualHash !== cardHash) {
    throw new Error('Agent Card SHA-256 does not match its exact JSON bytes.');
  }
  let card;
  try { card = JSON.parse(cardJson); } catch { throw new Error('Agent Card JSON is invalid.'); }
  if (card.url !== cardUrl) throw new Error('Agent Card URL does not match the card endpoint.');

  const extensions = card.capabilities?.extensions || [];
  const concordium = extensions.find((extension) => String(extension.uri || '').includes('concordium-badge'))?.params;
  const expectedOwner = `ccd:${GENESIS_PREFIX}:${concordiumOwner}`;
  const cardKey = concordium?.externalReference;
  if (concordium?.owner?.account !== expectedOwner
    || concordium?.contracts?.cis8 !== `ccd:${GENESIS_PREFIX}:${CIS8_CONTRACT.index}.${CIS8_CONTRACT.subindex}`
    || cardKey?.kind !== 'Cis8'
    || cardKey?.namespace !== externalKey.namespace
    || cardKey?.identifier !== tag
    || cardKey?.contractAddress !== `ccd:${GENESIS_PREFIX}:${CIS8_CONTRACT.index}.${CIS8_CONTRACT.subindex}`) {
    throw new Error('Agent Card Concordium owner, CIS-8 reference, or tag does not match the signed request.');
  }
}

export default async function handler(req, res) {
  try {
    const tag = normalizeTag(Array.isArray(req.query?.tag) ? req.query.tag[0] : req.query?.tag);
    const origin = requestOrigin(req);
    const cardUrl = `${origin}/api/concordium-agent-card/${encodeURIComponent(tag)}`;
    const filter = `?select=tag,card_json,card_hash,evm_owner,concordium_owner,version,updated_at&tag=eq.${encodeURIComponent(tag)}&limit=1`;

    if (req.method === 'GET') {
      const rows = await supabaseRequest(filter);
      if (!rows?.length) return sendJson(res, 404, { error: 'No Concordium Agent Card is published for this tag.' });
      res.setHeader('ETag', `"${rows[0].card_hash}"`);
      res.setHeader('X-Card-Version', String(rows[0].version));
      res.setHeader('X-Card-Hash', rows[0].card_hash);
      res.setHeader('X-NairaTag-Owner', rows[0].evm_owner);
      res.setHeader('X-Concordium-Owner', rows[0].concordium_owner);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(rows[0].card_json);
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const evmOwner = String(body.evmOwner || '');
    const concordiumOwner = String(body.concordiumOwner || '').trim();
    const metadataHash = String(body.metadataHash || '').toLowerCase();
    const nonce = String(body.nonce || '').toLowerCase();
    const expectedVersion = Number(body.expectedVersion);
    const signature = String(body.signature || '');
    const externalKey = body.externalKey || {};

    if (!isAddress(evmOwner) || !concordiumOwner || !Number.isInteger(expectedVersion) || expectedVersion < 0
      || !/^[0-9a-f]{64}$/.test(nonce) || !/^0x[0-9a-fA-F]{130}$/.test(signature)
      || externalKey.namespace !== 'eip155:42220'
      || externalKey.key_type !== 'secp256k1-uncompressed'
      || !/^04[0-9a-fA-F]{128}$/.test(externalKey.public_key_hex || '')) {
      return sendJson(res, 400, { error: 'The signed card publication details are incomplete.' });
    }
    validateCard(body.cardJson, metadataHash, cardUrl, tag, concordiumOwner, externalKey);

    let matchingPublicKey;
    try {
      matchingPublicKey = normalizeAddress(publicKeyToAddress(`0x${externalKey.public_key_hex}`)) === normalizeAddress(evmOwner);
    } catch {
      matchingPublicKey = false;
    }
    if (!matchingPublicKey) return sendJson(res, 403, { error: 'The CIS-8 public key does not match the NairaTag owner wallet.' });

    const validSignature = await verifyMessage({
      address: evmOwner,
      message: publishMessage({
        tag, evmOwner, concordiumOwner, cardUrl, cardHash: metadataHash, externalKey, expectedVersion, nonce,
      }),
      signature,
    }).catch(() => false);
    if (!validSignature) return sendJson(res, 401, { error: 'NairaTag owner wallet signature is invalid.' });

    await assertTagOwner(tag, evmOwner);
    const boundOwner = await callMcpOwnerOfKey(externalKey);
    // Concordium account addresses are Base58 and must be compared case-sensitively.
    if (!boundOwner || String(boundOwner).trim() !== concordiumOwner) {
      return sendJson(res, 403, { error: 'The CIS-8 key is not bound to this Concordium account on Testnet.' });
    }

    const record = {
      tag,
      card_json: body.cardJson,
      card_hash: metadataHash,
      evm_owner: evmOwner.toLowerCase(),
      concordium_owner: concordiumOwner,
      version: expectedVersion + 1,
      last_publish_nonce: nonce,
      updated_at: new Date().toISOString(),
    };
    let saved;
    if (expectedVersion === 0) {
      saved = await supabaseRequest('?on_conflict=tag&select=tag,version,card_hash,updated_at', {
        method: 'POST', body: record, prefer: 'resolution=ignore-duplicates,return=representation',
      });
    } else {
      saved = await supabaseRequest(`?tag=eq.${encodeURIComponent(tag)}&version=eq.${expectedVersion}&select=tag,version,card_hash,updated_at`, {
        method: 'PATCH', body: record, prefer: 'return=representation',
      });
    }
    if (!saved?.length) return sendJson(res, 409, { error: 'Card version changed or this publication was already used. Reload the current card before publishing again.' });
    return sendJson(res, 200, { success: true, tag, version: saved[0].version, cardHash: saved[0].card_hash, cardUrl });
  } catch (error) {
    console.error('[Concordium Agent Card API]', error?.name || 'Error');
    return sendJson(res, 503, { error: 'Concordium card service is temporarily unavailable. Check its server configuration and try again.' });
  }
}
