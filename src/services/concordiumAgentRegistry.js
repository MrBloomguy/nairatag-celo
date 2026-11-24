const CONCORDIUM_REGISTRY_API = 'https://agent-registry-mcp.concordium.com';
const CONCORDIUM_MCP_API = `${CONCORDIUM_REGISTRY_API}/mcp`;
const NAIRATAG_EVM_NAMESPACE = 'eip155:42220';
const CIS8_PROOF_SCHEME = 'ethereum-personal-sign';
const CIS8_KEY_TYPE = 'secp256k1-uncompressed';

export const CONCORDIUM_TESTNET = Object.freeze({
  network: 'testnet',
  name: 'Concordium Testnet',
  genesisHash: '4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796',
  explorer: 'https://testnet.ccdscan.io',
  cis8004: Object.freeze({ index: 12802, subindex: 0 }),
  cis8: Object.freeze({ index: 12801, subindex: 0 }),
});

const CIS8004_RECEIVE_NAME = 'CIS-8004.register';
const CIS8004_MODULE_SCHEMA_BASE64 = '//8DAQAAAAgAAABDSVMtODAwNAEAFAAEAAAABQAAAGFkbWluCw0AAABjaXM4X2NvbnRyYWN0DA4AAABjaXMxMF9jb250cmFjdAwMAAAAZ2VuZXNpc19oYXNoEyAAAAACFQAAABgAAABhZ2VudEJ5RXh0ZXJuYWxSZWZlcmVuY2UCFAACAAAAEAAAAGNvbnRyYWN0X2FkZHJlc3MMBAAAAGtpbmQVAgAAAAQAAABDaXM4AQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIIAAAAa2V5X3R5cGUWAgoAAABwdWJsaWNfa2V5EAICBQAAAENpczEwAQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIPAAAAaWRlbnRpZmllcl90eXBlFgIKAAAAaWRlbnRpZmllchACAhUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABQACwAAAAgAAAB0b2tlbl9pZB0ADQAAAG93bmVyX2FjY291bnQLCQAAAGFnZW50X3VyaRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABYCDQAAAG1ldGFkYXRhX2hhc2gVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAATIAAAAAISAAAAZXh0ZXJuYWxfcmVmZXJlbmNlFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFAACAAAAEAAAAGNvbnRyYWN0X2FkZHJlc3MMBAAAAGtpbmQVAgAAAAQAAABDaXM4AQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIIAAAAa2V5X3R5cGUWAgoAAABwdWJsaWNfa2V5EAICBQAAAENpczEwAQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIPAAAAaWRlbnRpZmllcl90eXBlFgIKAAAAaWRlbnRpZmllchACAgwAAABhZ2VudF93YWxsZXQVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAALBgAAAHN0YXR1cxUCAAAABgAAAEFjdGl2ZQIHAAAAUmV2b2tlZAINAAAAcmVnaXN0ZXJlZF9hdA0KAAAAcmV2b2tlZF9hdBUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAAA0RAAAAcmV2b2NhdGlvbl9yZWFzb24VAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAWAhEAAABvbl9jaGFpbl9tZXRhZGF0YRACFAACAAAAAwAAAGtleRYCBQAAAHZhbHVlEAICBwAAAGFnZW50T2YCHQAVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAUAAsAAAAIAAAAdG9rZW5faWQdAA0AAABvd25lcl9hY2NvdW50CwkAAABhZ2VudF91cmkVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAWAg0AAABtZXRhZGF0YV9oYXNoFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAEyAAAAACEgAAAGV4dGVybmFsX3JlZmVyZW5jZRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABQAAgAAABAAAABjb250cmFjdF9hZGRyZXNzDAQAAABraW5kFQIAAAAEAAAAQ2lzOAEBAAAAFAADAAAACQAAAG5hbWVzcGFjZRYCCAAAAGtleV90eXBlFgIKAAAAcHVibGljX2tleRACAgUAAABDaXMxMAEBAAAAFAADAAAACQAAAG5hbWVzcGFjZRYCDwAAAGlkZW50aWZpZXJfdHlwZRYCCgAAAGlkZW50aWZpZXIQAgIMAAAAYWdlbnRfd2FsbGV0FQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAACwYAAABzdGF0dXMVAgAAAAYAAABBY3RpdmUCBwAAAFJldm9rZWQCDQAAAHJlZ2lzdGVyZWRfYXQNCgAAAHJldm9rZWRfYXQVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAANEQAAAHJldm9jYXRpb25fcmVhc29uFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFgIRAAAAb25fY2hhaW5fbWV0YWRhdGEQAhQAAgAAAAMAAABrZXkWAgUAAAB2YWx1ZRACAgkAAABiYWxhbmNlT2YCEAEUAAIAAAAIAAAAdG9rZW5faWQdAAcAAABhZGRyZXNzFQIAAAAHAAAAQWNjb3VudAEBAAAACwgAAABDb250cmFjdAEBAAAADBABGyUAAAAIAAAAZ2V0QWRtaW4BFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAACw4AAABnZXRBZ2VudFdhbGxldAIdABUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAAAsTAAAAZ2V0QWdlbnRXYWxsZXROb25jZQIdABUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAAAULAAAAZ2V0TWV0YWRhdGECFAACAAAACAAAAHRva2VuX2lkHQADAAAAa2V5FgIVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAAQAgIKAAAAb3BlcmF0b3JPZgIQARQAAgAAAAUAAABvd25lchUCAAAABwAAAEFjY291bnQBAQAAAAsIAAAAQ29udHJhY3QBAQAAAAwHAAAAYWRkcmVzcxUCAAAABwAAAEFjY291bnQBAQAAAAsIAAAAQ29udHJhY3QBAQAAAAwQAQEIAAAAcmVnaXN0ZXICFAAEAAAACQAAAGFnZW50X3VyaRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABYCDQAAAG1ldGFkYXRhX2hhc2gVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAATIAAAAAISAAAAZXh0ZXJuYWxfcmVmZXJlbmNlFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFAACAAAAEAAAAGNvbnRyYWN0X2FkZHJlc3MMBAAAAGtpbmQVAgAAAAQAAABDaXM4AQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIIAAAAa2V5X3R5cGUWAgoAAABwdWJsaWNfa2V5EAICBQAAAENpczEwAQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIPAAAAaWRlbnRpZmllcl90eXBlFgIKAAAAaWRlbnRpZmllchACAhAAAABpbml0aWFsX21ldGFkYXRhEAIUAAIAAAADAAAAa2V5FgIFAAAAdmFsdWUQAgIdAAYAAAByZXZva2UAFAACAAAACAAAAHRva2VuX2lkHQAGAAAAcmVhc29uFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFgILAAAAc2V0QWdlbnRVUkkAFAADAAAACAAAAHRva2VuX2lkHQAJAAAAYWdlbnRfdXJpFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFgINAAAAbWV0YWRhdGFfaGFzaBUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABMgAAAAAg4AAABzZXRBZ2VudFdhbGxldAAUAAQAAAAIAAAAdG9rZW5faWQdAAoAAABuZXdfd2FsbGV0CwgAAABkZWFkbGluZQ0JAAAAc2lnbmF0dXJlEAICFAAAAHNldEV4dGVybmFsUmVmZXJlbmNlABQAAgAAAAgAAAB0b2tlbl9pZB0AEgAAAGV4dGVybmFsX3JlZmVyZW5jZRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABQAAgAAABAAAABjb250cmFjdF9hZGRyZXNzDAQAAABraW5kFQIAAAAEAAAAQ2lzOAEBAAAAFAADAAAACQAAAG5hbWVzcGFjZRYCCAAAAGtleV90eXBlFgIKAAAAcHVibGljX2tleRACAgUAAABDaXMxMAEBAAAAFAADAAAACQAAAG5hbWVzcGFjZRYCDwAAAGlkZW50aWZpZXJfdHlwZRYCCgAAAGlkZW50aWZpZXIQAgIVAAAAc2V0RXh0ZXJuYWxSZWdpc3RyaWVzABQAAgAAAA0AAABjaXM4X2NvbnRyYWN0DA4AAABjaXMxMF9jb250cmFjdAwLAAAAc2V0TWV0YWRhdGEAFAADAAAACAAAAHRva2VuX2lkHQADAAAAa2V5FgIFAAAAdmFsdWUQAgIIAAAAc3VwcG9ydHMCEAEWABABFQMAAAAJAAAATm9TdXBwb3J0AgcAAABTdXBwb3J0AgkAAABTdXBwb3J0QnkBAQAAABAADA0AAAB0b2tlbk1ldGFkYXRhAhABHQAQARQAAgAAAAMAAAB1cmwWAQQAAABoYXNoFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAHiAAAAAIAAAAdHJhbnNmZXIAEAEUAAUAAAAIAAAAdG9rZW5faWQdAAYAAABhbW91bnQbJQAAAAQAAABmcm9tFQIAAAAHAAAAQWNjb3VudAEBAAAACwgAAABDb250cmFjdAEBAAAADAIAAAB0bxUCAAAABwAAAEFjY291bnQBAQAAAAsIAAAAQ29udHJhY3QBAgAAAAwWAQQAAABkYXRhHQENAAAAdHJhbnNmZXJBZG1pbgAUAAEAAAAJAAAAbmV3X2FkbWluFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAACw4AAAB1cGRhdGVPcGVyYXRvcgAQARQAAgAAAAYAAAB1cGRhdGUVAgAAAAYAAABSZW1vdmUCAwAAAEFkZAIIAAAAb3BlcmF0b3IVAgAAAAcAAABBY2NvdW50AQEAAAALCAAAAENvbnRyYWN0AQEAAAAMBwAAAHVwZ3JhZGUAFAACAAAACgAAAG5ld19tb2R1bGUeIAAAAAcAAABtaWdyYXRlFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAADxYBHQEBHw4AAADwCgAAAFJlZ2lzdGVyZWQBAQAAABQABgAAAAgAAAB0b2tlbl9pZB0ADQAAAG93bmVyX2FjY291bnQLCQAAAGFnZW50X3VyaRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABYCDQAAAG1ldGFkYXRhX2hhc2gVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAATIAAAAAISAAAAZXh0ZXJuYWxfcmVmZXJlbmNlFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFAACAAAAEAAAAGNvbnRyYWN0X2FkZHJlc3MMBAAAAGtpbmQVAgAAAAQAAABDaXM4AQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIIAAAAa2V5X3R5cGUWAgoAAABwdWJsaWNfa2V5EAICBQAAAENpczEwAQEAAAAUAAMAAAAJAAAAbmFtZXNwYWNlFgIPAAAAaWRlbnRpZmllcl90eXBlFgIKAAAAaWRlbnRpZmllchACAg0AAAByZWdpc3RlcmVkX2F0DfEKAAAAVVJJVXBkYXRlZAEBAAAAFAAEAAAACAAAAHRva2VuX2lkHQAJAAAAYWdlbnRfdXJpFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFgINAAAAbWV0YWRhdGFfaGFzaBUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABMgAAAAAgoAAAB1cGRhdGVkX2F0DfIUAAAARXh0ZXJuYWxSZWZlcmVuY2VTZXQBAQAAABQAAwAAAAgAAAB0b2tlbl9pZB0AEgAAAGV4dGVybmFsX3JlZmVyZW5jZRUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAABQAAgAAABAAAABjb250cmFjdF9hZGRyZXNzDAQAAABraW5kFQIAAAAEAAAAQ2lzOAEBAAAAFAADAAAACQAAAG5hbWVzcGFjZRYCCAAAAGtleV90eXBlFgIKAAAAcHVibGljX2tleRACAgUAAABDaXMxMAEBAAAAFAADAAAACQAAAG5hbWVzcGFjZRYCDwAAAGlkZW50aWZpZXJfdHlwZRYCCgAAAGlkZW50aWZpZXIQAgIKAAAAdXBkYXRlZF9hdA3zCwAAAE1ldGFkYXRhU2V0AQEAAAAUAAQAAAAIAAAAdG9rZW5faWQdAAMAAABrZXkWAgUAAAB2YWx1ZRACAgoAAAB1cGRhdGVkX2F0DfQHAAAAUmV2b2tlZAEBAAAAFAAEAAAACAAAAHRva2VuX2lkHQANAAAAb3duZXJfYWNjb3VudAsGAAAAcmVhc29uFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAFgIKAAAAcmV2b2tlZF9hdA31DgAAAEFnZW50V2FsbGV0U2V0AQEAAAAUAAMAAAAIAAAAdG9rZW5faWQdAAoAAABuZXdfd2FsbGV0FQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAACwoAAAB1cGRhdGVkX2F0DfYIAAAAVXBncmFkZWQBAQAAABQAAgAAAAoAAABuZXdfbW9kdWxlHiAAAAALAAAAdXBncmFkZWRfYXQN9xAAAABBZG1pblRyYW5zZmVycmVkAQEAAAAUAAMAAAAIAAAAcHJldmlvdXMVAgAAAAQAAABOb25lAgQAAABTb21lAQEAAAALAwAAAG5ldxUCAAAABAAAAE5vbmUCBAAAAFNvbWUBAQAAAAsKAAAAdXBkYXRlZF9hdA34GQAAAEV4dGVybmFsUmVnaXN0cmllc1VwZGF0ZWQBAQAAABQABQAAABYAAABwcmV2aW91c19jaXM4X2NvbnRyYWN0DBEAAABuZXdfY2lzOF9jb250cmFjdAwXAAAAcHJldmlvdXNfY2lzMTBfY29udHJhY3QMEgAAAG5ld19jaXMxMF9jb250cmFjdAwKAAAAdXBkYXRlZF9hdA37DQAAAFRva2VuTWV0YWRhdGEAAgAAAAgAAAB0b2tlbl9pZB0ADAAAAG1ldGFkYXRhX3VybBQAAgAAAAMAAAB1cmwWAQQAAABoYXNoFQIAAAAEAAAATm9uZQIEAAAAU29tZQEBAAAAHiAAAAD8DgAAAFVwZGF0ZU9wZXJhdG9yAAMAAAAGAAAAdXBkYXRlFQIAAAAGAAAAUmVtb3ZlAgMAAABBZGQCBQAAAG93bmVyFQIAAAAHAAAAQWNjb3VudAEBAAAACwgAAABDb250cmFjdAEBAAAADAgAAABvcGVyYXRvchUCAAAABwAAAEFjY291bnQBAQAAAAsIAAAAQ29udHJhY3QBAQAAAAz9BAAAAEJ1cm4AAwAAAAgAAAB0b2tlbl9pZB0ABgAAAGFtb3VudBslAAAABQAAAG93bmVyFQIAAAAHAAAAQWNjb3VudAEBAAAACwgAAABDb250cmFjdAEBAAAADP4EAAAATWludAADAAAACAAAAHRva2VuX2lkHQAGAAAAYW1vdW50GyUAAAAFAAAAb3duZXIVAgAAAAcAAABBY2NvdW50AQEAAAALCAAAAENvbnRyYWN0AQEAAAAM/wgAAABUcmFuc2ZlcgAEAAAACAAAAHRva2VuX2lkHQAGAAAAYW1vdW50GyUAAAAEAAAAZnJvbRUCAAAABwAAAEFjY291bnQBAQAAAAsIAAAAQ29udHJhY3QBAQAAAAwCAAAAdG8VAgAAAAcAAABBY2NvdW50AQEAAAALCAAAAENvbnRyYWN0AQEAAAAM';

/** Browser-safe helper returning a schema value object that provides .toString('base64'). */
function getCis8004ModuleSchemaValue() {
  if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
    return globalThis.Buffer.from(CIS8004_MODULE_SCHEMA_BASE64, 'base64');
  }
  return {
    toString: () => CIS8004_MODULE_SCHEMA_BASE64,
  };
}

function normalizeBadge(badge) {
  const value = String(badge || '').trim();
  const shortForm = value.includes('cis-2:') ? value.split('cis-2:').pop() : value;
  if (!/^[1-9A-HJ-NP-Za-km-z]{10,64}$/.test(shortForm)) {
    throw new Error('Enter a Concordium CIS-2 agent badge in Base58 format.');
  }
  return shortForm;
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || payload.error || `Concordium registry request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

async function callConcordiumTool(name, arguments_, signal) {
  const response = await fetch(CONCORDIUM_MCP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `nairatag-${name}-${Date.now()}`,
      method: 'tools/call',
      params: { name, arguments: arguments_ },
    }),
    signal,
  });
  const envelope = await readJson(response);
  const result = envelope.result;
  const text = result?.content?.find((item) => item.type === 'text')?.text;
  let payload;
  let hasPayload = false;
  if (result && Object.prototype.hasOwnProperty.call(result, 'structuredContent')) {
    payload = result.structuredContent;
    hasPayload = true;
  }
  if (!hasPayload && text !== undefined) {
    try {
      payload = JSON.parse(text);
      hasPayload = true;
    } catch { /* Preserve plain-text tool errors below. */ }
  }
  if (!result || result.isError || !hasPayload) {
    throw new Error(text || `Concordium ${name} request failed.`);
  }
  return payload;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizedAddress(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Checks an agent badge through Concordium's public Agent Registry verifier.
 * The Testnet is explicit so a mainnet badge is never silently treated as a
 * Testnet registration. This function is read-only and does not require keys.
 */
export async function verifyConcordiumBadge(badgeInput, { signal } = {}) {
  const badge = normalizeBadge(badgeInput);
  const url = new URL(`/v1/check-badge/${encodeURIComponent(badge)}`, CONCORDIUM_REGISTRY_API);
  url.searchParams.set('network', CONCORDIUM_TESTNET.network);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  const result = await readJson(response);
  const onChain = result.on_chain || {};
  const checks = result.checks || {};
  const active = String(onChain.status || '').toLowerCase() === 'active';
  const cardHashMatches = checks.hash_matches_on_chain === true;
  const onTestnet = String(result.network || '').toLowerCase() === CONCORDIUM_TESTNET.network;
  const valid = result.badge_valid === true
    && checks.on_chain_agent_found === true
    && checks.status_active === true
    && cardHashMatches
    && onTestnet;

  return {
    badge,
    network: result.network || null,
    valid,
    active,
    cardHashMatches,
    onTestnet,
    owner: onChain.owner_account || onChain.owner || null,
    tokenId: result.token_id === undefined ? null : String(result.token_id),
    agentUri: result.agent_uri || onChain.agent_uri || null,
    issues: Array.isArray(result.issues) ? result.issues.map((issue) => issue?.message || String(issue)) : [],
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Builds the canonical pre-mint CIS-8004 Agent Card through Concordium's
 * official registry service. The URI must already be a stable public HTTPS URL;
 * this function never stores or publishes the returned card.
 */
export async function buildConcordiumAgentCard({ name, description, agentUri, ownerAccount, externalReference, signal }) {
  const uri = new URL(String(agentUri || '').trim());
  if (uri.protocol !== 'https:' || uri.username || uri.password || uri.search || uri.hash) {
    throw new Error('Use a stable public HTTPS URL for the Agent Card (without query parameters or a fragment).');
  }
  if (!String(name || '').trim() || !String(description || '').trim() || !String(ownerAccount || '').trim()) {
    throw new Error('Connect a Concordium Testnet wallet and provide the Agent Card name and description.');
  }

  const response = await fetch(CONCORDIUM_MCP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `nairatag-card-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: 'build_agent_card',
        arguments: {
          network: CONCORDIUM_TESTNET.network,
          name: String(name).trim().slice(0, 128),
          description: String(description).trim().slice(0, 2048),
          agent_uri: uri.toString(),
          owner_account: String(ownerAccount).trim(),
          skills: [],
          external_reference: externalReference || null,
        },
      },
    }),
    signal,
  });
  const envelope = await readJson(response);
  const result = envelope.result;
  if (!result || result.isError) {
    const detail = result?.content?.find((item) => item.type === 'text')?.text;
    throw new Error(detail || 'Concordium could not build this Agent Card.');
  }

  const text = result.content?.find((item) => item.type === 'text')?.text;
  let payload = result.structuredContent || null;
  if (!payload && text) {
    try { payload = JSON.parse(text); } catch { /* Some MCP servers wrap tool errors in plain text. */ }
  }
  if (!payload?.agent_card_json || !/^[0-9a-f]{64}$/i.test(payload.metadata_hash_hex || '')) {
    throw new Error('Concordium returned an incomplete Agent Card response.');
  }

  let card;
  try { card = JSON.parse(payload.agent_card_json); } catch {
    throw new Error('Concordium returned invalid Agent Card JSON.');
  }
  if (payload.network !== CONCORDIUM_TESTNET.network || card.url !== uri.toString()) {
    throw new Error('Concordium returned card data for a different network or URL.');
  }

  return {
    network: payload.network,
    agentUri: payload.agent_uri,
    cardJson: payload.agent_card_json,
    card,
    metadataHash: payload.metadata_hash_hex.toLowerCase(),
    notes: Array.isArray(payload.notes) ? payload.notes : [],
  };
}

/** Confirms a published card serves the exact bytes and digest prepared above. */
export async function verifyHostedConcordiumAgentCard(cardDraft, { signal } = {}) {
  if (!cardDraft?.agentUri || !/^[0-9a-f]{64}$/i.test(cardDraft?.metadataHash || '')) {
    throw new Error('Prepare the Agent Card before checking its public URL.');
  }
  const uri = new URL(cardDraft.agentUri);
  if (uri.protocol !== 'https:' || uri.username || uri.password) {
    throw new Error('The Agent Card must be hosted at a public HTTPS URL.');
  }

  const response = await fetch(uri, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    referrerPolicy: 'no-referrer',
    signal,
  });
  if (!response.ok) throw new Error(`The public card URL returned HTTP ${response.status}.`);
  const bytes = await response.arrayBuffer();
  const jsonText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  let card;
  try { card = JSON.parse(jsonText); } catch {
    throw new Error('The public URL did not return valid Agent Card JSON.');
  }
  if (card.url !== cardDraft.agentUri) {
    throw new Error('The published Agent Card URL field does not match its public URL.');
  }
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 verification is unavailable in this browser.');

  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const actualHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (actualHash !== cardDraft.metadataHash) {
    throw new Error(`Published card hash mismatch. Expected ${cardDraft.metadataHash}; received ${actualHash}.`);
  }
  return { agentUri: cardDraft.agentUri, metadataHash: actualHash, verifiedAt: new Date().toISOString() };
}

function cardPublishMessage({ tag, evmOwner, concordiumOwner, cardUrl, cardHash, externalKey, expectedVersion, nonce }) {
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

/** Publishes canonical card bytes to the server, authorized by the NairaTag owner. */
export async function publishConcordiumAgentCard({ provider, activeEvmAddress, profileOwnerAddress, cardDraft, concordiumAccount, cis8Binding, tag: rawTag, signal }) {
  const activeAddress = normalizedAddress(activeEvmAddress);
  if (!provider?.request || !/^0x[0-9a-f]{40}$/.test(activeAddress)
    || activeAddress !== normalizedAddress(profileOwnerAddress)) {
    throw new Error('Connect the wallet that owns this NairaTag to publish its card.');
  }
  if (!cardDraft?.agentUri || !cardDraft?.cardJson || !cis8Binding?.publicKeyHex
    || cis8Binding.concordiumAccount !== concordiumAccount) {
    throw new Error('Prepare the Agent Card and verify the CIS-8 link before publishing.');
  }

  const chainId = await provider.request({ method: 'eth_chainId' });
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (BigInt(chainId) !== 42220n || !Array.isArray(accounts)
    || !accounts.some((account) => normalizedAddress(account) === activeAddress)) {
    throw new Error('Reconnect the wallet that owns this NairaTag.');
  }

  const response = await fetch(cardDraft.agentUri, { method: 'GET', cache: 'no-store', signal });
  let expectedVersion = 0;
  if (response.ok) {
    const existingCard = await response.json();
    const existingHash = String(response.headers.get('X-Card-Hash') || '').toLowerCase();
    const existingEvmOwner = normalizedAddress(response.headers.get('X-NairaTag-Owner'));
    const existingConcordiumOwner = String(response.headers.get('X-Concordium-Owner') || '').trim();
    expectedVersion = Number(response.headers.get('X-Card-Version'));
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || !existingHash || !existingEvmOwner || !existingConcordiumOwner) {
      throw new Error('The current hosted card is missing its version metadata.');
    }
    if (existingHash === cardDraft.metadataHash.toLowerCase()
      && existingEvmOwner === activeAddress
      && existingConcordiumOwner === concordiumAccount) {
      return { alreadyPublished: true, version: expectedVersion, cardUrl: cardDraft.agentUri, cardHash: existingHash, card: existingCard };
    }
  } else if (response.status !== 404) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Could not read the current public card (${response.status}).`);
  }

  const nonceBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(nonceBytes);
  const nonce = bytesToHex(nonceBytes);
  const tag = String(rawTag || '').trim().replace(/^[₦$@#]/, '').toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(tag)) throw new Error('The NairaTag is not valid for card publication.');
  const { stringToHex } = await import('viem');
  const message = cardPublishMessage({
    tag,
    evmOwner: activeAddress,
    concordiumOwner: concordiumAccount,
    cardUrl: cardDraft.agentUri,
    cardHash: cardDraft.metadataHash.toLowerCase(),
    externalKey: {
      namespace: cis8Binding.evmNamespace,
      key_type: cis8Binding.keyType,
      public_key_hex: cis8Binding.publicKeyHex,
    },
    expectedVersion,
    nonce,
  });
  const signature = await provider.request({
    method: 'personal_sign',
    params: [stringToHex(message), activeAddress],
  });

  const publishResponse = await fetch(cardDraft.agentUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      cardJson: cardDraft.cardJson,
      metadataHash: cardDraft.metadataHash.toLowerCase(),
      evmOwner: activeAddress,
      concordiumOwner: concordiumAccount,
      expectedVersion,
      nonce,
      signature,
      externalKey: {
        namespace: cis8Binding.evmNamespace,
        key_type: cis8Binding.keyType,
        public_key_hex: cis8Binding.publicKeyHex,
      },
    }),
    signal,
  });
  const published = await publishResponse.json().catch(() => ({}));
  if (!publishResponse.ok || !published.success) {
    throw new Error(published.error || `Card publishing failed (${publishResponse.status}).`);
  }
  return published;
}

/** Builds a sign-ready CIS-8004 registration after validating the card and CIS-8 link. */
export async function buildConcordiumAgentRegistration({ cardDraft, ownerAccount, cis8Binding, signal }) {
  if (!cardDraft?.agentUri || !/^[0-9a-f]{64}$/i.test(cardDraft?.metadataHash || '')) {
    throw new Error('Prepare and publish the Agent Card before registering it.');
  }
  const uri = new URL(cardDraft.agentUri);
  if (uri.protocol !== 'https:' || uri.username || uri.password || uri.search || uri.hash) {
    throw new Error('The Agent Card must use the verified stable HTTPS URL.');
  }
  if (!ownerAccount || ownerAccount !== cis8Binding?.concordiumAccount) {
    throw new Error('The active Concordium account must match the CIS-8 owner.');
  }

  const link = await verifyConcordiumCis8Binding(cis8Binding, { signal });
  if (!link.registered || !link.ownedByConnectedAccount) {
    throw new Error('The NairaTag owner key is not linked to this Concordium account on Testnet.');
  }
  const existingAgent = await findConcordiumAgentByCis8Binding(cis8Binding, { signal });
  if (existingAgent) {
    throw new Error('This CIS-8 key already resolves to a Concordium agent. Check the existing registry entry instead of minting a duplicate.');
  }

  const payload = await callConcordiumTool('build_register', {
    network: CONCORDIUM_TESTNET.network,
    sender: ownerAccount,
    agent_uri: uri.toString(),
    metadata_hash_hex: cardDraft.metadataHash,
    external_reference: {
      kind: 'Cis8',
      contract_address: CONCORDIUM_TESTNET.cis8,
      key: {
        namespace: cis8Binding.evmNamespace,
        key_type: cis8Binding.keyType,
        public_key_hex: cis8Binding.publicKeyHex,
      },
    },
  }, signal);

  const parameterJson = payload.parameter_json;
  const externalReference = parameterJson?.external_reference?.Some?.[0];
  const cis8Key = externalReference?.kind?.Cis8?.[0];
  const anchoredHashBytes = parameterJson?.metadata_hash?.Some?.[0];
  const anchoredHash = Array.isArray(anchoredHashBytes) ? bytesToHex(anchoredHashBytes) : '';

  if (payload.network !== CONCORDIUM_TESTNET.network
    || payload.sender !== ownerAccount
    || Number(payload.contract_address?.index) !== CONCORDIUM_TESTNET.cis8004.index
    || Number(payload.contract_address?.subindex) !== CONCORDIUM_TESTNET.cis8004.subindex
    || payload.receive_name !== CIS8004_RECEIVE_NAME
    || !/^[0-9a-f]+$/i.test(payload.parameter_hex || '')
    || !Number.isInteger(Number(payload.suggested_energy))
    || Number(payload.suggested_energy) <= 0
    || parameterJson?.agent_uri?.Some?.[0] !== uri.toString()
    || anchoredHash !== cardDraft.metadataHash.toLowerCase()
    || Number(externalReference?.contract_address?.index) !== CONCORDIUM_TESTNET.cis8.index
    || Number(externalReference?.contract_address?.subindex) !== CONCORDIUM_TESTNET.cis8.subindex
    || cis8Key?.namespace !== cis8Binding.evmNamespace
    || cis8Key?.key_type !== cis8Binding.keyType
    || bytesToHex(cis8Key?.public_key || []) !== cis8Binding.publicKeyHex.toLowerCase()) {
    throw new Error('Concordium returned a registration payload for an unexpected network, owner, or registry.');
  }

  return {
    network: payload.network,
    ownerAccount,
    contractAddress: payload.contract_address,
    receiveName: payload.receive_name,
    parameterHex: payload.parameter_hex,
    energy: Number(payload.suggested_energy),
    agentUri: uri.toString(),
    metadataHash: cardDraft.metadataHash.toLowerCase(),
    externalReference: {
      kind: 'Cis8',
      contractAddress: CONCORDIUM_TESTNET.cis8,
      namespace: cis8Binding.evmNamespace,
      keyType: cis8Binding.keyType,
      publicKeyHex: cis8Binding.publicKeyHex,
    },
  };
}

/** Opens an explicit Concordium Wallet approval for CIS-8004 registration. */
export async function submitConcordiumAgentRegistration(connection, account, registration) {
  if (!connection || !account || registration?.network !== CONCORDIUM_TESTNET.network
    || registration.ownerAccount !== account
    || Number(registration.contractAddress?.index) !== CONCORDIUM_TESTNET.cis8004.index
    || Number(registration.contractAddress?.subindex) !== CONCORDIUM_TESTNET.cis8004.subindex
    || registration.receiveName !== CIS8004_RECEIVE_NAME
    || !/^[0-9a-f]+$/i.test(registration.parameterHex || '')
    || !Number.isInteger(registration.energy) || registration.energy <= 0) {
    throw new Error('The connected Concordium account or registration details changed. Rebuild the registration first.');
  }

  const { AccountTransactionType, CcdAmount, ContractAddress, Energy, Parameter, ReceiveName } = await import('@concordium/web-sdk');
  const typedParams = registration.parameterJson ? {
    parameters: registration.parameterJson,
    schema: {
      type: 'ModuleSchema',
      value: getCis8004ModuleSchemaValue(),
    },
  } : undefined;

  return connection.signAndSendTransaction(account, AccountTransactionType.Update, {
    address: ContractAddress.create(registration.contractAddress.index, registration.contractAddress.subindex),
    amount: CcdAmount.zero(),
    receiveName: ReceiveName.fromString(registration.receiveName),
    message: Parameter.fromHexString(registration.parameterHex),
    maxContractExecutionEnergy: Energy.create(registration.energy),
  }, typedParams);
}

/** Builds a sign-ready payload to update an agent's URI and card hash on-chain (CIS-8004.setAgentURI). */
export async function buildConcordiumSetAgentUri({ tokenId, agentUri, metadataHashHex, sender, signal }) {
  if (!tokenId || !agentUri || !metadataHashHex || !sender) {
    throw new Error('tokenId, agentUri, metadataHashHex, and sender are required.');
  }
  const payload = await callConcordiumTool('build_set_agent_uri', {
    network: CONCORDIUM_TESTNET.network,
    token_id: Number(tokenId),
    agent_uri: agentUri,
    metadata_hash_hex: metadataHashHex.replace(/^0x/i, '').toLowerCase(),
    sender,
  }, signal);

  if (payload.network !== CONCORDIUM_TESTNET.network
    || (payload.sender && payload.sender !== sender)
    || Number(payload.contract_address?.index) !== CONCORDIUM_TESTNET.cis8004.index
    || Number(payload.contract_address?.subindex) !== CONCORDIUM_TESTNET.cis8004.subindex
    || payload.receive_name !== 'CIS-8004.setAgentURI'
    || !/^[0-9a-f]+$/i.test(payload.parameter_hex || '')
    || !Number.isInteger(Number(payload.suggested_energy))
    || Number(payload.suggested_energy) <= 0) {
    throw new Error('Concordium returned a setAgentURI payload for an unexpected network or registry.');
  }

  return {
    network: payload.network,
    sender,
    contractAddress: payload.contract_address,
    receiveName: payload.receive_name,
    parameterHex: payload.parameter_hex,
    parameterJson: payload.parameter_json,
    energy: Number(payload.suggested_energy),
    agentUri,
    metadataHash: metadataHashHex.replace(/^0x/i, '').toLowerCase(),
  };
}

/** Opens an explicit Concordium Wallet approval to update the agent URI on-chain. */
export async function submitConcordiumSetAgentUri(connection, account, setUriPayload) {
  if (!connection || !account || setUriPayload?.network !== CONCORDIUM_TESTNET.network
    || setUriPayload.sender !== account
    || Number(setUriPayload.contractAddress?.index) !== CONCORDIUM_TESTNET.cis8004.index
    || Number(setUriPayload.contractAddress?.subindex) !== CONCORDIUM_TESTNET.cis8004.subindex
    || setUriPayload.receiveName !== 'CIS-8004.setAgentURI'
    || !/^[0-9a-f]+$/i.test(setUriPayload.parameterHex || '')
    || !Number.isInteger(setUriPayload.energy) || setUriPayload.energy <= 0) {
    throw new Error('The connected Concordium account or setAgentURI details changed. Rebuild first.');
  }

  const { AccountTransactionType, CcdAmount, ContractAddress, Energy, Parameter, ReceiveName } = await import('@concordium/web-sdk');
  const typedParams = setUriPayload.parameterJson ? {
    parameters: setUriPayload.parameterJson,
    schema: {
      type: 'ModuleSchema',
      value: getCis8004ModuleSchemaValue(),
    },
  } : undefined;

  return connection.signAndSendTransaction(account, AccountTransactionType.Update, {
    address: ContractAddress.create(setUriPayload.contractAddress.index, setUriPayload.contractAddress.subindex),
    amount: CcdAmount.zero(),
    receiveName: ReceiveName.fromString(setUriPayload.receiveName),
    message: Parameter.fromHexString(setUriPayload.parameterHex),
    maxContractExecutionEnergy: Energy.create(setUriPayload.energy),
  }, typedParams);
}

/** Reads the registered agent associated with this CIS-8 key. */
export async function findConcordiumAgentByCis8Binding(binding, { signal } = {}) {
  if (!binding?.publicKeyHex || !binding?.evmNamespace || !binding?.keyType) {
    throw new Error('Prepare a CIS-8 binding before checking the Agent Registry.');
  }
  return callConcordiumTool('agent_by_external_reference', {
    network: CONCORDIUM_TESTNET.network,
    external_reference: {
      kind: 'Cis8',
      contract_address: CONCORDIUM_TESTNET.cis8,
      key: {
        namespace: binding.evmNamespace,
        key_type: binding.keyType,
        public_key_hex: binding.publicKeyHex,
      },
    },
  }, signal);
}

/**
 * Proves that the NairaTag owner EVM address is controlled by the caller and builds its
 * CIS-8 registration payload. The first personal-sign recovers the public key;
 * the second signs Concordium's exact canonical binding bytes. Neither message
 * can move assets or authorize a transaction.
 */
export async function buildConcordiumCis8Binding({ provider, activeEvmAddress, profileOwnerAddress, concordiumAccount, tag, signal }) {
  const activeAddress = normalizedAddress(activeEvmAddress);
  const ownerAddress = normalizedAddress(profileOwnerAddress);
  if (!provider?.request) throw new Error('The connected NairaTag owner wallet is unavailable.');
  if (!/^0x[0-9a-f]{40}$/.test(activeAddress) || activeAddress !== ownerAddress) {
    throw new Error('Sign in with the wallet that owns this NairaTag profile.');
  }
  if (!concordiumAccount || !String(tag || '').trim()) {
    throw new Error('Connect a Concordium Testnet account and select a NairaTag profile.');
  }

  const chainId = await provider.request({ method: 'eth_chainId' });
  if (BigInt(chainId) !== 42220n) {
    throw new Error('Switch the EVM wallet to the NairaTag owner network to prove this key.');
  }
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!Array.isArray(accounts) || !accounts.some((account) => normalizedAddress(account) === activeAddress)) {
    throw new Error('The connected wallet no longer has access to the NairaTag owner address.');
  }

  const { hashMessage, recoverPublicKey, stringToHex } = await import('viem');
  const { publicKeyToAddress } = await import('viem/accounts');
  const challengeBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(challengeBytes);
  const challenge = bytesToHex(challengeBytes);
  const safeTag = String(tag).trim().replace(/^[₦$@#]/, '').toUpperCase().slice(0, 32);
  const discoveryMessage = [
    'NairaTag Concordium CIS-8 public-key discovery',
    `Tag: ₦${safeTag}`,
    `Concordium account: ${concordiumAccount}`,
    `One-time challenge: ${challenge}`,
    'This signature proves wallet control only. It does not authorize a transaction or transfer.',
  ].join('\n');
  const discoverySignature = await provider.request({
    method: 'personal_sign',
    params: [stringToHex(discoveryMessage), activeAddress],
  });
  const discoveryHex = stringToHex(discoveryMessage);
  const publicKey = await recoverPublicKey({
    hash: hashMessage({ raw: discoveryHex }),
    signature: discoverySignature,
  });
  if (!publicKey || normalizedAddress(publicKeyToAddress(publicKey)) !== activeAddress) {
    throw new Error('The public key recovered from the wallet signature did not match the NairaTag owner.');
  }
  const publicKeyHex = publicKey.replace(/^0x/i, '').toLowerCase();
  if (!/^04[0-9a-f]{128}$/.test(publicKeyHex)) {
    throw new Error('The wallet did not return an uncompressed secp256k1 public key.');
  }

  const canonical = await callConcordiumTool('build_cis8_canonical_bytes', {
    network: CONCORDIUM_TESTNET.network,
    concordium_account: concordiumAccount,
    external_namespace: NAIRATAG_EVM_NAMESPACE,
    external_key_namespace: NAIRATAG_EVM_NAMESPACE,
    external_key_type: CIS8_KEY_TYPE,
    external_public_key_hex: publicKeyHex,
    proof_scheme: CIS8_PROOF_SCHEME,
  }, signal);
  if (canonical.network !== CONCORDIUM_TESTNET.network
    || canonical.genesis_hash !== CONCORDIUM_TESTNET.genesisHash
    || Number(canonical.contract_address?.index) !== CONCORDIUM_TESTNET.cis8.index
    || Number(canonical.contract_address?.subindex) !== CONCORDIUM_TESTNET.cis8.subindex
    || !/^[0-9a-f]+$/i.test(canonical.bytes_hex || '')) {
    throw new Error('Concordium returned canonical binding bytes for an unexpected network or registry.');
  }

  const canonicalHex = `0x${canonical.bytes_hex}`;
  const linkSignature = await provider.request({
    method: 'personal_sign',
    params: [canonicalHex, activeAddress],
  });
  const recoveredCanonicalKey = await recoverPublicKey({
    hash: hashMessage({ raw: canonicalHex }),
    signature: linkSignature,
  });
  if (!recoveredCanonicalKey || recoveredCanonicalKey.toLowerCase() !== publicKey.toLowerCase()) {
    throw new Error('The CIS-8 proof signature does not match the NairaTag owner key.');
  }
  const signatureHex = String(linkSignature).replace(/^0x/i, '').toLowerCase();

  const payload = await callConcordiumTool('build_cis8_register', {
    network: CONCORDIUM_TESTNET.network,
    sender: concordiumAccount,
    external_key: {
      namespace: NAIRATAG_EVM_NAMESPACE,
      key_type: CIS8_KEY_TYPE,
      public_key_hex: publicKeyHex,
    },
    proof: { scheme: CIS8_PROOF_SCHEME, signature_hex: signatureHex },
  }, signal);

  if (payload.network !== CONCORDIUM_TESTNET.network
    || payload.sender !== concordiumAccount
    || Number(payload.contract_address?.index) !== CONCORDIUM_TESTNET.cis8.index
    || Number(payload.contract_address?.subindex) !== CONCORDIUM_TESTNET.cis8.subindex
    || payload.receive_name !== 'CIS-8.registerExternalKey'
    || payload.parameter_json?.external_key?.namespace !== NAIRATAG_EVM_NAMESPACE
    || payload.parameter_json?.external_key?.key_type !== CIS8_KEY_TYPE
    || payload.parameter_json?.external_key?.public_key?.length !== 65
    || !/^[0-9a-f]+$/i.test(payload.parameter_hex || '')) {
    throw new Error('Concordium returned a CIS-8 transaction for an unexpected network, owner, or key.');
  }

  return {
    network: payload.network,
    concordiumAccount,
    evmAddress: activeAddress,
    evmNamespace: NAIRATAG_EVM_NAMESPACE,
    keyType: CIS8_KEY_TYPE,
    publicKeyHex,
    proofSignatureHex: signatureHex,
    contractAddress: payload.contract_address,
    receiveName: payload.receive_name,
    parameterHex: payload.parameter_hex,
    energy: Number(payload.suggested_energy),
  };
}

/** Opens a Testnet wallet approval for the CIS-8 binding transaction. */
export async function submitConcordiumCis8Binding(connection, account, binding, { provider, activeEvmAddress, profileOwnerAddress } = {}) {
  if (!connection || !account || binding?.network !== CONCORDIUM_TESTNET.network
    || binding.concordiumAccount !== account
    || Number(binding.contractAddress?.index) !== CONCORDIUM_TESTNET.cis8.index
    || Number(binding.contractAddress?.subindex) !== CONCORDIUM_TESTNET.cis8.subindex
    || binding.receiveName !== 'CIS-8.registerExternalKey') {
    throw new Error('The connected Concordium account or CIS-8 registration details changed. Rebuild the binding first.');
  }
  if (!provider?.request || normalizedAddress(activeEvmAddress) !== binding.evmAddress
    || normalizedAddress(profileOwnerAddress) !== binding.evmAddress) {
    throw new Error('The selected NairaTag owner changed. Rebuild the CIS-8 proof.');
  }
  const [chainId, accounts] = await Promise.all([
    provider.request({ method: 'eth_chainId' }),
    provider.request({ method: 'eth_accounts' }),
  ]);
  if (BigInt(chainId) !== 42220n || !Array.isArray(accounts)
    || !accounts.some((address) => normalizedAddress(address) === binding.evmAddress)) {
    throw new Error('Reconnect the wallet that owns this NairaTag, then prepare the CIS-8 proof again.');
  }
  if (!Number.isInteger(binding.energy) || binding.energy <= 0 || !/^[0-9a-f]+$/i.test(binding.parameterHex || '')) {
    throw new Error('The CIS-8 transaction payload is incomplete.');
  }

  const { AccountTransactionType, CcdAmount, ContractAddress, Energy, Parameter, ReceiveName } = await import('@concordium/web-sdk');
  return connection.signAndSendTransaction(account, AccountTransactionType.Update, {
    address: ContractAddress.create(binding.contractAddress.index, binding.contractAddress.subindex),
    amount: CcdAmount.zero(),
    receiveName: ReceiveName.fromString(binding.receiveName),
    message: Parameter.fromHexString(binding.parameterHex),
    maxContractExecutionEnergy: Energy.create(binding.energy),
  });
}

/** Confirms the registered CIS-8 key is owned by the connected Concordium account. */
export async function verifyConcordiumCis8Binding(binding, { signal } = {}) {
  if (!binding?.concordiumAccount || !binding?.publicKeyHex) {
    throw new Error('Prepare a CIS-8 binding before checking the registry.');
  }
  const result = await callConcordiumTool('owner_of_key', {
    network: CONCORDIUM_TESTNET.network,
    external_key: {
      namespace: binding.evmNamespace,
      key_type: binding.keyType,
      public_key_hex: binding.publicKeyHex,
    },
  }, signal);
  if (result === null) {
    return {
      network: CONCORDIUM_TESTNET.network,
      registered: false,
      ownedByConnectedAccount: false,
      registeredOwner: null,
      record: null,
    };
  }
  const record = result.registration || (typeof result.owner === 'object' ? result.owner : result);
  const registeredOwner = typeof result === 'string'
    ? result
    : result.owner_account || result.concordium_account || (typeof result.owner === 'string' ? result.owner : null)
      || record?.owner_account || record?.concordium_account || record?.owner || record?.account || null;
  return {
    network: result.network || CONCORDIUM_TESTNET.network,
    registered: Boolean(registeredOwner),
    // Concordium account addresses are Base58 and case-sensitive. Do not apply
    // EVM's case-insensitive address normalization to this comparison.
    ownedByConnectedAccount: Boolean(registeredOwner)
      && String(registeredOwner).trim() === String(binding.concordiumAccount).trim(),
    registeredOwner,
    record,
  };
}

/** Generates a cryptographically random hex challenge string for ZK ID proofs. */
export function generateRandomChallengeHex(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds a Concordium Zero-Knowledge ID statement to prove age of majority (18+)
 * and verified human identity backing without revealing birthdate or PII.
 */
export async function buildConcordiumIdStatement({ minAge = 18 } = {}) {
  const { IdStatementBuilder } = await import('@concordium/web-sdk');
  const builder = new IdStatementBuilder();
  builder.addMinimumAge(minAge);
  return builder.getStatement();
}

/**
 * Requests a Zero-Knowledge Identity Proof from the Concordium Browser Wallet.
 * Proves the human operator has passed Concordium KYC/identity verification
 * and meets the age requirement without leaking or storing any personal data.
 */
export async function requestConcordiumHumanProof(connection, account, { minAge = 18, challenge } = {}) {
  if (!connection) {
    throw new Error('Connect your Concordium Browser Wallet before requesting human proof.');
  }
  const client = connection.client || connection;
  if (!client?.requestIdProof) {
    throw new Error('The connected Concordium wallet does not support Zero-Knowledge identity proofs.');
  }
  if (!account || typeof account !== 'string' || !account.trim()) {
    throw new Error('A valid Concordium account address is required to prove human backing.');
  }

  const statement = await buildConcordiumIdStatement({ minAge });
  const challengeHex = challenge || generateRandomChallengeHex(32);

  let proofOutput;
  try {
    proofOutput = await client.requestIdProof(account.trim(), statement, challengeHex);
  } catch (error) {
    if (error?.message?.includes('User rejected') || error?.message?.includes('rejected')) {
      throw new Error('Human verification was rejected or cancelled in Concordium Wallet.');
    }
    throw error;
  }

  if (!proofOutput || !proofOutput.proof) {
    throw new Error('Concordium Browser Wallet returned an incomplete identity proof.');
  }

  return {
    account: account.trim(),
    credential: proofOutput.credential || null,
    statement,
    challenge: challengeHex,
    proof: proofOutput.proof,
    minAge,
    network: CONCORDIUM_TESTNET.network,
    verifiedAt: new Date().toISOString(),
    valid: true,
  };
}


