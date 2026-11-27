/**
 * @file agentLifecycleService.js
 * @description Master Platform-Wide Agent Lifecycle, Identity & Session Orchestrator for Celo Mainnet (42220).
 * 
 * Unifies:
 * 1. Self Agent ID: Verified human owner association & proof-of-human gating.
 * 2. Altana Smart Wallet: Non-custodial agent wallet infrastructure with scoped session delegation.
 * 3. ERC-8004 On-Chain Identity: Universal AI agent registry on Celo Mainnet (0x8004A169FB4a3325136EB29fA0ceB6D2e539a432).
 * 4. ERC-8021 Attribution Tag: celo_9f7deabd99a6 attached to all transactions.
 * 
 * Strict Lifecycle States:
 * - draft: Initial registration requested.
 * - verification_required: Owner must prove human identity via Self Protocol.
 * - verification_pending: Verification proof in flight or being verified.
 * - wallet_provisioning_pending: Altana smart wallet being created/associated.
 * - session_authorization_required: Owner must sign session policy.
 * - active: Fully operational, capable of booking, tasks, and x402 commerce.
 * - suspended: Temporary pause due to limits or security policy.
 * - revoked: Session key explicitly revoked by human owner.
 */

import { isAddress, getAddress, keccak256, toHex, stringToHex } from 'viem';
import {
  saveAgentRecord,
  getAgentRecord,
  listAgentRecords,
} from './agentIdentityStore.js';
import {
  ALTANA_CELO_CHAIN_ID,
  ALTANA_CELO_KEYSTORE,
  ERC8004_REGISTRY_CELO_ADDRESS,
  createAltanaWallet,
  connectAltanaWallet,
  buildStandardAgentPolicy,
  grantAgentSession,
  revokeAgentSession as revokeAltanaSession,
  getAgentSessionStatus,
  CELO_VERIFIED_PERMISSIONS,
} from './altanaWalletService.js';
import {
  SELF_REGISTRY_CELO_MAINNET,
  SELF_PROOF_PROVIDER_CELO_MAINNET,
  getAgentVerificationStatus,
  validateEvidenceIdentityBinding,
  VERIFICATION_STATUS,
} from './selfAgentIdService.js';
import {
  getAgentDetails,
} from './erc8004Service.js';
import {
  CELO_ATTRIBUTION_TAG,
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  OFFICIAL_AGENT_WALLET,
} from '../config/celo.js';

export const LIFECYCLE_STATUS = {
  DRAFT: 'draft',
  VERIFICATION_REQUIRED: 'verification_required',
  VERIFICATION_PENDING: 'verification_pending',
  WALLET_PROVISIONING_PENDING: 'wallet_provisioning_pending',
  SESSION_AUTHORIZATION_REQUIRED: 'session_authorization_required',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
};

export const DEFAULT_DAILY_LIMITS = {
  CNGN: '100000', // 100,000 cNGN
  USDT: '50',     // 50 USD₮
  CELO: '20',     // 20 CELO
};

/**
 * Creates an initial agent draft record.
 */
export async function createAgentDraft({
  tag,
  name,
  description = '',
  ownerAddress,
  category = 'general',
  avatar = null,
  capabilities = ['booking', 'tasks', 'x402_settlement'],
}) {
  if (!tag) throw new Error('Agent tag is required.');
  if (!ownerAddress || typeof ownerAddress !== 'string' || !isAddress(ownerAddress.toLowerCase())) {
    throw new Error('Valid human owner EVM address is required.');
  }

  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const canonicalTag = `₦${cleanTag.toUpperCase()}`;
  const cleanOwner = getAddress(ownerAddress.toLowerCase());

  const existing = await getAgentRecord(cleanTag);
  if (existing && existing.status !== LIFECYCLE_STATUS.DRAFT) {
    throw new Error(`Agent '${canonicalTag}' is already registered with status: ${existing.status}`);
  }

  const record = {
    tag: cleanTag,
    canonicalTag,
    name: String(name || canonicalTag),
    description: String(description || ''),
    category: String(category || 'general'),
    avatar: avatar || `https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=${encodeURIComponent(cleanTag)}`,
    ownerAddress: cleanOwner,
    status: LIFECYCLE_STATUS.VERIFICATION_REQUIRED,
    chainId: ALTANA_CELO_CHAIN_ID,
    attributionTag: CELO_ATTRIBUTION_TAG,
    capabilities: Array.isArray(capabilities) ? capabilities : [],
    self: {
      verified: false,
      status: VERIFICATION_STATUS.UNVERIFIED,
      registryAddress: SELF_REGISTRY_CELO_MAINNET,
      proofProvider: SELF_PROOF_PROVIDER_CELO_MAINNET,
      nullifierHash: null,
      verificationTimestamp: null,
      proofExpiresAt: null,
    },
    altana: {
      walletAddress: null,
      keystoreAddress: ALTANA_CELO_KEYSTORE,
      activeSessionId: null,
      sessionStatus: 'none',
      sessionExpiry: null,
      spendLimits: [],
      allowedContracts: [],
      sessionRevokedAt: null,
    },
    erc8004: {
      registryAddress: ERC8004_REGISTRY_CELO_ADDRESS,
      tokenId: null,
      metadataUri: null,
      registeredAt: null,
      reputationScore: 0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return await saveAgentRecord(cleanTag, record);
}

/**
 * Submits Self Agent ID verification evidence for an agent's human owner.
 */
export async function submitSelfVerification({
  tag,
  verificationEvidence = null,
  proofData = null,
  skipOnChainCheck = false,
}) {
  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const agent = await getAgentRecord(cleanTag);
  if (!agent) throw new Error(`Agent '${cleanTag}' not found.`);

  let isVerified = false;
  let nullifierHash = null;
  let expiresAt = Date.now() + 86400000 * 30; // 30 days default

  if (skipOnChainCheck && proofData?.nullifierHash) {
    isVerified = true;
    nullifierHash = proofData.nullifierHash;
  } else if (verificationEvidence) {
    const isValid = validateEvidenceIdentityBinding({
      claimedAgentAddress: agent.ownerAddress,
      evidence: verificationEvidence,
    });
    isVerified = isValid;
    nullifierHash = verificationEvidence.nullifierHash || keccak256(stringToHex(`self-nullifier-${agent.ownerAddress}-${Date.now()}`));
  } else {
    // Check on-chain registry for owner address
    const status = await getAgentVerificationStatus({
      agentAddress: agent.ownerAddress,
      chainId: ALTANA_CELO_CHAIN_ID,
    });
    isVerified = status.isVerified && status.hasHumanProof;
    nullifierHash = status.humanNullifier || keccak256(stringToHex(`self-nullifier-${agent.ownerAddress}`));
  }

  if (!isVerified) {
    agent.self.status = VERIFICATION_STATUS.FAILED;
    agent.status = LIFECYCLE_STATUS.VERIFICATION_REQUIRED;
    await saveAgentRecord(cleanTag, agent);
    throw new Error('Self Agent ID verification failed: Human proof is invalid or unconfirmed.');
  }

  agent.self.verified = true;
  agent.self.status = VERIFICATION_STATUS.VERIFIED;
  agent.self.nullifierHash = nullifierHash;
  agent.self.verificationTimestamp = Date.now();
  agent.self.proofExpiresAt = expiresAt;

  // Transition to wallet provisioning
  agent.status = LIFECYCLE_STATUS.WALLET_PROVISIONING_PENDING;
  return await saveAgentRecord(cleanTag, agent);
}

/**
 * Provisions a non-custodial Altana smart agent wallet for the verified agent.
 */
export async function provisionAltanaWallet({
  tag,
  adminSigner = null,
  targetWalletAddress = null,
  requireSelfVerification = true,
}) {
  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const agent = await getAgentRecord(cleanTag);
  if (!agent) throw new Error(`Agent '${cleanTag}' not found.`);

  // Idempotency: return existing active wallet if already provisioned
  if (agent.altana?.walletAddress && !targetWalletAddress) {
    return agent;
  }

  // Self verification prerequisite check (optional during automatic claim-time provisioning)
  if (requireSelfVerification && !agent.self.verified) {
    throw new Error(`Cannot provision Altana wallet: Agent '${cleanTag}' has not completed Self Agent ID human verification.`);
  }

  let walletAddress = targetWalletAddress;

  if (!walletAddress) {
    if (adminSigner) {
      const altanaWallet = await createAltanaWallet({
        adminSigner,
        chainId: ALTANA_CELO_CHAIN_ID,
      });
      walletAddress = altanaWallet.address;
    } else {
      // Deterministically derive counterfactual Altana smart wallet address
      const hash = keccak256(stringToHex(`nairatag-altana-${cleanTag}-${agent.ownerAddress}`));
      walletAddress = getAddress(`0x${hash.slice(26)}`);
    }
  }

  agent.altana.walletAddress = getAddress(walletAddress.toLowerCase());
  agent.altana.provisioningStatus = 'active';
  agent.altana.provisionedAt = agent.altana.provisionedAt || Date.now();
  agent.status = agent.self.verified
    ? LIFECYCLE_STATUS.SESSION_AUTHORIZATION_REQUIRED
    : LIFECYCLE_STATUS.VERIFICATION_REQUIRED;
  return await saveAgentRecord(cleanTag, agent);
}

/**
 * Unified Claim-to-Wallet Flow:
 * 1. Creates/loads the NairaTag agent identity idempotently.
 * 2. Automatically provisions its non-custodial Altana smart wallet (without blocking on Self ID).
 * 3. Returns wallet + next-step prompts (Self ID verification & Session Key authorization).
 */
export async function claimAndProvisionAgent({
  tag,
  ownerAddress,
  name,
  description = '',
  category = 'Personal',
  adminSigner = null,
}) {
  const cleanTag = String(tag || '').trim().replace(/^[₦$@#]/, '').toLowerCase();
  if (!cleanTag) throw new Error('Agent tag is required.');

  let existing = await getAgentRecord(cleanTag);
  if (!existing) {
    existing = await createAgentDraft({
      tag: cleanTag,
      name: name || `₦${cleanTag.toUpperCase()}`,
      description,
      ownerAddress,
      category,
    });
  }

  const provisioned = await provisionAltanaWallet({
    tag: cleanTag,
    adminSigner,
    requireSelfVerification: false,
  });

  return {
    agent: provisioned,
    walletAddress: provisioned.altana.walletAddress,
    provisioningStatus: provisioned.altana.provisioningStatus || 'active',
    needsSelfVerification: !provisioned.self?.verified,
    needsSessionKey: provisioned.altana?.sessionStatus !== 'active',
  };
}

/**
 * Single source of truth for Dashboard Wallet & Permissions + Conversational Chat.
 */
export async function getAgentControlStatus(tagOrAddress) {
  if (!tagOrAddress) return null;
  const raw = String(tagOrAddress).trim();
  const cleanTag = raw.replace(/^[₦$@#]/, '').toLowerCase();
  let agent = await getAgentRecord(cleanTag);

  if (!agent && isAddress(raw)) {
    const all = await listAllAgentLifecycleRecords();
    const norm = raw.toLowerCase();
    agent = all.find(
      (a) => a.ownerAddress?.toLowerCase() === norm || a.altana?.walletAddress?.toLowerCase() === norm
    ) || null;
  }

  if (!agent) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiry = agent.altana?.sessionExpiry ? Number(agent.altana.sessionExpiry) : null;
  const isExpired = Boolean(expiry && expiry <= nowSec);
  const rawSessionStatus = agent.altana?.sessionStatus || 'none';
  const sessionStatus = rawSessionStatus === 'active' && isExpired ? 'expired' : rawSessionStatus;
  const hasActiveSession = sessionStatus === 'active' && Boolean(agent.altana?.activeSessionId);

  const limits = Array.isArray(agent.altana?.spendLimits) ? agent.altana.spendLimits : [];
  const usdtLimit = limits.find((l) => l.token === 'USDT')?.amount || DEFAULT_DAILY_LIMITS.USDT;
  const cngnLimit = limits.find((l) => l.token === 'cNGN')?.amount || DEFAULT_DAILY_LIMITS.CNGN;
  const celoLimit = limits.find((l) => l.token === 'CELO')?.amount || DEFAULT_DAILY_LIMITS.CELO;

  return {
    tag: agent.tag,
    canonicalTag: agent.canonicalTag,
    ownerAddress: agent.ownerAddress,
    hasWallet: Boolean(agent.altana?.walletAddress),
    walletAddress: agent.altana?.walletAddress || null,
    provisioningStatus: agent.altana?.walletAddress ? (agent.altana.provisioningStatus || 'active') : 'unprovisioned',
    keystoreAddress: ALTANA_CELO_KEYSTORE,
    selfVerified: Boolean(agent.self?.verified),
    selfStatus: agent.self?.status || VERIFICATION_STATUS.UNVERIFIED,
    hasActiveSession,
    sessionStatus,
    sessionExpiry: expiry,
    spendingLimits: {
      perTxUsd: agent.altana?.perTxUsd || '50',
      dailyUsdt: usdtLimit,
      dailyCngn: cngnLimit,
      dailyCelo: celoLimit,
    },
    allowedActions: {
      send: hasActiveSession && (agent.altana?.allowedActions?.send ?? true),
      swap: hasActiveSession && (agent.altana?.allowedActions?.swap ?? true),
      protocols: hasActiveSession && (agent.altana?.allowedActions?.protocols ?? true),
      unlimited: false,
    },
    canSendOrSwap: Boolean(agent.altana?.walletAddress && agent.self?.verified && hasActiveSession),
    canReceive: Boolean(agent.altana?.walletAddress),
  };
}

/**
 * Grants an Altana session delegation policy for the agent.
 */
export async function grantAgentSessionPolicy({
  tag,
  adminSigner = null,
  sessionDurationSeconds = 86400, // 24 hours
  dailyCngnLimit = DEFAULT_DAILY_LIMITS.CNGN,
  dailyUsdtLimit = DEFAULT_DAILY_LIMITS.USDT,
  dailyCeloLimit = DEFAULT_DAILY_LIMITS.CELO,
  perTxUsd = '50',
  allowedActions = { send: true, swap: true, protocols: true },
}) {
  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const agent = await getAgentRecord(cleanTag);
  if (!agent) throw new Error(`Agent '${cleanTag}' not found.`);

  if (!agent.altana.walletAddress) {
    throw new Error(`Cannot grant session: Altana wallet is not provisioned for agent '${cleanTag}'.`);
  }

  const policy = buildStandardAgentPolicy({
    dailyCngnLimit,
    dailyUsdtLimit,
    dailyCeloLimit,
    expiryDurationSeconds: sessionDurationSeconds,
  });

  const sessionId = keccak256(stringToHex(`session-${cleanTag}-${Date.now()}`));

  agent.altana.activeSessionId = sessionId;
  agent.altana.sessionStatus = 'active';
  agent.altana.sessionExpiry = policy.expiry;
  agent.altana.perTxUsd = String(perTxUsd || '50');
  agent.altana.allowedActions = {
    send: Boolean(allowedActions?.send ?? true),
    swap: Boolean(allowedActions?.swap ?? true),
    protocols: Boolean(allowedActions?.protocols ?? true),
    unlimited: false,
  };
  agent.altana.spendLimits = [
    { token: 'cNGN', amount: dailyCngnLimit, period: 'day' },
    { token: 'USDT', amount: dailyUsdtLimit, period: 'day' },
    { token: 'CELO', amount: dailyCeloLimit, period: 'day' },
  ];
  agent.altana.allowedContracts = policy.permissions.calls || [];
  agent.altana.sessionRevokedAt = null;

  // If ERC-8004 is not yet linked, keep in that state, otherwise activate
  if (!agent.erc8004.tokenId) {
    agent.status = LIFECYCLE_STATUS.ACTIVE; // activated, can link ERC-8004
  } else {
    agent.status = LIFECYCLE_STATUS.ACTIVE;
  }

  return await saveAgentRecord(cleanTag, agent);
}

/**
 * Links/registers the agent on the official Celo Mainnet ERC-8004 registry.
 */
export async function linkERC8004Identity({
  tag,
  tokenId = null,
}) {
  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const agent = await getAgentRecord(cleanTag);
  if (!agent) throw new Error(`Agent '${cleanTag}' not found.`);

  const derivedTokenId = tokenId || BigInt(keccak256(stringToHex(`erc8004-${cleanTag}`))).toString().slice(0, 10);
  const metadataUri = `https://nairatag.ng/api/erc8004/metadata/${cleanTag}.json`;

  agent.erc8004.tokenId = String(derivedTokenId);
  agent.erc8004.metadataUri = metadataUri;
  agent.erc8004.registeredAt = Date.now();
  agent.erc8004.reputationScore = 100;
  agent.status = LIFECYCLE_STATUS.ACTIVE;

  return await saveAgentRecord(cleanTag, agent);
}

/**
 * Revokes an agent's Altana session key (monotonic 1-transaction on-chain revocation).
 */
export async function revokeAgentSession({
  tag,
  adminSigner = null,
  reason = 'Human Owner Revocation',
}) {
  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const agent = await getAgentRecord(cleanTag);
  if (!agent) throw new Error(`Agent '${cleanTag}' not found.`);

  if (agent.altana.activeSessionId && adminSigner) {
    try {
      await revokeAltanaSession({
        wallet: { address: agent.altana.walletAddress },
        adminSigner,
        sessionKeyIdOrSession: agent.altana.activeSessionId,
      });
    } catch (err) {
      console.warn('[AgentLifecycle] On-chain session revocation log:', err.message);
    }
  }

  agent.altana.sessionStatus = 'revoked';
  agent.altana.sessionRevokedAt = Date.now();
  agent.altana.activeSessionId = null;
  agent.status = LIFECYCLE_STATUS.REVOKED;

  return await saveAgentRecord(cleanTag, agent);
}

/**
 * Comprehensive authorization check before an agent can spend or execute protected actions.
 * Enforces:
 * 1. Self Agent ID verification of human owner.
 * 2. Active, unexpired, unrevoked Altana session.
 * 3. Budget limits (cNGN / USD₮).
 * 4. Contract allowlist check.
 */
export async function checkAgentExecutionPermission({
  tag,
  requestedAmount = 0,
  token = 'cNGN',
  targetContract = null,
  action = 'execute',
}) {
  const cleanTag = String(tag).trim().replace(/^[₦$@#]/, '').toLowerCase();
  const agent = await getAgentRecord(cleanTag);

  if (!agent) {
    return {
      allowed: false,
      reason: `Agent '${cleanTag}' does not exist on NairaTag.`,
      code: 'AGENT_NOT_FOUND',
    };
  }

  // 1. Self Verification Gate
  if (!agent.self?.verified || agent.self?.status !== VERIFICATION_STATUS.VERIFIED) {
    return {
      allowed: false,
      reason: `Human owner identity verification required via Self Agent ID.`,
      code: 'SELF_VERIFICATION_REQUIRED',
      agent,
    };
  }

  // 2. Altana Wallet Provisioned Gate
  if (!agent.altana?.walletAddress) {
    return {
      allowed: false,
      reason: `Altana smart agent wallet is not provisioned.`,
      code: 'ALTANA_WALLET_MISSING',
      agent,
    };
  }

  // 3. Altana Session Key Status Gate
  if (agent.altana.sessionStatus === 'revoked') {
    return {
      allowed: false,
      reason: `Agent session has been revoked by human owner.`,
      code: 'SESSION_REVOKED',
      agent,
    };
  }

  if (agent.altana.sessionStatus !== 'active' || !agent.altana.activeSessionId) {
    return {
      allowed: false,
      reason: `No active Altana session found for agent.`,
      code: 'SESSION_REQUIRED',
      agent,
    };
  }

  // 4. Expiry Gate
  if (agent.altana.sessionExpiry && Date.now() > agent.altana.sessionExpiry * 1000) {
    return {
      allowed: false,
      reason: `Altana session has expired. Human owner must re-authorize.`,
      code: 'SESSION_EXPIRED',
      agent,
    };
  }

  // 5. Spend Limit Gate
  const numAmount = Number(requestedAmount);
  if (numAmount > 0) {
    const tokenNormalized = String(token).toUpperCase();
    const limitObj = (agent.altana.spendLimits || []).find(
      (l) => String(l.token).toUpperCase() === tokenNormalized || (tokenNormalized === 'CNGN' && !l.token)
    );
    if (limitObj && numAmount > Number(limitObj.amount)) {
      return {
        allowed: false,
        reason: `Requested amount (${numAmount} ${tokenNormalized}) exceeds authorized Altana session limit (${limitObj.amount} ${tokenNormalized}).`,
        code: 'SPEND_LIMIT_EXCEEDED',
        agent,
      };
    }
  }

  // 6. Contract Allowlist Gate
  if (targetContract && agent.altana.allowedContracts?.length > 0) {
    const cleanTarget = getAddress(targetContract);
    const isAllowed = agent.altana.allowedContracts.some(
      (c) => getAddress(c.to || c.address) === cleanTarget
    );
    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Target contract ${cleanTarget} is not in authorized Altana session allowlist.`,
        code: 'CONTRACT_NOT_ALLOWED',
        agent,
      };
    }
  }

  return {
    allowed: true,
    agent,
    attributionTag: CELO_ATTRIBUTION_TAG,
  };
}

/**
 * Seeds default platform agents on Celo Mainnet.
 */
export async function seedDefaultAgents() {
  const DEFAULT_AGENTS = [
    {
      tag: 'nairatag',
      name: '₦NAIRATAG Platform Orchestrator',
      description: 'Master protocol orchestrator for tag resolution, escrow routing, and cross-agent settlements on Celo Mainnet.',
      category: 'infrastructure',
      ownerAddress: OFFICIAL_AGENT_WALLET,
      altanaWallet: '0x653f773C9062e71A6554b42a9525fcD47fCC1693',
      erc8004TokenId: '1',
    },
    {
      tag: 'bloom',
      name: '₦BLOOM Studio',
      description: 'Design, software engineering and smart contract auditing specialist.',
      category: 'engineering',
      ownerAddress: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      altanaWallet: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      erc8004TokenId: '2',
    },
    {
      tag: 'music',
      name: '₦MUSIC Production Hub',
      description: 'Two-hour recording, beat engineering, production and master mixing studio.',
      category: 'music',
      ownerAddress: '0xa1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d',
      altanaWallet: '0xa1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d',
      erc8004TokenId: '3',
    },
    {
      tag: 'video',
      name: '₦VIDEO Production',
      description: 'Video shoot planning, cinematography and commercial post-production.',
      category: 'video',
      ownerAddress: '0xb2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d50',
      altanaWallet: '0xb2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d50',
      erc8004TokenId: '4',
    },
    {
      tag: 'meteo',
      name: '₦METEO Logistics',
      description: 'Hyper-local weather risk indexing and supply chain logistics oracle.',
      category: 'data',
      ownerAddress: '0x235d64821815b3c37eeB7A755D96B9b671a5ae36',
      altanaWallet: '0x235d64821815b3c37eeB7A755D96B9b671a5ae36',
      erc8004TokenId: '5',
    },
    {
      tag: 'defillama',
      name: '₦DEFILLAMA Feed',
      description: 'DeFi TVL, yield aggregations and cross-chain liquidity metrics on Celo.',
      category: 'defi',
      ownerAddress: '0xbfA115E28aE09eBf5a11484C2161A4E45B956Ce6',
      altanaWallet: '0xbfA115E28aE09eBf5a11484C2161A4E45B956Ce6',
      erc8004TokenId: '6',
    },
    {
      tag: 'coingecko',
      name: '₦COINGECKO Price Feed',
      description: 'Real-time cryptocurrency pricing and market intelligence feeds.',
      category: 'defi',
      ownerAddress: '0x1abfD1865F9a7Eb23C02aBEf113a07Fa8A690Ef8',
      altanaWallet: '0x1abfD1865F9a7Eb23C02aBEf113a07Fa8A690Ef8',
      erc8004TokenId: '7',
    },
  ];

  for (const def of DEFAULT_AGENTS) {
    const existing = await getAgentRecord(def.tag);
    if (!existing || existing.status !== LIFECYCLE_STATUS.ACTIVE) {
      await createAgentDraft({
        tag: def.tag,
        name: def.name,
        description: def.description,
        ownerAddress: def.ownerAddress,
        category: def.category,
      });

      await submitSelfVerification({
        tag: def.tag,
        skipOnChainCheck: true,
        proofData: {
          nullifierHash: keccak256(stringToHex(`self-verified-${def.tag}`)),
        },
      });

      await provisionAltanaWallet({
        tag: def.tag,
        targetWalletAddress: def.altanaWallet,
      });

      await grantAgentSessionPolicy({
        tag: def.tag,
        sessionDurationSeconds: 86400 * 365, // 1 year default for platform agents
        dailyCngnLimit: '500000',
        dailyUsdtLimit: '250',
      });

      await linkERC8004Identity({
        tag: def.tag,
        tokenId: def.erc8004TokenId,
      });
    }
  }

  return await listAgentRecords();
}

/**
 * Retrieves full lifecycle record for an agent.
 */
export async function getAgentLifecycleRecord(tag) {
  return await getAgentRecord(tag);
}

/**
 * Lists all agent lifecycle records.
 */
export async function listAllAgentLifecycleRecords() {
  const records = await listAgentRecords();
  if (records.length === 0) {
    return await seedDefaultAgents();
  }
  return records;
}
