/**
 * @file agentIdentityStore.js
 * @description Production-grade durable persistence layer for NairaTag Agent Identities & Sessions.
 * 
 * Strict Security Principles:
 * 1. ZERO SECRET STORAGE: Never persists private keys, master passkey seeds, or signer secrets.
 * 2. Multi-tier durable persistence:
 *    - Supabase REST (if configured)
 *    - Node.js local storage (.nairatag_agents_store.json)
 *    - Browser localStorage (nairatag_agents_store_v1)
 *    - In-Memory Cache (atomic read/write)
 * 3. Idempotent and thread-safe.
 */

const SUPABASE_URL = typeof process !== 'undefined'
  ? (process.env?.SUPABASE_URL || process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL)
  : (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : null);

const SUPABASE_KEY = typeof process !== 'undefined'
  ? (process.env?.SUPABASE_SECRET_KEY || process.env?.SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)
  : (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : null);

const AGENTS_FILE = '.nairatag_agents_store.json';
const LS_AGENTS_KEY = 'nairatag_agents_store_v1';

// In-memory atomic store
const agentMemoryMap = new Map();
let isStoreLoaded = false;

function getNodeFilePath(filename) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const cwd = process.cwd();
      return `${cwd}/${filename}`;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Asserts that a record does NOT leak private keys or sensitive credentials.
 */
function assertZeroSecrets(record) {
  if (!record || typeof record !== 'object') return;
  const prohibitedKeys = [
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
  ];

  const scan = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (prohibitedKeys.includes(key)) {
        throw new Error(`SECURITY_VIOLATION: Attempted to persist prohibited secret key '${currentPath}'`);
      }
      if (typeof value === 'object' && value !== null) {
        scan(value, currentPath);
      }
    }
  };

  scan(record);
}

/**
 * Loads persisted records into memory.
 */
export async function loadAgentStore() {
  if (isStoreLoaded) return agentMemoryMap;

  // 1. Browser: fetch authoritative records from PostgreSQL-backed API route (when served as JSON)
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try {
      const apiRes = await fetch('/api/agent-identities');
      const contentType = apiRes.headers?.get?.('content-type') || '';
      if (apiRes.ok && contentType.includes('application/json')) {
        const data = await apiRes.json();
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        for (const row of rows) {
          if (row.tag && row.record) {
            assertZeroSecrets(row.record);
            agentMemoryMap.set(row.tag.toLowerCase(), row.record);
          }
        }
      }
    } catch (err) {
      console.warn('[AgentIdentityStore] API load warning:', err.message);
    }

    if (window.localStorage) {
      try {
        const raw = window.localStorage.getItem(LS_AGENTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          for (const [tag, record] of Object.entries(parsed)) {
            if (!agentMemoryMap.has(tag.toLowerCase())) {
              assertZeroSecrets(record);
              agentMemoryMap.set(tag.toLowerCase(), record);
            }
          }
        }
      } catch (err) {
        console.warn('[AgentIdentityStore] LocalStorage load warning:', err.message);
      }
    }
  }

  // 2. Node.js file system
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { readFileSync, existsSync } = await import('node:fs');
      const filePath = getNodeFilePath(AGENTS_FILE);
      if (filePath && existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          for (const [tag, record] of Object.entries(parsed)) {
            assertZeroSecrets(record);
            agentMemoryMap.set(tag.toLowerCase(), record);
          }
        }
      }
    } catch (err) {
      console.warn('[AgentIdentityStore] Node.js file load warning:', err.message);
    }
  }

  // 3. Supabase REST (if configured)
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/nairatag_agent_identities?select=*`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const rows = await res.json();
        for (const row of rows) {
          if (row.tag && row.record) {
            assertZeroSecrets(row.record);
            agentMemoryMap.set(row.tag.toLowerCase(), row.record);
          }
        }
      }
    } catch (err) {
      console.warn('[AgentIdentityStore] Supabase load warning:', err.message);
    }
  }

  isStoreLoaded = true;
  return agentMemoryMap;
}

/**
 * Persists an agent record to durable stores.
 */
export async function saveAgentRecord(tag, record) {
  if (!tag) throw new Error('Valid agent tag is required.');
  const normalizedTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  assertZeroSecrets(record);

  // 1. Memory
  const normalizedRecord = { ...record, tag: normalizedTag, updatedAt: Date.now() };
  agentMemoryMap.set(normalizedTag, normalizedRecord);

  // 2. Browser: persist to PostgreSQL-backed API + localStorage cache
  if (typeof window !== 'undefined') {
    if (typeof fetch === 'function') {
      try {
        const apiRes = await fetch('/api/agent-identities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: normalizedTag, record: normalizedRecord }),
        });
        const contentType = apiRes.headers?.get?.('content-type') || '';
        if (!apiRes.ok && contentType.includes('application/json')) {
          const errText = await apiRes.text().catch(() => '');
          console.warn('[AgentIdentityStore] API write warning:', apiRes.status, errText);
        }
      } catch (err) {
        console.warn('[AgentIdentityStore] API write error:', err.message);
      }
    }

    if (window.localStorage) {
      try {
        const serialized = JSON.stringify(Object.fromEntries(agentMemoryMap.entries()));
        window.localStorage.setItem(LS_AGENTS_KEY, serialized);
      } catch (err) {
        console.warn('[AgentIdentityStore] LocalStorage write error:', err.message);
      }
    }
  }

  // 3. Node.js file system
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { writeFileSync } = await import('node:fs');
      const filePath = getNodeFilePath(AGENTS_FILE);
      if (filePath) {
        const serialized = JSON.stringify(Object.fromEntries(agentMemoryMap.entries()), null, 2);
        writeFileSync(filePath, serialized, 'utf-8');
      }
    } catch (err) {
      console.warn('[AgentIdentityStore] Node.js file write error:', err.message);
    }
  }

  // 4. Supabase REST (if configured)
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/nairatag_agent_identities`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          tag: normalizedTag,
          owner_address: normalizedRecord.ownerAddress || null,
          altana_wallet_address: normalizedRecord.altana?.walletAddress || null,
          self_verified: Boolean(normalizedRecord.self?.verified),
          session_status: normalizedRecord.altana?.sessionStatus || 'unprovisioned',
          record: normalizedRecord,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn('[AgentIdentityStore] Supabase write error:', err.message);
    }
  }

  return agentMemoryMap.get(normalizedTag);
}

/**
 * Retrieves an agent record by tag.
 */
export async function getAgentRecord(tag) {
  if (!tag) return null;
  await loadAgentStore();
  const normalizedTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  return agentMemoryMap.get(normalizedTag) || null;
}

/**
 * Lists all registered agent records.
 */
export async function listAgentRecords() {
  await loadAgentStore();
  return Array.from(agentMemoryMap.values());
}

/**
 * Deletes an agent record.
 */
export async function deleteAgentRecord(tag) {
  if (!tag) return false;
  await loadAgentStore();
  const normalizedTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const deleted = agentMemoryMap.delete(normalizedTag);

  if (deleted) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const serialized = JSON.stringify(Object.fromEntries(agentMemoryMap.entries()));
        window.localStorage.setItem(LS_AGENTS_KEY, serialized);
      } catch {}
    }
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        const { writeFileSync } = await import('node:fs');
        const filePath = getNodeFilePath(AGENTS_FILE);
        if (filePath) {
          const serialized = JSON.stringify(Object.fromEntries(agentMemoryMap.entries()), null, 2);
          writeFileSync(filePath, serialized, 'utf-8');
        }
      } catch {}
    }
  }

  return deleted;
}

/**
 * Resets store (for test suite cleanup).
 */
export async function resetAgentStoreForTesting() {
  agentMemoryMap.clear();
  isStoreLoaded = true;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(LS_AGENTS_KEY);
    } catch {}
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { existsSync, writeFileSync } = await import('node:fs');
      const filePath = getNodeFilePath(AGENTS_FILE);
      if (filePath && existsSync(filePath)) {
        writeFileSync(filePath, '{}', 'utf-8');
      }
    } catch {}
  }
}
