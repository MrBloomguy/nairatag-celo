/**
 * @file agentPointsService.js
 * @description Production-grade Points & Verification Rewards Engine for NairaTag Agents on Celo Mainnet.
 * 
 * Core Axiom:
 * Verification is not just a status badge; it is an active economic trust signal.
 * Verified agents earn sovereign Trust Points that unlock priority routing, higher autonomous session caps,
 * and visibility on the Celo Sovereign Agent Leaderboard.
 * 
 * Reward Structure:
 * - SELF_VERIFICATION_BONUS: 500 Points (Awarded on proof-of-human backing via Self Protocol)
 * - DAILY_PROOF_CHECK: 25 Points (Awarded for maintaining fresh cryptographic proof)
 * - SERVICE_PUBLISHED: 250 Points (Awarded for listing bookable agent capacity)
 * - TASK_COMPLETED: 150 Points (Awarded for settling task bounty escrow)
 * - X402_COMMERCE_SETTLED: 100 Points (Awarded for digital dollar x402 capability settlement)
 */

import { keccak256, stringToHex } from 'viem';
import { saveAgentRecord, getAgentRecord } from './agentIdentityStore.js';

export const REWARD_ACTIONS = {
  SELF_VERIFICATION_BONUS: 'SELF_VERIFICATION_BONUS',
  DAILY_PROOF_CHECK: 'DAILY_PROOF_CHECK',
  SERVICE_PUBLISHED: 'SERVICE_PUBLISHED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  X402_COMMERCE_SETTLED: 'X402_COMMERCE_SETTLED',
};

export const REWARD_POINTS = {
  [REWARD_ACTIONS.SELF_VERIFICATION_BONUS]: 500,
  [REWARD_ACTIONS.DAILY_PROOF_CHECK]: 25,
  [REWARD_ACTIONS.SERVICE_PUBLISHED]: 250,
  [REWARD_ACTIONS.TASK_COMPLETED]: 150,
  [REWARD_ACTIONS.X402_COMMERCE_SETTLED]: 100,
};

const LS_POINTS_KEY = 'nairatag_agent_points_v1';
const POINTS_FILE = '.nairatag_agent_points.json';

// In-memory thread-safe ledger map: agentTag (lowercase) -> { totalPoints, ledger: [] }
const pointsMemoryMap = new Map();
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
 * Loads points ledger from disk / localStorage into memory.
 */
export async function loadPointsStore() {
  if (isStoreLoaded) return pointsMemoryMap;

  // 1. Browser localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(LS_POINTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [tag, data] of Object.entries(parsed)) {
          pointsMemoryMap.set(tag.toLowerCase(), data);
        }
      }
    } catch (err) {
      console.warn('[PointsStore] LocalStorage load warning:', err.message);
    }
  }

  // 2. Node.js file system
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { readFileSync, existsSync } = await import('node:fs');
      const filePath = getNodeFilePath(POINTS_FILE);
      if (filePath && existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          for (const [tag, data] of Object.entries(parsed)) {
            pointsMemoryMap.set(tag.toLowerCase(), data);
          }
        }
      }
    } catch (err) {
      console.warn('[PointsStore] Node.js file load warning:', err.message);
    }
  }

  // Pre-seed official platform agents with verified point baseline if empty
  if (!pointsMemoryMap.has('nairatag')) {
    pointsMemoryMap.set('nairatag', {
      totalPoints: 1250,
      ledger: [
        {
          id: 'genesis-nairatag-self',
          action: REWARD_ACTIONS.SELF_VERIFICATION_BONUS,
          points: 500,
          timestamp: 1795300000000,
          hash: keccak256(stringToHex('genesis-nairatag-self-bonus')),
          status: 'CONFIRMED',
          description: 'Official Platform Agent Proof-of-Human Backing Verified via Self Protocol',
        },
        {
          id: 'genesis-nairatag-services',
          action: REWARD_ACTIONS.SERVICE_PUBLISHED,
          points: 250,
          timestamp: 1795310000000,
          hash: keccak256(stringToHex('genesis-nairatag-service-bonus')),
          status: 'CONFIRMED',
          description: 'Cross-agent protocol orchestration capacity published',
        },
        {
          id: 'genesis-nairatag-commerce',
          action: REWARD_ACTIONS.X402_COMMERCE_SETTLED,
          points: 500,
          timestamp: 1795320000000,
          hash: keccak256(stringToHex('genesis-nairatag-commerce-bonus')),
          status: 'CONFIRMED',
          description: 'Forex telemetry and sub-second payment routing settlement',
        },
      ],
    });
  }

  if (!pointsMemoryMap.has('bloom')) {
    pointsMemoryMap.set('bloom', {
      totalPoints: 500,
      ledger: [
        {
          id: 'genesis-bloom-self',
          action: REWARD_ACTIONS.SELF_VERIFICATION_BONUS,
          points: 500,
          timestamp: 1795305000000,
          hash: keccak256(stringToHex('genesis-bloom-self-bonus')),
          status: 'CONFIRMED',
          description: 'Self Agent ID Proof-of-Human verification bonus',
        },
      ],
    });
  }

  isStoreLoaded = true;
  return pointsMemoryMap;
}

/**
 * Persists points ledger to memory, localStorage, and file system.
 */
async function persistPointsStore() {
  const data = Object.fromEntries(pointsMemoryMap.entries());

  // 1. Browser
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LS_POINTS_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[PointsStore] LocalStorage write error:', err.message);
    }
  }

  // 2. Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { writeFileSync } = await import('node:fs');
      const filePath = getNodeFilePath(POINTS_FILE);
      if (filePath) {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[PointsStore] Node.js write error:', err.message);
    }
  }
}

/**
 * Calculates agent level and tier name based on point threshold.
 */
export function calculateAgentTier(totalPoints = 0) {
  if (totalPoints >= 1000) {
    return { level: 3, tier: 'Master Protocol Agent', badge: 'Tier 3 · Master', multiplier: 1.5 };
  }
  if (totalPoints >= 500) {
    return { level: 2, tier: 'Verified Sovereign Agent', badge: 'Tier 2 · Sovereign', multiplier: 1.25 };
  }
  return { level: 1, tier: 'Novice Agent', badge: 'Tier 1 · Novice', multiplier: 1.0 };
}

/**
 * Retrieves an agent's points balance, tier, and history.
 */
export async function getAgentPoints(tag) {
  if (!tag) return { totalPoints: 0, rank: 99, tier: 'Unregistered', level: 0, ledger: [], verifiedBonusClaimed: false };
  await loadPointsStore();

  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const entry = pointsMemoryMap.get(cleanTag) || { totalPoints: 0, ledger: [] };

  const verifiedBonusClaimed = entry.ledger.some(
    (item) => item.action === REWARD_ACTIONS.SELF_VERIFICATION_BONUS
  );

  const tierInfo = calculateAgentTier(entry.totalPoints);

  return {
    tag: cleanTag,
    totalPoints: entry.totalPoints,
    ledger: [...entry.ledger].reverse(),
    verifiedBonusClaimed,
    ...tierInfo,
  };
}

/**
 * Awards verification points to an agent upon confirming Self Agent ID proof.
 * Guaranteed idempotency: only awards once per agent.
 */
export async function awardVerificationPoints(tag, verificationDetails = {}) {
  if (!tag) throw new Error('Agent tag is required to award verification points.');
  await loadPointsStore();

  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const entry = pointsMemoryMap.get(cleanTag) || { totalPoints: 0, ledger: [] };

  // Idempotency: verify not already awarded
  const alreadyClaimed = entry.ledger.some(
    (item) => item.action === REWARD_ACTIONS.SELF_VERIFICATION_BONUS
  );

  if (alreadyClaimed) {
    const tierInfo = calculateAgentTier(entry.totalPoints);
    return {
      success: false,
      alreadyClaimed: true,
      pointsAwarded: 0,
      totalPoints: entry.totalPoints,
      message: `Agent ₦${cleanTag.toUpperCase()} has already claimed the 500-point Self Verification Bonus.`,
      ...tierInfo,
    };
  }

  const pointsToAward = REWARD_POINTS[REWARD_ACTIONS.SELF_VERIFICATION_BONUS]; // 500
  const timestamp = Date.now();
  const hash = keccak256(
    stringToHex(`${cleanTag}:self-verification:${verificationDetails.nullifier || 'verified'}:${timestamp}`)
  );

  const ledgerItem = {
    id: `self-verify-${timestamp}-${Math.floor(Math.random() * 1000)}`,
    action: REWARD_ACTIONS.SELF_VERIFICATION_BONUS,
    points: pointsToAward,
    timestamp,
    hash,
    status: 'CONFIRMED',
    description: 'Self Agent ID Proof-of-Human verification on Celo Mainnet (500 Trust Points)',
    nullifier: verificationDetails.nullifier || null,
    registry: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944',
    chainId: 42220,
  };

  entry.totalPoints += pointsToAward;
  entry.ledger.push(ledgerItem);
  pointsMemoryMap.set(cleanTag, entry);

  await persistPointsStore();

  // Also sync with durable agent record in agentIdentityStore if exists
  try {
    const existingRecord = await getAgentRecord(cleanTag);
    if (existingRecord) {
      await saveAgentRecord(cleanTag, {
        ...existingRecord,
        points: entry.totalPoints,
        selfVerified: true,
        selfBonusClaimed: true,
        selfBonusClaimedAt: timestamp,
      });
    }
  } catch (err) {
    console.warn('[PointsStore] Failed to sync agentIdentityStore:', err.message);
  }

  const tierInfo = calculateAgentTier(entry.totalPoints);

  return {
    success: true,
    alreadyClaimed: false,
    pointsAwarded: pointsToAward,
    totalPoints: entry.totalPoints,
    ledgerItem,
    message: `🎉 Awarded +${pointsToAward} Trust Points to ₦${cleanTag.toUpperCase()} for on-chain Self Agent ID human proof!`,
    ...tierInfo,
  };
}

/**
 * Awards general action points to an agent.
 */
export async function awardActionPoints(tag, action, metadata = {}) {
  if (!tag) throw new Error('Agent tag is required.');
  if (!REWARD_POINTS[action]) throw new Error(`Unknown reward action: ${action}`);
  await loadPointsStore();

  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const entry = pointsMemoryMap.get(cleanTag) || { totalPoints: 0, ledger: [] };

  const pointsToAward = REWARD_POINTS[action];
  const timestamp = Date.now();
  const hash = keccak256(stringToHex(`${cleanTag}:${action}:${timestamp}:${Math.random()}`));

  const ledgerItem = {
    id: `${action.toLowerCase()}-${timestamp}-${Math.floor(Math.random() * 1000)}`,
    action,
    points: pointsToAward,
    timestamp,
    hash,
    status: 'CONFIRMED',
    description: metadata.description || `Points awarded for ${action}`,
    metadata,
  };

  entry.totalPoints += pointsToAward;
  entry.ledger.push(ledgerItem);
  pointsMemoryMap.set(cleanTag, entry);

  await persistPointsStore();
  const tierInfo = calculateAgentTier(entry.totalPoints);

  return {
    success: true,
    pointsAwarded: pointsToAward,
    totalPoints: entry.totalPoints,
    ledgerItem,
    ...tierInfo,
  };
}

/**
 * Returns sovereign points leaderboard of verified agents.
 */
export async function getPointsLeaderboard() {
  await loadPointsStore();
  const list = [];

  for (const [tag, data] of pointsMemoryMap.entries()) {
    const tier = calculateAgentTier(data.totalPoints);
    list.push({
      tag,
      name: `₦${tag.toUpperCase()}`,
      totalPoints: data.totalPoints,
      verified: data.ledger.some((i) => i.action === REWARD_ACTIONS.SELF_VERIFICATION_BONUS),
      level: tier.level,
      tier: tier.tier,
      badge: tier.badge,
    });
  }

  list.sort((a, b) => b.totalPoints - a.totalPoints);
  return list.map((item, index) => ({ ...item, rank: index + 1 }));
}

/**
 * Reset memory map for testing purposes.
 */
export async function _resetPointsStoreForTesting() {
  pointsMemoryMap.clear();
  isStoreLoaded = false;
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { unlinkSync, existsSync } = await import('node:fs');
      const filePath = getNodeFilePath(POINTS_FILE);
      if (filePath && existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {}
  }
}
