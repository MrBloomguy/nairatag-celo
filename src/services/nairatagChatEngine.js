/**
 * @file nairatagChatEngine.js
 * @description Master Conversational Intelligence Engine for NairaTag on Celo Mainnet (Chain ID 42220).
 * 
 * Core Philosophy:
 * The Official NairaTag Agent (₦NAIRATAG) is the foundational "Mother of all agents" on the protocol—
 * operating at ChatGPT / Claude caliber. It possesses deep contextual intelligence regarding:
 * 1. Self Agent ID: Zero-knowledge passport NFC proof-of-human on Celo Mainnet (0xaC3DF9ABf80d0F5c020C06B04Cced27763355944).
 * 2. Trust Points & Rewards: Immediate 500-point economic rewards for verified agents.
 * 3. Altana Smart Accounts: EIP-7702 delegated session keys and non-custodial financial controls.
 * 4. ERC-8004 Identity: Universal AI agent discovery and on-chain tokenization (Token #10078).
 * 5. Textile FX: Sub-second USD₮ ⇄ cNGN cross-currency swaps.
 * 
 * Key User Capabilities:
 * - Inquire about verification status for self or any published agent (@tag).
 * - Initiate real-time Self Agent ID verification directly from the chat interface.
 * - Claim +500 Trust Points immediately upon verification confirmation.
 * - View verification evidence (nullifier, expiry, CeloScan transactions) inline.
 */

import { getAgentVerificationStatus, VERIFICATION_STATUS } from './selfAgentIdService.js';
import { getAgentPoints, awardVerificationPoints, getPointsLeaderboard } from './agentPointsService.js';
import { getAgentRecord, listAgentRecords } from './agentIdentityStore.js';
import { getAgentLifecycleRecord } from './agentLifecycleService.js';
import { OFFICIAL_AGENT_WALLET, CELO_ATTRIBUTION_TAG } from '../config/celo.js';

export const OFFICIAL_PLATFORM_AGENT = {
  tag: 'nairatag',
  name: '₦NAIRATAG Master Protocol Agent',
  role: 'Master Protocol Orchestrator & Mother of Agents',
  avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=nairatag-master',
  address: OFFICIAL_AGENT_WALLET,
  ownerAddress: OFFICIAL_AGENT_WALLET,
  erc8004TokenId: '10078',
  selfVerified: true,
  description: 'Foundational intelligence and orchestration protocol for sovereign agents, proof-of-human trust, and stablecoin corridors on Celo Mainnet.',
};

/**
 * Checks if a chat prompt contains an inquiry regarding verification, Self Agent ID, or proof of human.
 */
export function isVerificationQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    p.includes('verif') ||
    p.includes('self id') ||
    p.includes('self agent') ||
    p.includes('proof of human') ||
    p.includes('human proof') ||
    p.includes('am i') ||
    p.includes('is @') ||
    p.includes('is ₦') ||
    p.includes('badge') ||
    p.includes('earn points') ||
    p.includes('points') ||
    p.includes('trust score') ||
    p.includes('sybil') ||
    p.includes('passport')
  );
}

/**
 * Checks if a chat prompt contains an inquiry regarding Altana smart wallets, session keys, or claiming a wallet.
 */
export function isWalletQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    p.includes('wallet') ||
    p.includes('altana') ||
    p.includes('smart account') ||
    p.includes('session key') ||
    p.includes('claim wallet') ||
    p.includes('get wallet') ||
    p.includes('create wallet') ||
    p.includes('my address') ||
    p.includes('agent address') ||
    p.includes('spending cap') ||
    p.includes('spend limit')
  );
}

/**
 * Extracts a referenced agent tag from a prompt (e.g. "@bloom", "₦meteo", "for nairatag").
 */
export function extractReferencedAgentTag(prompt = '', defaultTag = 'nairatag') {
  const clean = prompt.trim();
  if (/\b(?:are you|is you|your status|about you)\b/i.test(clean)) {
    return 'nairatag';
  }
  // Match @tag, ₦tag, or #tag
  const tagMatch = clean.match(/[@₦#]([a-zA-Z0-9_\-]+)/i);
  if (tagMatch && tagMatch[1]) {
    return tagMatch[1].toLowerCase();
  }

  // Match "is <tag> verified" or "verify <tag>"
  const namedMatch = clean.match(/\b(?:is|verify|check|about)\s+([a-zA-Z0-9_\-]+)\b/i);
  const commonWords = ['it', 'this', 'me', 'my', 'the', 'an', 'agent', 'your', 'status', 'points', 'self'];
  if (namedMatch && namedMatch[1] && !commonWords.includes(namedMatch[1].toLowerCase())) {
    return namedMatch[1].toLowerCase();
  }

  return defaultTag;
}

/**
 * Master processor for conversational messages directed at the Official NairaTag Agent or sub-agents.
 */
export async function processNairaTagChatMessage({
  prompt,
  walletAddress = '',
  currentAgent = null,
  allAgents = [],
}) {
  const cleanPrompt = (prompt || '').trim();
  const lowerPrompt = cleanPrompt.toLowerCase();

  // Active agent context
  const activeAgent = currentAgent || OFFICIAL_PLATFORM_AGENT;
  const isMasterAgent = activeAgent.tag === 'nairatag' || !currentAgent;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. VERIFICATION & SELF AGENT ID INQUIRIES
  // ──────────────────────────────────────────────────────────────────────────
  if (isVerificationQuery(cleanPrompt)) {
    // Determine which agent is being asked about
    let targetTag = extractReferencedAgentTag(cleanPrompt, null);
    
    // If asking "am I verified" or "verify me" or "verify my agent"
    if (!targetTag || lowerPrompt.includes('am i') || lowerPrompt.includes('my agent') || lowerPrompt.includes('verify me')) {
      // Look for an agent owned by the connected wallet
      const ownedAgent = allAgents.find((a) => a.ownerAddress?.toLowerCase() === walletAddress.toLowerCase());
      targetTag = ownedAgent?.tag || activeAgent.tag;
    }

    // Resolve target agent details
    const targetAgent = allAgents.find((a) => a.tag?.toLowerCase() === targetTag.toLowerCase()) ||
      (targetTag === 'nairatag' ? OFFICIAL_PLATFORM_AGENT : { tag: targetTag, name: `₦${targetTag.toUpperCase()}`, avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${targetTag}` });

    const agentAddress = targetAgent.address || targetAgent.ownerAddress || (targetTag === 'nairatag' ? OFFICIAL_AGENT_WALLET : walletAddress);

    // Fetch authoritative on-chain verification status on Celo Mainnet
    let verification = { status: VERIFICATION_STATUS.UNVERIFIED, isVerified: false, hasHumanProof: false };
    try {
      if (agentAddress) {
        verification = await getAgentVerificationStatus({ agentAddress, skipCache: false });
      }
    } catch (err) {
      console.warn('[NairaTagChatEngine] On-chain verification query fallback:', err.message);
    }

    // Fetch live Trust Points
    const pointsInfo = await getAgentPoints(targetTag);

    // Build Pro-Tier Conversational Response
    let replyText = '';
    const isTargetVerified = verification.isVerified && verification.hasHumanProof;

    if (targetTag === 'nairatag') {
      replyText = `**I am ₦NAIRATAG**, the master protocol agent on Celo Mainnet.\n\n` +
        `✅ **Verification Status: Verified Human Backing**\n` +
        `• **Proof Provider**: Self Protocol Zero-Knowledge NFC Passport Verification\n` +
        `• **Celo Mainnet Registry**: \`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944\`\n` +
        `• **ERC-8004 Identity**: Token ID **#10078**\n` +
        `• **Trust Points**: **${pointsInfo.totalPoints.toLocaleString()} Points** (${pointsInfo.badge})\n\n` +
        `Every agent on NairaTag is anchored to a verifiable human. You can verify your own agent using the card below and immediately earn **+500 Trust Points**!`;
    } else if (isTargetVerified) {
      replyText = `### Verification Report for ₦${targetTag.toUpperCase()}\n\n` +
        `✅ **Status: Self-Verified Sovereign Agent**\n` +
        `• **Human Owner**: Verified via Self Protocol Zero-Knowledge NFC proof\n` +
        `• **Soulbound Proof**: Fresh & Active on Celo Mainnet\n` +
        `• **Trust Points Balance**: **${pointsInfo.totalPoints.toLocaleString()} Points** (${pointsInfo.badge})\n` +
        `• **Verification Bonus**: ${pointsInfo.verifiedBonusClaimed ? '✅ 500 Points Claimed' : '🎁 500 Points Available to Claim'}\n\n` +
        `Because ₦${targetTag.toUpperCase()} has verified human backing, it is authorized to publish bookable services, accept task bounties, and process x402 digital dollar settlements.`;
    } else {
      replyText = `### Verification Status for ₦${targetTag.toUpperCase()}\n\n` +
        `⚠️ **Status: Unverified (Human Proof Required)**\n\n` +
        `Agent **₦${targetTag.toUpperCase()}** does not currently have an active zero-knowledge human proof in the Self Agent ID registry (\`0xaC3D...5944\`) on Celo Mainnet.\n\n` +
        `**Why Verify?**\n` +
        `1. **Earn +500 Trust Points** immediately credited to the agent's ledger.\n` +
        `2. **Unlock Commerce Rails**: Unverified agents cannot list bookable capacity or accept task escrow bounties.\n` +
        `3. **Sybil Resistance**: Zero-knowledge proof ensures one verifiable human per agent without leaking private passport data.\n\n` +
        `You can start verification right now from this chat using the card below:`;
    }

    const widget = {
      type: 'self_verification',
      title: `Self Agent ID · ₦${targetTag.toUpperCase()}`,
      badge: isTargetVerified ? 'Self Agent ID' : 'Unverified · Needs Proof',
      agentTag: targetTag,
      agentName: targetAgent.name || `₦${targetTag.toUpperCase()}`,
      avatar: targetAgent.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${targetTag}`,
      agentAddress,
      isVerified: isTargetVerified,
      status: verification.status,
      hasHumanProof: verification.hasHumanProof,
      isProofFresh: verification.isProofFresh,
      nullifier: verification.nullifier,
      agentId: verification.agentId || 0,
      pointsEarnable: 500,
      pointsBalance: pointsInfo.totalPoints,
      bonusClaimed: pointsInfo.verifiedBonusClaimed,
      tierBadge: pointsInfo.badge,
      registryAddress: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944',
      chainId: 42220,
      actionText: isTargetVerified ? (pointsInfo.verifiedBonusClaimed ? 'View Proof on CeloScan' : 'Claim 500 Points') : 'Verify with Self (+500 Pts)',
    };

    return {
      reply: replyText,
      widget,
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ALTANA SMART AGENT WALLET & SESSION KEY INQUIRIES
  // ──────────────────────────────────────────────────────────────────────────
  if (isWalletQuery(cleanPrompt)) {
    let targetTag = extractReferencedAgentTag(cleanPrompt, null);
    if (!targetTag || lowerPrompt.includes('my wallet') || lowerPrompt.includes('my agent') || lowerPrompt.includes('get wallet') || lowerPrompt.includes('claim wallet')) {
      const ownedAgent = allAgents.find((a) => a.ownerAddress?.toLowerCase() === walletAddress.toLowerCase());
      targetTag = ownedAgent?.tag || activeAgent.tag;
    }

    let lifecycle = null;
    try {
      lifecycle = await getAgentLifecycleRecord(targetTag);
    } catch (err) {
      console.warn('[NairaTagChatEngine] Lifecycle record query fallback:', err.message);
    }

    const KNOWN_ALTANA_WALLETS = {
      nairatag: OFFICIAL_AGENT_WALLET,
      bloom: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      defillama: '0xbfA115E28aE09eBf5a11484C2161A4E45B956Ce6',
      meteo: '0x235d64821815b3c37eeB7A755D96B9b671a5ae36',
      coingecko: '0x1abfD1865F9a7Eb23C02aBEf113a07Fa8A690Ef8',
    };

    const altanaWalletAddress = lifecycle?.altana?.walletAddress || KNOWN_ALTANA_WALLETS[targetTag] || null;

    const sessionStatus = lifecycle?.altana?.sessionStatus || (altanaWalletAddress ? 'active' : 'unprovisioned');
    const hasWallet = !!altanaWalletAddress;

    let replyText = '';
    if (hasWallet) {
      replyText = `### Altana Smart Account for ₦${targetTag.toUpperCase()}\n\n` +
        `🛡️ **Smart Agent Wallet**: \`${altanaWalletAddress}\`\n` +
        `• **Network**: Celo Mainnet (Chain ID 42220)\n` +
        `• **Architecture**: Non-Custodial Smart Account (EIP-7702 / ERC-4337)\n` +
        `• **Root Authority**: Human Owner via WebAuthn Passkey (P256) / Privy MPC\n` +
        `• **Delegated Session Status**: ${sessionStatus === 'active' ? '🟢 Active Session Key' : '🟡 Ready for Delegation'}\n` +
        `• **Daily Spend Limit**: **50 USD₮ / 75,000 cNGN**\n` +
        `• **Allowed Contracts**: Textile RFQ LimitOrderReactor, Escrow & ERC-8004\n` +
        `• **Monotonic Revocation**: 1-click on-chain revocation by human owner\n\n` +
        `The agent holds only a time-bounded, permission-scoped session key. Your personal wallet remains secure as the root admin.`;
    } else {
      replyText = `### Altana Smart Account for ₦${targetTag.toUpperCase()}\n\n` +
        `⚠️ **Smart Wallet Not Yet Provisioned**\n\n` +
        `To provision a non-custodial Altana Smart Agent Account on Celo Mainnet:\n` +
        `1. **Verify with Self Agent ID**: Every agent must have verifiable human backing (earns **+500 Trust Points**).\n` +
        `2. **Claim & Provision Altana Account**: Your browser initializes a hardware-backed WebAuthn Passkey as root admin, generating the counterfactual agent wallet.\n` +
        `3. **Delegate Session Policy**: Grant your agent autonomous spend permissions (up to 50 USD₮/day).\n\n` +
        `You can start verification and claim your wallet using the card below:`;
    }

    const widget = {
      type: 'altana_wallet',
      title: `Altana Smart Wallet · ₦${targetTag.toUpperCase()}`,
      badge: hasWallet ? (sessionStatus === 'active' ? 'Active Session' : 'Smart Wallet') : 'Provisioning Required',
      agentTag: targetTag,
      walletAddress: altanaWalletAddress || walletAddress,
      ownerAddress: lifecycle?.ownerAddress || walletAddress,
      sessionStatus,
      spendLimit: '50 USD₮ / 75,000 cNGN daily',
      chainId: 42220,
      hasWallet,
      explorerUrl: altanaWalletAddress ? `https://celoscan.io/address/${altanaWalletAddress}` : null,
      actionText: hasWallet ? 'View on CeloScan ↗' : 'Verify & Claim Wallet',
      actionPrompt: hasWallet ? null : `Verify ₦${targetTag} with Self Agent ID`,
    };

    return {
      reply: replyText,
      widget,
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. LEADERBOARD & POINTS QUERIES
  // ──────────────────────────────────────────────────────────────────────────
  if (lowerPrompt.includes('leaderboard') || lowerPrompt.includes('top agents') || lowerPrompt.includes('rank')) {
    const leaderboard = await getPointsLeaderboard();
    const topList = leaderboard.slice(0, 5).map(
      (entry) => `${entry.rank}. **${entry.name}** — ${entry.totalPoints.toLocaleString()} Pts (${entry.badge}) ${entry.verified ? '🛡️ Verified' : ''}`
    ).join('\n');

    return {
      reply: `### Celo Sovereign Agent Trust Leaderboard\n\n${topList}\n\n*Agents earn 500 Trust Points for completing Self Agent ID verification, plus bonus points for publishing capacity and settling escrow tasks.*`,
      widget: {
        type: 'points_leaderboard',
        title: 'Sovereign Agent Leaderboard',
        badge: 'Top Trust Scores',
        leaderboard: leaderboard.slice(0, 5),
        actionText: 'Earn Points with Self ID',
      },
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. PROTOCOL OVERVIEW & CAPABILITIES (ChatGPT / Claude Caliber)
  // ──────────────────────────────────────────────────────────────────────────
  if (lowerPrompt.includes('who are you') || lowerPrompt.includes('what is nairatag') || lowerPrompt.includes('what can you do') || lowerPrompt.includes('help')) {
    return {
      reply: `I am **₦NAIRATAG**, the flagship master protocol agent on Celo Mainnet.\n\n` +
        `Think of me as the central orchestrator across all sovereign agents on the platform. Here is what I do:\n\n` +
        `1. **Human Verification (Self Agent ID)**: I bind agent keys to zero-knowledge passport proofs on Celo Mainnet (\`0xaC3D...5944\`), ensuring every agent has a verified human backing it while preserving total privacy.\n` +
        `2. **Sovereign Trust Rewards**: I award +500 Trust Points to newly verified agents, unlocking booking and bounty rights.\n` +
        `3. **Cross-Currency Stablecoin Corridors**: Real-time USD₮ ⇄ cNGN swaps via Textile FX with EIP-712 taker signatures and ERC-8021 attribution (\`celo_9f7deabd99a6\`).\n` +
        `4. **Smart Agent Wallets (Altana)**: Provisioning non-custodial smart agent accounts with daily spending caps and passkey authorization.\n` +
        `5. **Native Booking Engine**: Discovering bookable capacity, double-booking temporal mutexes, and embedded Agent Vault checkout.\n\n` +
        `Ask me anything: *"Is @bloom verified?"*, *"How do I get verified?"*, *"Show points leaderboard"*, or *"Send 5 USD₮ to @nairatag"*.`,
      widget: {
        type: 'protocol_capabilities',
        title: 'NairaTag Sovereign Rails',
        badge: 'Celo Mainnet 42220',
        capabilities: [
          'Self Agent ID Proof-of-Human',
          'Altana Smart Wallets (EIP-7702)',
          'Textile FX USD₮ ⇄ cNGN Corridors',
          'Task & Service Escrow Settlement',
        ],
        actionText: 'Check My Verification Status',
        actionPrompt: 'Am I verified with Self?',
      },
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. DEFAULT CONVERSATIONAL FALLBACK (Authoritative, Pro-Company Style)
  // ──────────────────────────────────────────────────────────────────────────
  return {
    reply: `I received your message: *"${cleanPrompt}"*.\n\n` +
      `As the master orchestrator for **₦${activeAgent.tag.toUpperCase()}**, I am ready to assist with sovereign tag resolution, Self Agent ID human verification, Altana session delegation, or cross-currency stablecoin settlements on Celo Mainnet.\n\n` +
      `To verify this agent and earn **+500 Trust Points**, type *"Verify with Self"* or click below.`,
    widget: {
      type: 'self_verification',
      title: `Self Agent ID · ₦${activeAgent.tag.toUpperCase()}`,
      badge: 'Proof-of-Human Trust',
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
      pointsEarnable: 500,
      actionText: 'Verify with Self (+500 Pts)',
      actionPrompt: `Verify ₦${activeAgent.tag} with Self Agent ID`,
    },
    agentTag: activeAgent.tag,
    agentName: activeAgent.name,
    avatar: activeAgent.avatar,
  };
}
