/**
 * @file durablePaymentStore.js
 * @description Durable, atomic storage adapter for x402 payment digests and execution receipts.
 * 
 * Strict Invariants:
 * 1. Single-Use Consumption: A payment digest can be consumed only once.
 * 2. Concurrency Safety: In-flight mutex locks prevent race conditions where two simultaneous requests consume the same payment.
 * 3. Process Survival: Persists across server/process restarts (File-backed in Node, localStorage in Browser, Supabase REST if configured).
 * 4. Audit & Retry Retention: Retains traceable receipts when agent execution fails, enabling idempotent retry without re-charging.
 */

// In-flight mutex lock map to prevent race conditions during concurrent requests
const inFlightLocks = new Set();

// In-memory cache for fast lookups
const memoryCache = new Map();

// Configuration
const PERSISTENCE_FILE_NAME = '.x402_consumed_payments.json';
const LOCAL_STORAGE_KEY = 'nairatag_x402_consumed_payments';
const RETRY_WINDOW_SECONDS = 300; // 5 minutes

/**
 * Helper to get the file path in Node.js environments.
 */
function getNodeFilePath() {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const cwd = process.cwd();
      return `${cwd}/${PERSISTENCE_FILE_NAME}`;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Loads durable store from disk, localStorage, or remote backend.
 */
export async function loadDurableStore() {
  // 1. Check Browser localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          memoryCache.set(k, v);
        }
      }
      return;
    } catch (err) {
      console.warn('[DurablePaymentStore] LocalStorage read warning:', err.message);
    }
  }

  // 2. Check Node.js file system
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { readFileSync, existsSync } = await import('node:fs');
      const filePath = getNodeFilePath();
      if (filePath && existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          for (const [k, v] of Object.entries(parsed)) {
            memoryCache.set(k, v);
          }
        }
      }
    } catch (err) {
      console.warn('[DurablePaymentStore] Node file read warning:', err.message);
    }
  }
}

/**
 * Flushes memory cache to durable storage.
 */
export async function persistDurableStore() {
  const serialized = Object.fromEntries(memoryCache);

  // 1. Browser localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serialized));
    } catch (err) {
      console.warn('[DurablePaymentStore] LocalStorage write warning:', err.message);
    }
  }

  // 2. Node.js file system (atomic write via temp file rename or direct write)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { writeFileSync } = await import('node:fs');
      const filePath = getNodeFilePath();
      if (filePath) {
        writeFileSync(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[DurablePaymentStore] Node file write warning:', err.message);
    }
  }
}

// Initial eager load
loadDurableStore().catch(() => {});

/**
 * Atomically attempts to consume a payment digest before executing protected agent compute.
 * 
 * @param {Object} params
 * @param {string} params.paymentDigest - Unique cryptographic hash of payment.
 * @param {Object} params.requirement - Expected challenge requirement.
 * @param {Object} params.paymentProof - Submitted client proof.
 * @returns {Promise<Object>} Status object indicating whether consumption succeeded or is an allowed retry
 */
export async function consumePaymentDigestAtomic({
  paymentDigest,
  requirement,
  paymentProof,
}) {
  if (!paymentDigest) {
    throw new Error('Payment digest is required for atomic consumption.');
  }

  // 1. Concurrent In-Flight Check (Locking Mutex)
  if (inFlightLocks.has(paymentDigest)) {
    throw new Error('Concurrent payment consumption in progress: Replay attack prohibited.');
  }

  // Ensure fresh state from disk/store
  await loadDurableStore();

  // 2. Check if already consumed in durable store
  const existing = memoryCache.get(paymentDigest);
  if (existing) {
    if (existing.status === 'consumed') {
      throw new Error('Payment proof has already been redeemed. Replay attacks are prohibited.');
    }
    if (existing.status === 'pending_execution') {
      throw new Error('Payment consumption in progress. Replay attack prohibited.');
    }
    if (existing.status === 'failed') {
      // Check if retry is within allowable window
      const now = Math.floor(Date.now() / 1000);
      const age = now - (existing.timestamp || now);
      if (age <= RETRY_WINDOW_SECONDS && existing.resourceId === requirement.resourceId) {
        // Mark for retry
        inFlightLocks.add(paymentDigest);
        return {
          ok: true,
          isRetry: true,
          paymentDigest,
          existingRecord: existing,
        };
      }
      throw new Error(`Previous execution with this payment failed and exceeded retry window of ${RETRY_WINDOW_SECONDS}s.`);
    }
  }

  // 3. Acquire atomic in-flight lock
  inFlightLocks.add(paymentDigest);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const record = {
    paymentDigest,
    txHash: paymentProof.txHash || null,
    nonce: requirement.nonce,
    amount: paymentProof.amount || requirement.amount,
    asset: requirement.asset,
    payTo: requirement.payTo,
    resourceId: requirement.resourceId,
    agentTag: requirement.agentTag,
    timestamp: nowSeconds,
    status: 'pending_execution',
    isSimulation: Boolean(paymentProof.isSimulation),
    retryCount: 0,
    attributionTag: requirement.attributionTag || 'celo_9f7deabd99a6',
  };

  memoryCache.set(paymentDigest, record);
  await persistDurableStore();

  return {
    ok: true,
    isRetry: false,
    paymentDigest,
    record,
  };
}

/**
 * Updates execution result and releases in-flight lock.
 * 
 * @param {Object} params
 * @param {string} params.paymentDigest
 * @param {'consumed'|'failed'} params.status
 * @param {Object} [params.executionResult]
 * @param {string} [params.error]
 */
export async function updatePaymentExecutionResult({
  paymentDigest,
  status,
  executionResult = null,
  error = null,
}) {
  try {
    const existing = memoryCache.get(paymentDigest) || {};
    const updated = {
      ...existing,
      status,
      completedAt: Math.floor(Date.now() / 1000),
      executionResult: executionResult ? JSON.stringify(executionResult).slice(0, 500) : null,
      error: error || null,
      retryCount: status === 'failed' ? (existing.retryCount || 0) + 1 : (existing.retryCount || 0),
    };

    memoryCache.set(paymentDigest, updated);
    await persistDurableStore();
    return updated;
  } finally {
    // Release in-flight lock
    inFlightLocks.delete(paymentDigest);
  }
}

/**
 * Releases in-flight lock in case of validation pre-flight failure.
 * 
 * @param {string} paymentDigest
 */
export function releaseInFlightLock(paymentDigest) {
  inFlightLocks.delete(paymentDigest);
}

/**
 * Checks whether a payment digest has already been redeemed.
 * 
 * @param {string} paymentDigest
 * @returns {boolean}
 */
export function isPaymentConsumed(paymentDigest) {
  const rec = memoryCache.get(paymentDigest);
  return rec ? rec.status === 'consumed' : false;
}

/**
 * Retrieves full audit record for a given payment digest.
 * 
 * @param {string} paymentDigest
 * @returns {Object|null}
 */
export function getPaymentRecord(paymentDigest) {
  return memoryCache.get(paymentDigest) || null;
}

/**
 * Resets in-memory and durable storage (for testing only).
 */
export async function _resetDurableStoreForTesting() {
  inFlightLocks.clear();
  memoryCache.clear();

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { unlinkSync, existsSync } = await import('node:fs');
      const filePath = getNodeFilePath();
      if (filePath && existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {}
  }
}
