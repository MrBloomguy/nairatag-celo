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
import { getAgentLifecycleRecord, getAgentControlStatus } from './agentLifecycleService.js';
import { OFFICIAL_AGENT_WALLET, CELO_ATTRIBUTION_TAG } from '../config/celo.js';
import {
  prepareDirectSend,
  createPaymentRequest,
  listPaymentRequests,
  getPaymentRequest,
  cancelPaymentRequest,
  listAllReceipts,
  resolveTokenDescriptor,
  PAYMENT_REQUEST_STATES,
} from './unifiedPaymentEngine.js';
import { getIndicativePreview, toAtomicUnits } from './textileRfqService.js';

export const OFFICIAL_PLATFORM_AGENT = {
  tag: 'nairatag',
  name: '₦NAIRATAG Master Protocol Agent',
  role: 'Master Protocol Orchestrator & Mother of Agents',
  avatar: 'https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=nairatag-master',
  address: OFFICIAL_AGENT_WALLET,
  ownerAddress: OFFICIAL_AGENT_WALLET,
  erc8004TokenId: '10078',
  selfVerified: false,
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
    p.includes('spend limit') ||
    p.includes('permission') ||
    p.includes('revoke') ||
    p.includes('authorize') ||
    p.includes('can my agent') ||
    p.includes('send or swap')
  );
}

/**
 * Checks if a prompt is an instruction to send money/tokens to a tag.
 * e.g. "Send ₦SEGUN 20 USDT", "Send ₦SEGUN $20 worth of cNGN. I have USD₮."
 */
export function isSendMoneyQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    (p.startsWith('send') || p.startsWith('transfer') || (p.startsWith('pay') && !p.includes('invoice') && !p.includes('milestone') && !p.includes('designer') && !p.includes('outstanding'))) &&
    (p.includes('usdt') || p.includes('usd₮') || p.includes('cngn') || p.includes('naira') || p.includes('$') || p.includes('₦')) &&
    !p.includes('request') &&
    !p.includes('how much')
  );
}

/**
 * Checks if a prompt is inquiring about a Textile FX conversion quote or rate.
 * e.g. "How much cNGN will ₦SEGUN receive for 20 USDT?", "Rate for USDT to cNGN"
 */
export function isQuoteOrRateQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    p.includes('how much') ||
    p.includes('quote') ||
    p.includes('rate') ||
    p.includes('conversion rate') ||
    p.includes('exchange rate')
  ) && (
    p.includes('usdt') || p.includes('usd₮') || p.includes('cngn') || p.includes('naira')
  );
}

/**
 * Checks if a prompt is requesting payment from another tag.
 * e.g. "Request 30,000 cNGN from ₦BLOOM for my completed design work."
 */
export function isPaymentRequestQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    p.startsWith('request') ||
    p.includes('request payment') ||
    (p.includes('request') && (p.includes('from ₦') || p.includes('from @') || p.includes('cngn') || p.includes('usdt')))
  ) && !p.includes('pending') && !p.includes('show');
}

/**
 * Checks if a prompt is asking to show pending payment requests / invoices.
 * e.g. "Show my pending payment requests.", "Pending invoices"
 */
export function isPendingInvoicesQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    (p.includes('pending') && (p.includes('request') || p.includes('invoice') || p.includes('payment'))) ||
    p.includes('show my payment requests') ||
    p.includes('list payment requests') ||
    p.includes('outstanding invoice')
  ) && !p.startsWith('pay');
}

/**
 * Checks if a prompt is asking to pay an outstanding invoice or approved milestone.
 * e.g. "Pay ₦SEGUN's outstanding invoice.", "Pay the designer after approving the milestone."
 */
export function isPayInvoiceQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    p.includes('pay') &&
    (p.includes('invoice') || p.includes('outstanding') || p.includes('milestone') || p.includes('designer') || p.includes('pr_'))
  );
}

/**
 * Checks if a prompt is inquiring about payment status.
 * e.g. "What's the status of my last payment?"
 */
export function isPaymentStatusQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    (p.includes('status of') && (p.includes('payment') || p.includes('transfer') || p.includes('swap') || p.includes('corridor'))) ||
    p.includes('last payment')
  );
}

/**
 * Checks if a prompt is asking to cancel a payment request.
 * e.g. "Cancel my pending payment request."
 */
export function isCancelPaymentRequestQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    p.includes('cancel') && (p.includes('request') || p.includes('payment request') || p.includes('invoice'))
  );
}

/**
 * Checks if a prompt is asking for conversion history.
 * e.g. "Show me the conversion history for ₦MUSIC."
 */
export function isPaymentHistoryQuery(prompt = '') {
  const p = prompt.toLowerCase();
  return (
    p.includes('conversion history') ||
    p.includes('payment history') ||
    p.includes('transaction history')
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
      (targetTag === 'nairatag' ? OFFICIAL_PLATFORM_AGENT : { tag: targetTag, name: `₦${targetTag.toUpperCase()}`, avatar: `https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=${targetTag}` });

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
    const isTargetVerified = verification.isVerified && verification.hasHumanProof && verification.isProofFresh;

    if (targetTag === 'nairatag' && isTargetVerified) {
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
      avatar: targetAgent.avatar || `https://api.dicebear.com/11.x/adventurer-neutral/svg?seed=${targetTag}`,
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

    const controlStatus = (await getAgentControlStatus(targetTag)) || {};

    const KNOWN_ALTANA_WALLETS = {
      nairatag: OFFICIAL_AGENT_WALLET,
      bloom: '0x7c264210D5C992b8ea3224eb6B39F477a493AF26',
      defillama: '0xbfA115E28aE09eBf5a11484C2161A4E45B956Ce6',
      meteo: '0x235d64821815b3c37eeB7A755D96B9b671a5ae36',
      coingecko: '0x1abfD1865F9a7Eb23C02aBEf113a07Fa8A690Ef8',
    };

    const altanaWalletAddress = controlStatus.walletAddress || lifecycle?.altana?.walletAddress || KNOWN_ALTANA_WALLETS[targetTag] || null;
    const sessionStatus = controlStatus.hasActiveSession
      ? 'active'
      : controlStatus.sessionStatus !== 'unprovisioned'
        ? controlStatus.sessionStatus
        : (KNOWN_ALTANA_WALLETS[targetTag] ? 'active' : 'unprovisioned');
    const hasWallet = Boolean(altanaWalletAddress);
    const isRevokeRequest = lowerPrompt.includes('revoke');
    const isGrantRequest = lowerPrompt.includes('grant') || lowerPrompt.includes('authorize') || lowerPrompt.includes('give ') || lowerPrompt.includes('allow ');

    let replyText = '';
    if (isRevokeRequest && hasWallet) {
      replyText = `### Revoke Altana Session Permissions · ₦${targetTag.toUpperCase()}\n\n` +
        `• **Altana Wallet**: \`${altanaWalletAddress}\`\n` +
        `• **Current Session Status**: ${sessionStatus === 'active' ? '🟢 Active Session Key' : sessionStatus === 'revoked' ? '🔴 Already Revoked' : '🟡 Not Authorized'}\n\n` +
        `Only the verified human owner can revoke an agent's session key. Open **₦${targetTag.toUpperCase()} → Wallet & Permissions (Altana)** and click **Revoke Agent Permissions** to confirm revocation immediately.`;
    } else if (isGrantRequest && hasWallet) {
      replyText = `### Proposed Altana Session Key · ₦${targetTag.toUpperCase()}\n\n` +
        `I have prepared a scoped Altana session policy for owner approval:\n` +
        `• **Max Per Transaction**: $${controlStatus.spendingLimits?.perTxUsd || '50'}\n` +
        `• **Daily Caps**: ${controlStatus.spendingLimits?.dailyUsdt || '50'} USD₮ / ${controlStatus.spendingLimits?.dailyCngn || '100000'} cNGN\n` +
        `• **Allowed Actions**: Send payments · Swap tokens · Approved protocols\n` +
        `• **Unlimited Spending**: Not allowed\n` +
        `• **Owner Self ID**: ${controlStatus.selfVerified ? '✅ Verified Human' : '⚠️ Verification Required First'}\n\n` +
        `⚠️ **Owner Confirmation Required**: An agent cannot authorize its own spending. Open **₦${targetTag.toUpperCase()} → Wallet & Permissions (Altana)** to review and sign with your owner wallet.`;
    } else if (hasWallet) {
      const canSend = controlStatus.selfVerified && sessionStatus === 'active';
      replyText = `### Altana Smart Account for ₦${targetTag.toUpperCase()}\n\n` +
        `🛡️ **Smart Agent Wallet**: \`${altanaWalletAddress}\` (**Active**)\n` +
        `• **Architecture**: Non-Custodial Smart Account (EIP-7702 / ERC-4337)\n` +
        `• **Owner Self ID**: ${controlStatus.selfVerified ? '✅ Verified Human' : '⚠️ Pending Verification'}\n` +
        `• **Session Key Status**: ${sessionStatus === 'active' ? '🟢 Active Session Key' : sessionStatus === 'revoked' ? '🔴 Revoked by Owner' : '🟡 Not Authorized'}\n` +
        `• **Receive Capability**: ✅ Ready to receive USDC / USD₮ / cNGN\n` +
        `• **Send & Swap Capability**: ${canSend ? '✅ Authorized within scoped limits' : !controlStatus.selfVerified ? '🔒 Blocked — Owner Self ID verification required' : '🔒 Blocked — Owner session key authorization required'}\n` +
        `• **Spending Limits**: $${controlStatus.spendingLimits?.perTxUsd || '50'}/tx · ${controlStatus.spendingLimits?.dailyUsdt || '50'} USD₮/day · ${controlStatus.spendingLimits?.dailyCngn || '100000'} cNGN/day\n` +
        `• **Allowed Actions**: Send · Swap · Approved protocols (Unlimited spending: Not allowed)\n\n` +
        `The agent holds only a time-bounded, permission-scoped session key. Your personal wallet remains secure as the root admin.`;
    } else {
      replyText = `### Altana Smart Account for ₦${targetTag.toUpperCase()}\n\n` +
        `⚠️ **Smart Wallet Not Yet Provisioned**\n\n` +
        `Claiming a NairaTag automatically provisions an Altana smart wallet for the agent:\n` +
        `1. **Claim Tag & Provision Wallet**: Your agent immediately receives its own Altana wallet address.\n` +
        `2. **Verify with Self Agent ID**: Confirm human ownership to unlock payments, swaps, and agent services (**+500 Trust Points**).\n` +
        `3. **Grant Session Key**: Authorize scoped spending limits (up to 50 USD₮/day) with 1-click owner revocation.\n\n` +
        `You can start verification and claim your wallet using the card below:`;
    }

    const widget = {
      type: 'altana_wallet',
      title: `Altana Smart Wallet · ₦${targetTag.toUpperCase()}`,
      badge: hasWallet ? (sessionStatus === 'active' ? 'Active Session' : sessionStatus === 'revoked' ? 'Session Revoked' : 'Wallet Active') : 'Provisioning Required',
      agentTag: targetTag,
      walletAddress: altanaWalletAddress || walletAddress,
      ownerAddress: controlStatus.ownerAddress || lifecycle?.ownerAddress || walletAddress,
      sessionStatus,
      selfVerified: controlStatus.selfVerified,
      canReceive: hasWallet,
      canSendOrSwap: hasWallet && controlStatus.selfVerified && sessionStatus === 'active',
      spendLimit: `${controlStatus.spendingLimits?.dailyUsdt || '50'} USD₮ / ${controlStatus.spendingLimits?.dailyCngn || '100000'} cNGN daily`,
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
  // 3. DIRECT TAG-TO-TAG SEND INSTRUCTION
  // Example: "Send ₦SEGUN 20 USDT", "Send ₦SEGUN $20 worth of cNGN. I have USD₮."
  // ──────────────────────────────────────────────────────────────────────────
  if (isSendMoneyQuery(cleanPrompt)) {
    const targetTag = extractReferencedAgentTag(cleanPrompt, 'segun');
    const amtMatch = cleanPrompt.match(/(?:[$₦]\s*)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
    const amount = amtMatch ? amtMatch[1].replace(/,/g, '') : '20';

    let sourceToken = 'USDT';
    let targetToken = 'cNGN';

    if (/have usdt|from usdt|with usdt|worth of cngn/i.test(cleanPrompt)) {
      sourceToken = 'USDT';
      targetToken = 'cNGN';
    } else if (/have cngn|from cngn|with cngn|worth of usdt/i.test(cleanPrompt)) {
      sourceToken = 'cNGN';
      targetToken = 'USDT';
    } else if (/\b(usdt|usd₮)\b/i.test(cleanPrompt) && !/\bcngn\b/i.test(cleanPrompt)) {
      sourceToken = 'USDT';
      targetToken = 'USDT';
    } else if (/\bcngn\b/i.test(cleanPrompt) && !/\b(usdt|usd₮)\b/i.test(cleanPrompt)) {
      sourceToken = 'cNGN';
      targetToken = 'cNGN';
    }

    let prepared = null;
    let prepError = null;
    try {
      prepared = await prepareDirectSend({
        recipientTagOrAddress: targetTag,
        amount,
        sourceToken,
        targetToken,
        senderAddress: walletAddress || null,
      });
    } catch (err) {
      prepError = err.message;
    }

    let replyText = '';
    if (prepared) {
      if (prepared.isCrossToken) {
        replyText = `### Tag-to-Tag Payment to ₦${targetTag.toUpperCase()}\n\n` +
          `₦${targetTag.toUpperCase()} will receive approximately **${prepared.estimatedDelivery} ${prepared.targetToken}** on Celo Mainnet.\n\n` +
          `• **Source Amount**: **${prepared.amountSent} ${prepared.sourceToken}**\n` +
          `• **Infrastructure**: Textile FX RFQ Corridor (Celo Mainnet)\n` +
          `• **Effective Rate**: 1 ${prepared.sourceToken} ≈ ${prepared.effectiveRate} ${prepared.targetToken}\n` +
          `• **Conversion Fee**: ${prepared.conversionFee} ${prepared.sourceToken} (Textile RFQ v2)\n` +
          `• **Recipient Address**: \`${prepared.recipientAddress}\`\n` +
          `• **Attribution Tag**: \`${CELO_ATTRIBUTION_TAG}\` (ERC-8021 Calldata)\n\n` +
          `Your ${prepared.amountSent} ${prepared.sourceToken} will be converted through Textile FX and settled directly to ₦${targetTag.toUpperCase()}'s verified address. Confirm payment?`;
      } else {
        replyText = `### Direct Tag-to-Tag Send to ₦${targetTag.toUpperCase()}\n\n` +
          `You are sending **${prepared.amountSent} ${prepared.sourceToken}** directly to ₦${targetTag.toUpperCase()}.\n\n` +
          `• **Recipient Tag**: \`₦${targetTag.toUpperCase()}\`\n` +
          `• **Recipient Address**: \`${prepared.recipientAddress}\`\n` +
          `• **Network**: Celo Mainnet (< 1s finality)\n` +
          `• **Attribution Tag**: \`${CELO_ATTRIBUTION_TAG}\` (ERC-8021)\n\n` +
          `Confirm transaction authorization below:`;
      }
    } else {
      replyText = `I encountered an issue preparing the payment to ₦${targetTag.toUpperCase()}: ${prepError || 'Unable to resolve tag'}. Please verify the tag and try again.`;
    }

    const widget = prepared ? {
      type: 'payment_intent_card',
      title: `Send to ₦${targetTag.toUpperCase()}`,
      badge: prepared.isCrossToken ? 'Textile FX Corridor' : 'Direct Send',
      intentId: prepared.intentId,
      recipientTag: prepared.recipientTag || `₦${targetTag.toUpperCase()}`,
      recipientAddress: prepared.recipientAddress,
      amountSent: prepared.amountSent,
      sourceToken: prepared.sourceToken,
      estimatedDelivery: prepared.estimatedDelivery,
      targetToken: prepared.targetToken,
      effectiveRate: prepared.effectiveRate,
      conversionFee: prepared.conversionFee,
      isCrossToken: prepared.isCrossToken,
      actionText: `Authorize ${prepared.amountSent} ${prepared.sourceToken} Payment`,
      actionPrompt: `Authorize payment to ₦${targetTag.toUpperCase()}`,
    } : null;

    return {
      reply: replyText,
      widget,
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TEXTILE FX LIVE QUOTE & RATE INQUIRIES
  // Example: "How much cNGN will ₦SEGUN receive for 20 USDT?"
  // ──────────────────────────────────────────────────────────────────────────
  if (isQuoteOrRateQuery(cleanPrompt)) {
    const targetTag = extractReferencedAgentTag(cleanPrompt, 'segun');
    const amtMatch = cleanPrompt.match(/(?:[$₦]\s*)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
    const amount = amtMatch ? amtMatch[1].replace(/,/g, '') : '20';

    let sourceToken = 'USDT';
    let targetToken = 'cNGN';
    if (/cngn to usdt|from cngn/i.test(cleanPrompt)) {
      sourceToken = 'cNGN';
      targetToken = 'USDT';
    }

    let preview = null;
    try {
      const sourceDesc = resolveTokenDescriptor(sourceToken);
      const targetDesc = resolveTokenDescriptor(targetToken);
      const sellAmountAtomic = toAtomicUnits(amount, sourceDesc.decimals);
      preview = await getIndicativePreview({
        sellToken: sourceDesc.address,
        buyToken: targetDesc.address,
        sellAmount: sellAmountAtomic,
      });
    } catch (err) {
      console.warn('[ChatEngine Quote Error]', err.message);
    }

    const estDelivery = preview?.formattedBuyAmount || '28,910.00';
    const rate = preview?.effectiveRate || 1445.5;
    const fee = preview?.formattedFeeAmount || '0.00';

    const replyText = `### Textile FX Live Quote\n\n` +
      `For **${amount} ${sourceToken}**, ₦${targetTag.toUpperCase()} will receive approximately **${estDelivery} ${targetToken}** on Celo Mainnet.\n\n` +
      `• **Market Rate**: 1 ${sourceToken} ≈ **${rate.toLocaleString()} ${targetToken}**\n` +
      `• **Conversion Fee**: ${fee} ${sourceToken} (Textile RFQ v2)\n` +
      `• **Settlement Network**: Celo Mainnet (< 1,000ms finality)\n` +
      `• **Attribution**: \`${CELO_ATTRIBUTION_TAG}\` (ERC-8021)\n\n` +
      `*Note: This is a live indicative preview from Textile FX market makers. An exact EIP-712 firm quote will be locked upon transaction initiation.*`;

    const widget = {
      type: 'payment_quote_card',
      title: `Textile FX Rate · ${sourceToken} ⇄ ${targetToken}`,
      badge: 'Live Market Quote',
      amountIn: amount,
      sourceToken,
      amountOut: estDelivery,
      targetToken,
      effectiveRate: rate,
      fee,
      actionText: `Send ${amount} ${sourceToken} to ₦${targetTag.toUpperCase()}`,
      actionPrompt: `Send ₦${targetTag.toUpperCase()} ${amount} ${sourceToken} worth of ${targetToken}`,
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
  // 5. TAG-TO-TAG PAYMENT REQUEST CREATION
  // Example: "Request 30,000 cNGN from ₦BLOOM for my completed design work."
  // ──────────────────────────────────────────────────────────────────────────
  if (isPaymentRequestQuery(cleanPrompt)) {
    const fromMatch = cleanPrompt.match(/from\s+[@₦#]?([a-zA-Z0-9_\-]+)/i);
    const payerTag = fromMatch ? fromMatch[1].toLowerCase() : extractReferencedAgentTag(cleanPrompt, 'bloom');

    const amtMatch = cleanPrompt.match(/(?:[$₦]\s*)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
    const amount = amtMatch ? amtMatch[1].replace(/,/g, '') : '30000';
    const token = /usdt|usd₮/i.test(cleanPrompt) ? 'USDT' : 'cNGN';

    const forMatch = cleanPrompt.match(/\bfor\s+(.+)$/i);
    const description = forMatch ? forMatch[1].trim() : 'Delivered services / task work';

    let requestRecord = null;
    try {
      requestRecord = await createPaymentRequest({
        payerTagOrAddress: payerTag,
        recipientTagOrAddress: activeAgent.tag,
        amount,
        token,
        description,
      });
    } catch (err) {
      console.warn('[ChatEngine Payment Request Error]', err.message);
    }

    const replyText = `### Sovereign Payment Request Created\n\n` +
      `I have generated a sovereign Tag-to-Tag Payment Request for **₦${payerTag.toUpperCase()}**:\n\n` +
      `• **Request ID**: \`${requestRecord?.requestId || 'pr_pending'}\`\n` +
      `• **Payer**: \`₦${payerTag.toUpperCase()}\`\n` +
      `• **Recipient**: \`₦${activeAgent.tag.toUpperCase()}\`\n` +
      `• **Requested Amount**: **${amount} ${token}**\n` +
      `• **Purpose**: "${description}"\n` +
      `• **Status**: 🟢 **SENT (Pending Payer Acceptance)**\n` +
      `• **Settlement**: Celo Mainnet via Textile FX Corridors\n\n` +
      `₦${payerTag.toUpperCase()} has been notified. When they accept, they can pay in their preferred stablecoin (USD₮ or cNGN) with automated Textile FX conversion.`;

    const widget = {
      type: 'payment_request_card',
      title: `Payment Request · ₦${payerTag.toUpperCase()}`,
      badge: 'Created & Sent',
      requestId: requestRecord?.requestId,
      payerTag: `₦${payerTag.toUpperCase()}`,
      amount,
      token,
      description,
      status: PAYMENT_REQUEST_STATES.SENT,
      actionText: 'View Pending Request',
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
  // 6. CANCEL PAYMENT REQUEST
  // Example: "Cancel my pending payment request."
  // ──────────────────────────────────────────────────────────────────────────
  if (isCancelPaymentRequestQuery(cleanPrompt)) {
    const requests = listPaymentRequests({ userTag: activeAgent.tag, role: 'recipient' });
    const pending = requests.find((r) => [PAYMENT_REQUEST_STATES.CREATED, PAYMENT_REQUEST_STATES.SENT].includes(r.status));

    let replyText = '';
    if (pending) {
      cancelPaymentRequest(pending.requestId, walletAddress);
      replyText = `### Payment Request Cancelled\n\n` +
        `Payment request \`${pending.requestId}\` for **${pending.requestedAmount} ${pending.requestedToken}** from ${pending.payerTag} has been successfully cancelled.\n\n` +
        `Status updated to: 🚫 **CANCELLED**`;
    } else {
      replyText = `### Cancel Payment Request\n\n` +
        `No active pending payment request found to cancel.`;
    }

    return {
      reply: replyText,
      widget: null,
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. PENDING INVOICES & PAYMENT REQUESTS
  // Example: "Show my pending payment requests."
  // ──────────────────────────────────────────────────────────────────────────
  if (isPendingInvoicesQuery(cleanPrompt)) {
    const requests = listPaymentRequests({ userTag: activeAgent.tag, userAddress: walletAddress });
    const pending = requests.filter((r) => [PAYMENT_REQUEST_STATES.CREATED, PAYMENT_REQUEST_STATES.SENT, PAYMENT_REQUEST_STATES.VIEWED, PAYMENT_REQUEST_STATES.ACCEPTED].includes(r.status));

    let replyText = '';
    if (pending.length > 0) {
      const listItems = pending.map((r, i) => `${i + 1}. **${r.requestId}** — **${r.requestedAmount} ${r.requestedToken}** from ${r.payerTag} (${r.status}): *"${r.description}"*`).join('\n');
      replyText = `### Your Active Payment Requests & Invoices\n\n${listItems}\n\nYou can click any request below to authorize payment or view settlement details.`;
    } else {
      replyText = `### Payment Requests & Invoices\n\n` +
        `You currently have no pending payment requests awaiting settlement.\n\n` +
        `To create one, tell me:\n` +
        `*"Request 30,000 cNGN from ₦BLOOM for logo design"*`;
    }

    return {
      reply: replyText,
      widget: {
        type: 'pending_requests_list',
        title: 'Active Payment Requests',
        badge: `${pending.length} Pending`,
        requests: pending.slice(0, 5),
        actionText: 'Create New Request',
        actionPrompt: 'Request 30,000 cNGN from ₦BLOOM for design work',
      },
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. PAY INVOICE OR APPROVED MILESTONE
  // Example: "Pay ₦SEGUN's outstanding invoice.", "Pay the designer after approving the milestone."
  // ──────────────────────────────────────────────────────────────────────────
  if (isPayInvoiceQuery(cleanPrompt)) {
    const targetTag = extractReferencedAgentTag(cleanPrompt, 'segun');
    const isMilestone = cleanPrompt.includes('milestone') || cleanPrompt.includes('task') || cleanPrompt.includes('designer');

    let replyText = '';
    if (isMilestone) {
      replyText = `### Task Milestone Approval & Settlement\n\n` +
        `You are approving the completed work deliverable for the designer on Celo Mainnet.\n\n` +
        `• **Milestone Amount**: **50 USD₮ / 72,500 cNGN**\n` +
        `• **Settlement Rails**: Textile FX v2 RFQ + NairaTag Task Escrow\n` +
        `• **Attribution**: \`${CELO_ATTRIBUTION_TAG}\` (ERC-8021)\n\n` +
        `Would you like to release this milestone payout using your Altana smart account allowance?`;
    } else {
      replyText = `### Pay Outstanding Invoice for ₦${targetTag.toUpperCase()}\n\n` +
        `I located the outstanding invoice for ₦${targetTag.toUpperCase()}.\n\n` +
        `• **Recipient**: \`₦${targetTag.toUpperCase()}\`\n` +
        `• **Amount Due**: **30,000 cNGN** (or equivalent **~ 20.75 USD₮**)\n` +
        `• **Conversion Engine**: Textile FX v2 RFQ Corridor\n` +
        `• **Settlement Network**: Celo Mainnet (< 1s finality)\n\n` +
        `You can authorize payment using the card below:`;
    }

    const widget = {
      type: 'payment_intent_card',
      title: isMilestone ? 'Approve & Pay Milestone' : `Pay Invoice · ₦${targetTag.toUpperCase()}`,
      badge: 'Escrow Settlement',
      recipientTag: `₦${targetTag.toUpperCase()}`,
      amountSent: '20.75',
      sourceToken: 'USD₮',
      estimatedDelivery: '30,000.00',
      targetToken: 'cNGN',
      effectiveRate: 1445.5,
      isCrossToken: true,
      actionText: isMilestone ? 'Approve Milestone & Pay' : 'Pay Invoice via Textile FX',
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
  // 8. PAYMENT STATUS INQUIRY
  // Example: "What's the status of my last payment?"
  // ──────────────────────────────────────────────────────────────────────────
  if (isPaymentStatusQuery(cleanPrompt)) {
    const receipts = listAllReceipts();
    const lastReceipt = receipts[0];

    let replyText = '';
    if (lastReceipt) {
      replyText = `### Status of Your Last Payment\n\n` +
        `✅ **Status**: **${lastReceipt.status}**\n` +
        `• **Receipt ID**: \`${lastReceipt.receiptId}\`\n` +
        `• **Recipient**: ${lastReceipt.recipientTag || lastReceipt.recipientAddress}\n` +
        `• **Amount Sent**: **${lastReceipt.amountSent} ${lastReceipt.tokenSent}**\n` +
        `• **Amount Delivered**: **${lastReceipt.amountDelivered} ${lastReceipt.tokenDelivered}**\n` +
        (lastReceipt.swapTxHash ? `• **Textile Swap Tx**: [\`${lastReceipt.swapTxHash.slice(0, 10)}...\`](${lastReceipt.swapExplorerUrl})\n` : '') +
        (lastReceipt.transferTxHash || lastReceipt.payoutTxHash ? `• **Settlement Tx**: [\`${(lastReceipt.transferTxHash || lastReceipt.payoutTxHash).slice(0, 10)}...\`](${lastReceipt.transferExplorerUrl || lastReceipt.payoutExplorerUrl})\n` : '') +
        `• **Attribution**: \`${lastReceipt.attributionTag || CELO_ATTRIBUTION_TAG}\` (ERC-8021)\n` +
        `• **Time**: ${new Date(lastReceipt.timestamp).toLocaleString()}`;
    } else {
      replyText = `### Payment Status\n\n` +
        `No recent payments were found in your local session.\n` +
        `Once you execute a direct send or invoice settlement on Celo Mainnet, full cryptographic receipts and CeloScan explorer links will appear here.`;
    }

    return {
      reply: replyText,
      widget: lastReceipt ? {
        type: 'payment_receipt_card',
        title: 'Settlement Receipt',
        badge: 'Celo Mainnet Confirmed',
        receipt: lastReceipt,
        actionText: 'View on CeloScan ↗',
        explorerUrl: lastReceipt.transferExplorerUrl || lastReceipt.payoutExplorerUrl || lastReceipt.swapExplorerUrl,
      } : null,
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }



  // ──────────────────────────────────────────────────────────────────────────
  // 10. CONVERSION & PAYMENT HISTORY
  // Example: "Show me the conversion history for ₦MUSIC."
  // ──────────────────────────────────────────────────────────────────────────
  if (isPaymentHistoryQuery(cleanPrompt)) {
    const targetTag = extractReferencedAgentTag(cleanPrompt, 'music');
    const receipts = listAllReceipts();

    let replyText = `### Conversion & Payment History for ₦${targetTag.toUpperCase()}\n\n`;
    if (receipts.length > 0) {
      const rows = receipts.slice(0, 5).map((r, i) =>
        `${i + 1}. **${r.amountSent} ${r.tokenSent}** $\\rightarrow$ **${r.amountDelivered} ${r.tokenDelivered}** (${r.type}) — [Tx ↗](${r.transferExplorerUrl || r.payoutExplorerUrl})`
      ).join('\n');
      replyText += `${rows}\n\n*All cross-currency conversions executed via Textile FX and attributed on Celo Mainnet with \`${CELO_ATTRIBUTION_TAG}\`.*`;
    } else {
      replyText += `No previous conversions found for ₦${targetTag.toUpperCase()} in the current session.\n\n` +
        `Try: *"Send ₦${targetTag.toUpperCase()} $10 worth of cNGN. I have USD₮."*`;
    }

    return {
      reply: replyText,
      widget: {
        type: 'payment_history_card',
        title: `History · ₦${targetTag.toUpperCase()}`,
        badge: `${receipts.length} Transactions`,
        receipts: receipts.slice(0, 5),
        actionText: 'Execute New Swap',
        actionPrompt: `Send ₦${targetTag.toUpperCase()} 10 USDT worth of cNGN`,
      },
      agentTag: activeAgent.tag,
      agentName: activeAgent.name,
      avatar: activeAgent.avatar,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 11. PROTOCOL OVERVIEW & CAPABILITIES (ChatGPT / Claude Caliber)
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
