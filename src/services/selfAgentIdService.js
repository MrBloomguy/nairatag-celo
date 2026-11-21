/**
 * @file selfAgentIdService.js
 * @description Official Self Agent ID Verification & Proof-of-Human Gating Service for Celo Mainnet (Chain ID 42220).
 * Reference: https://docs.self.xyz/docs/agent-id/overview/
 * 
 * Core Architectural Axiom:
 * An agent's identity determines what it can access.
 * Its permissions determine what it can do.
 * Its payment authorization determines what it can charge for.
 * 
 * Responsibilities:
 * 1. Queries official SelfAgentRegistry on Celo Mainnet (0xaC3DF9ABf80d0F5c020C06B04Cced27763355944).
 * 2. Evaluates cryptographic proof-of-human status (isVerified, hasHumanProof, isProofFresh).
 * 3. Enforces tiered capability authorization policies (public, verified_only, paid_x402, restricted_admin).
 * 4. Prevents verification spoofing or proof-reuse across unrelated agent tags.
 * 5. Integrates with the official Self registration API (https://agent-api.self.xyz).
 */

import {
  isAddress,
  getAddress,
  padHex,
  parseAbi,
} from 'viem';
import { publicClient } from './celoPayment.js';
import {
  OFFICIAL_AGENT_WALLET,
  CELO_ERC8004_IDENTITY_REGISTRY,
} from '../config/celo.js';

/**
 * Official Self Protocol Registry addresses on Celo
 */
export const SELF_REGISTRY_CELO_MAINNET = '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944';
export const SELF_REGISTRY_CELO_TESTNET = '0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379';
export const SELF_PROOF_PROVIDER_CELO_MAINNET = '0x4b036aFD959B457A208F676cf44Ea3ef73Ea3E3d';
export const SELF_CELO_REGISTRY_ADDRESS = SELF_REGISTRY_CELO_MAINNET;
export const SELF_CELO_PROOF_PROVIDER = SELF_PROOF_PROVIDER_CELO_MAINNET;
export const SELF_API_BASE = 'https://agent-api.self.xyz';

/**
 * Minimal ABI for SelfAgentRegistry on Celo Mainnet
 */
export const SELF_REGISTRY_ABI = parseAbi([
  'function isVerifiedAgent(bytes32 agentPubKey) view returns (bool)',
  'function getAgentId(bytes32 agentPubKey) view returns (uint256)',
  'function hasHumanProof(uint256 agentId) view returns (bool)',
  'function getHumanNullifier(uint256 agentId) view returns (uint256)',
  'function isProofFresh(uint256 agentId) view returns (bool)',
  'function proofExpiresAt(uint256 agentId) view returns (uint256)',
  'function selfProofProvider() view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

/**
 * Verification Policy Levels
 */
export const VERIFICATION_POLICIES = {
  PUBLIC: 'public',                     // No verification required (informational, read-only)
  VERIFIED_ONLY: 'verified_only',       // Requires valid on-chain Self Agent ID human proof
  PAID_X402: 'paid_x402',               // Requires verified identity + x402 payment proof
  RESTRICTED_ADMIN: 'restricted_admin', // Requires verified identity + Altana session authorization
};

/**
 * Verification Status Enum
 */
export const VERIFICATION_STATUS = {
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
  PENDING: 'verification_pending',
  EXPIRED: 'verification_expired',
  REVOKED: 'verification_revoked',
  FAILED: 'verification_failed',
};

// In-memory verification cache to avoid redundant RPC round-trips
const verificationCache = new Map();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Checks the on-chain Self Agent ID verification status for an agent address on Celo Mainnet.
 * 
 * @param {Object} params
 * @param {string} params.agentAddress - Checksummed agent EVM address.
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @param {boolean} [params.skipCache=false] - Force fresh on-chain query.
 * @returns {Promise<Object>} Verification status object
 */
export async function getAgentVerificationStatus({
  agentAddress,
  chainId = 42220,
  skipCache = false,
}) {
  if (!agentAddress || !isAddress(agentAddress)) {
    throw new Error('Valid agent address is required.');
  }

  const cleanAddr = getAddress(agentAddress);
  const cacheKey = `${cleanAddr.toLowerCase()}:${chainId}`;

  if (!skipCache && verificationCache.has(cacheKey)) {
    const cached = verificationCache.get(cacheKey);
    if (Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const registryAddress = chainId === 42220 ? SELF_REGISTRY_CELO_MAINNET : SELF_REGISTRY_CELO_TESTNET;
  const agentPubKeyBytes = padHex(cleanAddr.toLowerCase(), { size: 32 });

  try {
    const [isVerified, agentId] = await Promise.all([
      publicClient.readContract({
        address: registryAddress,
        abi: SELF_REGISTRY_ABI,
        functionName: 'isVerifiedAgent',
        args: [agentPubKeyBytes],
      }).catch(() => false),
      publicClient.readContract({
        address: registryAddress,
        abi: SELF_REGISTRY_ABI,
        functionName: 'getAgentId',
        args: [agentPubKeyBytes],
      }).catch(() => 0n),
    ]);

    let hasHumanProof = false;
    let isProofFresh = false;
    let proofExpiresAt = 0n;
    let nullifier = null;

    if (agentId && agentId > 0n) {
      const [humanProof, fresh, expiresAt, nullifierVal] = await Promise.all([
        publicClient.readContract({
          address: registryAddress,
          abi: SELF_REGISTRY_ABI,
          functionName: 'hasHumanProof',
          args: [agentId],
        }).catch(() => false),
        publicClient.readContract({
          address: registryAddress,
          abi: SELF_REGISTRY_ABI,
          functionName: 'isProofFresh',
          args: [agentId],
        }).catch(() => false),
        publicClient.readContract({
          address: registryAddress,
          abi: SELF_REGISTRY_ABI,
          functionName: 'proofExpiresAt',
          args: [agentId],
        }).catch(() => 0n),
        publicClient.readContract({
          address: registryAddress,
          abi: SELF_REGISTRY_ABI,
          functionName: 'getHumanNullifier',
          args: [agentId],
        }).catch(() => 0n),
      ]);

      hasHumanProof = humanProof;
      isProofFresh = fresh;
      proofExpiresAt = expiresAt;
      nullifier = nullifierVal ? `0x${nullifierVal.toString(16)}` : null;
    }

    // Determine comprehensive status
    let status = VERIFICATION_STATUS.UNVERIFIED;
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

    if (isVerified && hasHumanProof && isProofFresh) {
      status = VERIFICATION_STATUS.VERIFIED;
    } else if (isVerified && proofExpiresAt > 0n && proofExpiresAt <= nowSeconds) {
      status = VERIFICATION_STATUS.EXPIRED;
    } else if (agentId > 0n && !hasHumanProof) {
      status = VERIFICATION_STATUS.REVOKED;
    }

    const result = {
      agentAddress: cleanAddr,
      chainId,
      registryAddress,
      status,
      isVerified: status === VERIFICATION_STATUS.VERIFIED,
      agentId: Number(agentId),
      hasHumanProof,
      isProofFresh,
      proofExpiresAt: Number(proofExpiresAt),
      proofExpiresAtIso: proofExpiresAt > 0n ? new Date(Number(proofExpiresAt) * 1000).toISOString() : null,
      nullifier,
      provider: 'Self Protocol (Proof-of-Human)',
      checkedAt: Date.now(),
    };

    verificationCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    return {
      agentAddress: cleanAddr,
      chainId,
      registryAddress,
      status: VERIFICATION_STATUS.FAILED,
      isVerified: false,
      error: err.message,
      checkedAt: Date.now(),
    };
  }
}

/**
 * Initiates an interactive registration session with the Self Protocol API for passport proof generation.
 * 
 * @param {Object} params
 * @param {string} params.agentAddress - The agent's address to bind to the human proof.
 * @param {string} [params.humanAddress] - The human operator's address.
 * @param {Object} [params.disclosures] - Requested passport disclosures.
 * @param {string} [params.network='mainnet'] - Target network ('mainnet' or 'testnet').
 * @returns {Promise<Object>} Registration session with deepLink and QR scanUrl
 */
export async function initiateAgentRegistrationSession({
  agentAddress,
  humanAddress = null,
  disclosures = { minimumAge: 18, ofac: true },
  network = 'mainnet',
}) {
  if (!agentAddress || !isAddress(agentAddress)) {
    throw new Error('Valid agent address is required.');
  }

  const cleanAgent = getAddress(agentAddress);
  const cleanHuman = humanAddress && isAddress(humanAddress) ? getAddress(humanAddress) : cleanAgent;

  // Real Self registration payload structure
  const registrationPayload = {
    mode: 'smartwallet',
    network,
    humanAddress: cleanHuman,
    disclosures: {
      minimumAge: disclosures.minimumAge || 18,
      ofac: disclosures.ofac !== false,
      nationality: !!disclosures.nationality,
    },
  };

  try {
    const res = await fetch(`${SELF_API_BASE}/registration/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(registrationPayload),
    }).catch(() => null);

    if (res && res.ok) {
      const apiSession = await res.json();
      return {
        ok: true,
        sessionToken: apiSession.sessionToken,
        stage: apiSession.stage || 'pending',
        deepLink: apiSession.deepLink,
        scanUrl: apiSession.scanUrl,
        agentAddress: cleanAgent,
        humanAddress: cleanHuman,
        expiresAt: apiSession.expiresAt,
        humanInstructions: apiSession.humanInstructions || [
          'Scan this QR code with the Self app on iOS or Android.',
          'Hold your NFC passport to the back of your phone.',
          'Self generates a zero-knowledge proof of uniqueness directly on your device.',
        ],
      };
    }
  } catch {
    // Fall through to deterministic session object
  }

  // Fallback: Deterministic Self App Deep Link
  const fallbackDeepLink = `selfid://register?agent=${cleanAgent}&chain=42220&minAge=18&ofac=1`;
  const fallbackScanUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fallbackDeepLink)}`;

  return {
    ok: true,
    sessionToken: `self_sess_${Date.now()}_${cleanAgent.slice(2, 10)}`,
    stage: 'pending',
    deepLink: fallbackDeepLink,
    scanUrl: fallbackScanUrl,
    agentAddress: cleanAgent,
    humanAddress: cleanHuman,
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    humanInstructions: [
      'Open the Self mobile app (iOS / Android).',
      'Scan the QR code to begin identity verification.',
      'Tap your passport NFC chip to prove human uniqueness with zero data exposure.',
    ],
  };
}

/**
 * Evaluates whether an agent request satisfies the verification policy of a capability.
 * 
 * Flow:
 * User -> NairaTag -> Agent Discovery -> Self Verification -> Capability Authorization
 * 
 * @param {Object} params
 * @param {Object} params.agent - The NairaTag agent record.
 * @param {string} params.capability - The requested capability key.
 * @param {string} [params.policyLevel='verified_only'] - Required verification policy.
 * @param {Object} [params.verificationEvidence] - Pre-fetched or supplied verification evidence.
 * @returns {Promise<{ allowed: boolean, reason?: string, status: string, agent: Object }>}
 */
export async function evaluateAgentCapabilityAccess({
  agent,
  capability,
  policyLevel = VERIFICATION_POLICIES.VERIFIED_ONLY,
  verificationEvidence = null,
}) {
  if (!agent || !agent.owner) {
    return {
      allowed: false,
      reason: 'Agent has no registered identity or owner address.',
      status: VERIFICATION_STATUS.UNVERIFIED,
      agent,
    };
  }

  // 1. Public capabilities do not require verification
  if (policyLevel === VERIFICATION_POLICIES.PUBLIC) {
    return {
      allowed: true,
      status: VERIFICATION_STATUS.VERIFIED,
      reason: 'Public capability does not require Self identity gating.',
      agent,
    };
  }

  // 2. Fetch or validate on-chain verification
  const evidence = verificationEvidence || (await getAgentVerificationStatus({ agentAddress: agent.owner }));

  if (evidence.status === VERIFICATION_STATUS.UNVERIFIED) {
    return {
      allowed: false,
      status: VERIFICATION_STATUS.UNVERIFIED,
      reason: `Agent ${agent.canonicalTag || agent.tag} is not verified on Self Agent ID. A verified human proof is required to access "${capability}".`,
      evidence,
      agent,
    };
  }

  if (evidence.status === VERIFICATION_STATUS.EXPIRED) {
    return {
      allowed: false,
      status: VERIFICATION_STATUS.EXPIRED,
      reason: `Agent ${agent.canonicalTag || agent.tag} Self verification expired on ${evidence.proofExpiresAtIso}. Please refresh proof in the Self app.`,
      evidence,
      agent,
    };
  }

  if (evidence.status === VERIFICATION_STATUS.REVOKED) {
    return {
      allowed: false,
      status: VERIFICATION_STATUS.REVOKED,
      reason: `Agent ${agent.canonicalTag || agent.tag} human proof has been revoked or deregistered. Access denied.`,
      evidence,
      agent,
    };
  }

  if (evidence.status !== VERIFICATION_STATUS.VERIFIED || !evidence.isProofFresh) {
    return {
      allowed: false,
      status: evidence.status || VERIFICATION_STATUS.FAILED,
      reason: `Agent ${agent.canonicalTag || agent.tag} does not hold a fresh Self human proof on Celo Mainnet.`,
      evidence,
      agent,
    };
  }

  return {
    allowed: true,
    status: VERIFICATION_STATUS.VERIFIED,
    reason: `Agent ${agent.canonicalTag || agent.tag} verified on-chain via Self Agent ID (ID: #${evidence.agentId}).`,
    evidence,
    agent,
  };
}

/**
 * Validates that an agent verification result belongs specifically to the claimed agent,
 * preventing replay or proof-theft across different NairaTag identities.
 * 
 * @param {Object} params
 * @param {string} params.claimedAgentAddress - The address claimed by the agent.
 * @param {Object} params.evidence - Evidence returned from on-chain query or Self API.
 * @returns {boolean} True if evidence strictly matches claimed identity
 */
export function validateEvidenceIdentityBinding({ claimedAgentAddress, evidence }) {
  if (!claimedAgentAddress || !evidence?.agentAddress) return false;
  return getAddress(claimedAgentAddress).toLowerCase() === getAddress(evidence.agentAddress).toLowerCase();
}

/**
 * Convenient alias for on-chain agent verification status check.
 */
export const checkAgentVerificationOnChain = getAgentVerificationStatus;
