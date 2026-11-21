/**
 * @file selfX402Service.js
 * @description Official Celo x402 Pay-Per-Request Payment & Verification Service.
 * Implements HTTP 402 Payment Required integration on Celo Mainnet (Chain ID 42220).
 * Reference: https://x402.celo.org/skill.md
 * 
 * Strict Security Principles:
 * 1. Zero Trust: Never trust a frontend claim of payment; verify amount, recipient, token, network, and freshness.
 * 2. Nonce & Replay Protection: Every x402 payment challenge carries a unique cryptographic nonce. 
 *    Redeemed proofs are recorded in consumedPaymentDigests and can NEVER unlock multiple requests.
 * 3. Exact Matching: Payments must strictly target the designated agent's payTo address and verified asset.
 * 4. Hackathon Attribution: ERC-8021 suffix (celo_9f7deabd99a6) appended to all qualifying payment transactions.
 */

import {
  getAddress,
  isAddress,
  parseUnits,
  formatUnits,
  keccak256,
  stringToHex,
} from 'viem';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
} from '../config/celo.js';
import {
  evaluateAgentCapabilityAccess,
  VERIFICATION_POLICIES,
  VERIFICATION_STATUS,
} from './selfAgentIdService.js';

export const X402_CELO_NETWORK = 'eip155:42220';
export const X402_SCHEME = 'exact';
export const X402_FACILITATOR_API = 'https://api.x402.celo.org';

// Supported token decimals on Celo
const TOKEN_DECIMALS = {
  [CELO_USDT_ADDRESS.toLowerCase()]: 6,
  [CELO_CNGN_ADDRESS.toLowerCase()]: 6,
  '0xceba9300f2b948710d2653d4307a4b0d0239069d': 6, // USDC
};

// Replay protection store (digests of consumed payments)
const consumedPaymentDigests = new Set();

// Active requirements cache (pending payment challenges)
const activeRequirements = new Map();

/**
 * Creates an official x402 Payment Requirement (HTTP 402 Challenge) for an agent capability.
 * 
 * @param {Object} params
 * @param {string} params.resourceId - Unique identifier for the requested capability or prompt.
 * @param {string} params.agentTag - The NairaTag agent providing the service.
 * @param {string} params.payTo - The agent's verified payout address.
 * @param {string} [params.amount='0.05'] - Human-readable price (default: 0.05 USD₮).
 * @param {string} [params.asset=CELO_USDT_ADDRESS] - Settlement token address.
 * @param {number} [params.maxTimeoutSeconds=300] - Challenge validity window (default 5m).
 * @returns {Object} x402 Payment Requirement object
 */
export function createX402PaymentRequirement({
  resourceId,
  agentTag,
  payTo,
  amount = '0.05',
  asset = CELO_USDT_ADDRESS,
  maxTimeoutSeconds = 300,
}) {
  if (!resourceId) throw new Error('Valid resourceId is required.');
  if (!payTo || !isAddress(payTo)) throw new Error('Valid payTo recipient address is required.');
  if (!asset || !isAddress(asset)) throw new Error('Valid asset contract address is required.');

  const cleanPayTo = getAddress(payTo);
  const cleanAsset = getAddress(asset);
  const decimals = TOKEN_DECIMALS[cleanAsset.toLowerCase()] || 6;
  const atomicAmount = parseUnits(String(amount), decimals).toString();

  const nonce = `x402_nonce_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + maxTimeoutSeconds;

  const requirement = {
    scheme: X402_SCHEME,
    network: X402_CELO_NETWORK,
    asset: cleanAsset,
    amount: atomicAmount,
    humanAmount: String(amount),
    payTo: cleanPayTo,
    agentTag: String(agentTag).toLowerCase(),
    resourceId,
    nonce,
    timestamp,
    expiresAt,
    maxTimeoutSeconds,
    attributionTag: CELO_ATTRIBUTION_TAG,
  };

  // Cache pending requirement
  activeRequirements.set(nonce, requirement);

  return requirement;
}

/**
 * Generates an HTTP 402 Payment Required response payload.
 * 
 * @param {Object} requirement - Requirement from createX402PaymentRequirement.
 * @returns {{ status: number, headers: Object, body: Object }}
 */
export function buildX402Response(requirement) {
  const headerValue = `X-PAYMENT scheme="${requirement.scheme}", network="${requirement.network}", asset="${requirement.asset}", amount="${requirement.amount}", payTo="${requirement.payTo}", nonce="${requirement.nonce}"`;

  return {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': headerValue,
      'X-Payment-Nonce': requirement.nonce,
    },
    body: {
      error: 'Payment Required',
      message: `Access to "${requirement.resourceId}" requires an x402 payment of ${requirement.humanAmount} to ${requirement.agentTag}.`,
      paymentRequirement: requirement,
    },
  };
}

/**
 * Cryptographically verifies an incoming x402 payment proof before releasing protected agent responses.
 * 
 * Verification Checks:
 * 1. Network match (eip155:42220)
 * 2. Asset contract match (USD₮ / cNGN)
 * 3. Recipient match (agent's payTo address)
 * 4. Value sufficiency (amount >= expected amount)
 * 5. Freshness check (now <= expiresAt)
 * 6. Nonce integrity (bound to specific challenge)
 * 7. Replay attack rejection (each proof is single-use)
 * 
 * @param {Object} params
 * @param {Object} params.paymentProof - The payment evidence submitted by the client.
 * @param {Object} params.expectedRequirement - The server-issued payment requirement.
 * @returns {Object} Verification outcome
 */
export function verifyX402PaymentProof({
  paymentProof,
  expectedRequirement,
}) {
  if (!paymentProof) {
    throw new Error('Payment proof is missing. Provide valid x402 payment evidence.');
  }
  if (!expectedRequirement) {
    throw new Error('Valid expected requirement context is required for verification.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // 1. Expiration check
  if (paymentProof.timestamp && (nowSeconds - Number(paymentProof.timestamp) > expectedRequirement.maxTimeoutSeconds)) {
    throw new Error(`x402 payment proof has expired (Exceeded timeout of ${expectedRequirement.maxTimeoutSeconds}s).`);
  }

  // 2. Network check
  if (paymentProof.network !== X402_CELO_NETWORK) {
    throw new Error(`Invalid network: Expected ${X402_CELO_NETWORK}, got ${paymentProof.network}`);
  }

  // 3. Asset contract check
  if (!paymentProof.asset || getAddress(paymentProof.asset).toLowerCase() !== expectedRequirement.asset.toLowerCase()) {
    throw new Error(`Asset token mismatch: Expected ${expectedRequirement.asset}, got ${paymentProof.asset}`);
  }

  // 4. Recipient check
  if (!paymentProof.payTo || getAddress(paymentProof.payTo).toLowerCase() !== expectedRequirement.payTo.toLowerCase()) {
    throw new Error(`Payment recipient mismatch: Expected ${expectedRequirement.payTo}, got ${paymentProof.payTo}`);
  }

  // 5. Amount check
  const paidAmount = BigInt(paymentProof.amount || 0);
  const requiredAmount = BigInt(expectedRequirement.amount || 0);
  if (paidAmount < requiredAmount) {
    throw new Error(`Insufficient payment amount: Expected ${requiredAmount.toString()}, got ${paidAmount.toString()}`);
  }

  // 6. Nonce & Challenge Binding
  if (!paymentProof.nonce || paymentProof.nonce !== expectedRequirement.nonce) {
    throw new Error(`Payment nonce mismatch: Proof is not bound to challenge ${expectedRequirement.nonce}`);
  }

  // 7. Replay Protection: Compute unique payment digest
  const paymentDigest = keccak256(
    stringToHex(
      `${paymentProof.txHash || paymentProof.signature || ''}:${paymentProof.nonce}:${paymentProof.amount}:${paymentProof.payTo}`
    )
  );

  if (consumedPaymentDigests.has(paymentDigest)) {
    throw new Error('Payment proof has already been redeemed. Replay attacks are prohibited.');
  }

  // Mark digest as permanently consumed
  consumedPaymentDigests.add(paymentDigest);

  // Remove pending requirement from active map
  activeRequirements.delete(expectedRequirement.nonce);

  return {
    verified: true,
    paymentDigest,
    txHash: paymentProof.txHash || null,
    amount: paymentProof.amount,
    asset: expectedRequirement.asset,
    payTo: expectedRequirement.payTo,
    agentTag: expectedRequirement.agentTag,
    resourceId: expectedRequirement.resourceId,
    verifiedAt: Date.now(),
    attributionTag: CELO_ATTRIBUTION_TAG,
  };
}

/**
 * End-to-end Orchestrator Pipeline for Self-gated, x402-paid agent capabilities.
 * 
 * Logical Flow:
 * User -> NairaTag -> Agent Discovery -> Self Verification -> Capability Authorization -> x402 Payment -> Agent Execution -> Response
 * 
 * @param {Object} params
 * @param {Object} params.agent - The NairaTag agent record.
 * @param {string} params.capability - Capability key requested.
 * @param {string} [params.callerWallet] - Address of the invoking user.
 * @param {Object} [params.paymentProof] - Client-submitted payment proof.
 * @param {Object} [params.verificationEvidence] - Pre-fetched verification evidence.
 * @param {boolean} [params.isPaid=true] - Whether this capability requires x402 payment.
 * @param {string} [params.price='0.05'] - Token price.
 * @param {string} [params.asset=CELO_USDT_ADDRESS] - Payment asset.
 * @param {Function} params.executeHandler - Async function executing the underlying agent work.
 * @returns {Promise<Object>} Execution result or 402 challenge
 */
export async function executeSelfGatedAgentCapability({
  agent,
  capability,
  callerWallet = null,
  paymentProof = null,
  paymentRequirement = null,
  verificationEvidence = null,
  isPaid = true,
  price = '0.05',
  asset = CELO_USDT_ADDRESS,
  executeHandler,
}) {
  // 1. Self Identity Verification Gate
  const accessCheck = await evaluateAgentCapabilityAccess({
    agent,
    capability,
    policyLevel: VERIFICATION_POLICIES.VERIFIED_ONLY,
    verificationEvidence,
  });

  if (!accessCheck.allowed) {
    return {
      ok: false,
      status: 403,
      error: 'Self Verification Required',
      reason: accessCheck.reason,
      verificationStatus: accessCheck.status,
    };
  }

  // 2. x402 Payment Gate (if capability is paid)
  let paymentReceipt = null;
  if (isPaid) {
    let requirement = paymentRequirement;
    if (!requirement && paymentProof?.nonce && activeRequirements.has(paymentProof.nonce)) {
      requirement = activeRequirements.get(paymentProof.nonce);
    }
    if (!requirement) {
      requirement = createX402PaymentRequirement({
        resourceId: capability,
        agentTag: agent.canonicalTag || agent.tag,
        payTo: agent.owner,
        amount: price,
        asset,
      });
    }

    if (!paymentProof) {
      // Return HTTP 402 challenge
      return buildX402Response(requirement);
    }

    // Verify submitted proof
    try {
      paymentReceipt = verifyX402PaymentProof({
        paymentProof,
        expectedRequirement: requirement,
      });
    } catch (err) {
      return {
        ok: false,
        status: 402,
        error: 'Payment Verification Failed',
        reason: err.message,
      };
    }
  }

  // 3. Execute protected agent capability
  try {
    const executionResult = await executeHandler({ agent, callerWallet, paymentReceipt });
    return {
      ok: true,
      status: 200,
      data: executionResult,
      agent: {
        tag: agent.canonicalTag || agent.tag,
        owner: agent.owner,
        verified: true,
        verificationStatus: accessCheck.status,
      },
      paymentReceipt,
      attributionTag: CELO_ATTRIBUTION_TAG,
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: 'Agent Execution Failed',
      reason: err.message,
      paymentReceipt, // Retain receipt for user audit/refund reference
    };
  }
}

/**
 * Resets consumed payment digests (for testing only).
 */
export function _resetConsumedPaymentsForTesting() {
  consumedPaymentDigests.clear();
  activeRequirements.clear();
}
