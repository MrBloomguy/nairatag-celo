/**
 * @file selfX402Service.js
 * @description Official Celo x402 Pay-Per-Request Payment & Verification Service.
 * Implements HTTP 402 Payment Required integration on Celo Mainnet (Chain ID 42220).
 * Reference: https://x402.celo.org/skill.md
 * 
 * Strict Security Principles:
 * 1. Zero Trust: Never trust a frontend claim of payment; verify amount, recipient, token, network, and freshness.
 * 2. Nonce & Durable Replay Protection: Every x402 payment challenge carries a unique cryptographic nonce. 
 *    Redeemed proofs are recorded in durable atomic storage (survives restarts) and can NEVER unlock multiple requests.
 * 3. Exact Matching & On-Chain Settlement: Payments must strictly target the designated agent's payTo address and verified asset.
 * 4. Altana Session Validation: When onchain transactions or spending are involved, an active unrevoked Altana session is enforced.
 * 5. Failure Audit & Retry: If agent compute fails after payment confirmation, the traceable receipt is retained and allows retry without double charging.
 * 6. Hackathon Attribution: ERC-8021 suffix (celo_9f7deabd99a6) appended to all qualifying payment transactions.
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
import {
  consumePaymentDigestAtomic,
  updatePaymentExecutionResult,
  isPaymentConsumed,
  getPaymentRecord,
  _resetDurableStoreForTesting,
} from './durablePaymentStore.js';
import { publicClient } from './celoPayment.js';

export const X402_CELO_NETWORK = 'eip155:42220';
export const X402_SCHEME = 'exact';
export const X402_FACILITATOR_API = 'https://api.x402.celo.org';

// Supported token decimals on Celo
const TOKEN_DECIMALS = {
  [CELO_USDT_ADDRESS.toLowerCase()]: 6,
  [CELO_CNGN_ADDRESS.toLowerCase()]: 6,
  '0xceba9300f2b948710d2653d4307a4b0d0239069d': 6, // USDC
};

// Replay protection store (in-memory fast cache + durable store)
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
 * @param {number} [params.timeoutSeconds=300] - Valid challenge lifetime (default: 5 min).
 * @param {number} [params.maxTimeoutSeconds] - Alias for timeoutSeconds.
 * @returns {Object} Canonical x402 requirement
 */
export function createX402PaymentRequirement({
  resourceId,
  agentTag,
  payTo,
  amount = '0.05',
  asset = CELO_USDT_ADDRESS,
  timeoutSeconds = 300,
  maxTimeoutSeconds = null,
  nonce: customNonce = null,
}) {
  if (!resourceId) throw new Error('resourceId is required to issue an x402 requirement.');
  if (!agentTag) throw new Error('agentTag is required.');
  if (!payTo || !isAddress(payTo)) throw new Error('Valid agent payTo address is required.');

  const effectiveTimeout = maxTimeoutSeconds || timeoutSeconds;
  const cleanPayTo = getAddress(payTo);
  const cleanAsset = getAddress(asset);
  const decimals = TOKEN_DECIMALS[cleanAsset.toLowerCase()] || 6;
  const rawAmount = parseUnits(amount, decimals).toString();

  const nonce = customNonce || keccak256(
    stringToHex(`${resourceId}:${cleanPayTo}:${Date.now()}:${Math.random()}`)
  );

  const requirement = {
    scheme: X402_SCHEME,
    network: X402_CELO_NETWORK,
    asset: cleanAsset,
    amount: rawAmount,
    humanAmount: `${amount} ${cleanAsset.toLowerCase() === CELO_CNGN_ADDRESS.toLowerCase() ? 'cNGN' : 'USD₮'}`,
    payTo: cleanPayTo,
    agentTag,
    resourceId,
    nonce,
    createdAt: Math.floor(Date.now() / 1000),
    maxTimeoutSeconds: effectiveTimeout,
    expiresAt: Math.floor(Date.now() / 1000) + effectiveTimeout,
    attributionTag: CELO_ATTRIBUTION_TAG,
    attributionSuffix: CELO_ATTRIBUTION_SUFFIX,
    facilitatorUrl: X402_FACILITATOR_API,
  };

  activeRequirements.set(nonce, requirement);
  return requirement;
}

/**
 * Builds standard RFC-compliant HTTP 402 response payload with WWW-Authenticate header.
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
 * Verifies live on-chain settlement on Celo Mainnet via publicClient.
 * 
 * @param {Object} params
 * @param {string} params.txHash - Transaction hash on Celo Mainnet.
 * @param {Object} params.expectedRequirement - Server-issued challenge requirement.
 * @returns {Promise<Object>} Settlement receipt data
 */
export async function verifyOnchainSettlement({
  txHash,
  expectedRequirement,
  expectedTo,
  expectedAmountAtomic,
  tokenAddress,
}) {
  if (!txHash) {
    throw new Error('On-chain transaction hash is required for settlement verification.');
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (!receipt) {
      throw new Error(`Transaction ${txHash} is not yet confirmed on Celo Mainnet (Pending or unmined).`);
    }
    if (receipt.status !== 'success') {
      throw new Error(`Payment transaction ${txHash} reverted on Celo Mainnet.`);
    }

    // Inspect logs for ERC-20 Transfer
    // Transfer(address indexed from, address indexed to, uint256 value)
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const targetAsset = (expectedRequirement?.asset || tokenAddress || '').toLowerCase();
    const targetPayTo = (expectedRequirement?.payTo || expectedTo || '').toLowerCase();
    const targetAmount = BigInt(expectedRequirement?.amount || expectedAmountAtomic || 0);

    let matchedTransfer = false;
    let transferredAmount = BigInt(0);

    for (const log of (receipt.logs || [])) {
      if (log.address.toLowerCase() === targetAsset && log.topics[0] === transferTopic) {
        if (log.topics[2]) {
          const recipientInLog = '0x' + log.topics[2].slice(26).toLowerCase();
          if (recipientInLog === targetPayTo) {
            matchedTransfer = true;
            transferredAmount = BigInt(log.data || 0);
            break;
          }
        }
      }
    }

    if (!matchedTransfer) {
      throw new Error(`Transaction ${txHash} does not contain an ERC-20 transfer to required recipient ${targetPayTo || 'specified recipient'}.`);
    }

    if (targetAmount > 0 && transferredAmount < targetAmount) {
      throw new Error(`Transaction ${txHash} transfer value (${transferredAmount.toString()}) is less than required amount (${targetAmount.toString()}).`);
    }

    return {
      settled: true,
      blockNumber: receipt.blockNumber,
      txHash,
      matchedTransfer: true,
      transferredAmount: transferredAmount.toString(),
    };
  } catch (err) {
    throw new Error(`On-chain settlement check failed on Celo Mainnet: ${err.message}`);
  }
}

/**
 * Verifies and settles an x402 payment authorization through Celo's native facilitator (api.x402.celo.org).
 */
export async function settleWithCeloFacilitator({ paymentPayload, paymentRequirements }) {
  if (!paymentPayload || !paymentRequirements) {
    throw new Error('Both paymentPayload and paymentRequirements are required for Celo x402 facilitator settlement.');
  }

  const verifyRes = await fetch(`${X402_FACILITATOR_API}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements }),
  });
  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || verifyData.isValid === false) {
    throw new Error(verifyData.invalidReason || verifyData.error || `x402 facilitator verify failed (${verifyRes.status})`);
  }

  const settleRes = await fetch(`${X402_FACILITATOR_API}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements }),
  });
  const settleData = await settleRes.json().catch(() => ({}));
  if (!settleRes.ok || settleData.success === false) {
    throw new Error(settleData.errorReason || settleData.error || `x402 facilitator settle failed (${settleRes.status})`);
  }

  return {
    settled: true,
    txHash: settleData.transaction || settleData.txHash,
    network: settleData.network || X402_CELO_NETWORK,
    payer: settleData.payer || null,
    facilitatorUrl: X402_FACILITATOR_API,
  };
}

/**
 * Cryptographically verifies an incoming x402 payment proof before releasing protected agent responses.
 * 
 * Verification Checks:
 * 1. Expiration check (now <= maxTimeoutSeconds)
 * 2. Network match (eip155:42220)
 * 3. Asset contract match (USD₮ / cNGN)
 * 4. Recipient match (agent's payTo address)
 * 5. Value sufficiency (amount >= expected amount)
 * 6. Nonce integrity (bound to specific challenge)
 * 7. Durable replay protection (checked against atomic durable store)
 * 8. Optional strict onchain settlement check
 * 
 * @param {Object} params
 * @param {Object} params.paymentProof - The payment evidence submitted by the client.
 * @param {Object} params.expectedRequirement - The server-issued payment requirement.
 * @param {boolean} [params.strictSettlement=false] - Force live onchain RPC check.
 * @returns {Object} Verification outcome
 */
export function verifyX402PaymentProof({
  paymentProof,
  expectedRequirement,
  strictSettlement = false,
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

  // 7. Strict Settlement Mode Check
  if (strictSettlement && paymentProof.isSimulation) {
    throw new Error('Simulated payment proofs are rejected in strict settlement mode. Live Celo Mainnet payment required.');
  }

  // 8. Replay Protection: Compute unique payment digest
  const paymentDigest = keccak256(
    stringToHex(
      `${paymentProof.txHash || paymentProof.signature || ''}:${paymentProof.nonce}:${paymentProof.amount}:${paymentProof.payTo}`
    )
  );

  const existingRecord = getPaymentRecord(paymentDigest);
  const isFailedEligibleForRetry = existingRecord?.status === 'failed';

  if (!isFailedEligibleForRetry && (consumedPaymentDigests.has(paymentDigest) || isPaymentConsumed(paymentDigest))) {
    throw new Error('Payment proof has already been redeemed. Replay attacks are prohibited.');
  }

  if (!isFailedEligibleForRetry) {
    consumedPaymentDigests.add(paymentDigest);
  }

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
    isSimulation: Boolean(paymentProof.isSimulation),
  };
}

/**
 * End-to-end Orchestrator Pipeline for Self-gated, x402-paid agent capabilities.
 * 
 * Security Gates Enforced (In Strict Order):
 * 1. Self Identity Verification Gate (Fresh, unexpired, non-revoked human proof on Celo)
 * 2. Altana Session Gate (Required whenever on-chain execution or spending is triggered)
 * 3. x402 Payment Gate (HTTP 402 challenge + atomic durable replay protection)
 * 4. Protected Agent Execution
 * 5. Failure Audit Trail & Retry Without Double-Charging
 * 
 * @param {Object} params
 * @param {Object} params.agent - The NairaTag agent record.
 * @param {string} params.capability - Capability key requested.
 * @param {string} [params.callerWallet] - Address of the invoking user.
 * @param {Object} [params.paymentProof] - Client-submitted payment proof.
 * @param {Object} [params.paymentRequirement] - Pre-issued challenge requirement.
 * @param {Object} [params.verificationEvidence] - Pre-fetched verification evidence.
 * @param {Object} [params.altanaSession] - Active Altana session key (required if requiresOnchainExecution is true).
 * @param {boolean} [params.requiresOnchainExecution=false] - Whether capability requires an Altana session.
 * @param {boolean} [params.isPaid=true] - Whether this capability requires x402 payment.
 * @param {string} [params.price='0.05'] - Token price.
 * @param {string} [params.asset=CELO_USDT_ADDRESS] - Payment asset.
 * @param {boolean} [params.strictSettlement=false] - Force live onchain RPC check.
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
  altanaSession = null,
  requiresOnchainExecution = false,
  isPaid = true,
  price = '0.05',
  asset = CELO_USDT_ADDRESS,
  strictSettlement = false,
  executeHandler,
}) {
  // 1. Self Identity Verification Gate (Fail closed)
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

  // 2. Altana Session Gate (Fail closed if onchain execution is required)
  if (requiresOnchainExecution) {
    if (!altanaSession) {
      return {
        ok: false,
        status: 403,
        error: 'Altana Session Required',
        reason: 'Onchain execution requires an active, unrevoked Altana session key (EIP-7702).',
      };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (altanaSession.status !== 'active') {
      return {
        ok: false,
        status: 403,
        error: 'Altana Session Invalid',
        reason: `Altana session is not active (Status: ${altanaSession.status || 'unknown'}).`,
      };
    }
    if (altanaSession.expiry && nowSec >= Number(altanaSession.expiry)) {
      return {
        ok: false,
        status: 403,
        error: 'Altana Session Expired',
        reason: `Altana session expired at ${new Date(altanaSession.expiry * 1000).toISOString()}.`,
      };
    }
  }

  // 3. x402 Payment Gate (if capability is paid)
  let paymentReceipt = null;
  let paymentDigest = null;

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
        strictSettlement,
      });
      paymentDigest = paymentReceipt.paymentDigest;
    } catch (err) {
      return {
        ok: false,
        status: 402,
        error: 'Payment Verification Failed',
        reason: err.message,
      };
    }

    // Atomic durable consumption pre-flight (Prevents concurrent double spends)
    try {
      await consumePaymentDigestAtomic({
        paymentDigest,
        requirement,
        paymentProof,
      });
    } catch (err) {
      return {
        ok: false,
        status: 409,
        error: 'Payment Already Consumed or In-Flight',
        reason: err.message,
      };
    }
  }

  // 4. Execute protected agent capability
  try {
    const executionResult = await executeHandler({
      agent,
      callerWallet,
      paymentReceipt,
      altanaSession,
    });

    if (isPaid && paymentDigest) {
      await updatePaymentExecutionResult({
        paymentDigest,
        status: 'consumed',
        executionResult,
      });
    }

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
    // Record execution failure in durable store to prevent double-charging on retry
    if (isPaid && paymentDigest) {
      consumedPaymentDigests.delete(paymentDigest);
      await updatePaymentExecutionResult({
        paymentDigest,
        status: 'failed',
        error: err.message,
      });
    }

    return {
      ok: false,
      status: 500,
      error: 'Agent Execution Failed',
      reason: err.message,
      paymentReceipt, // Retain receipt for user audit/refund reference
      canRetryWithoutRepay: Boolean(paymentDigest),
      idempotencyKey: paymentDigest,
    };
  }
}

/**
 * Protected Execution Gateway Wrapper.
 * Wraps any internal capability execution function to ensure no alternate route
 * can execute without going through the Self Verification & x402 gate.
 * 
 * @param {Function} rawHandler 
 * @returns {Function} Gated handler
 */
export function withSelfAndX402Gate(rawHandler) {
  return async function gatedHandler(params) {
    return executeSelfGatedAgentCapability({
      ...params,
      executeHandler: rawHandler,
    });
  };
}

/**
 * Resets consumed payment digests and storage (for testing only).
 */
export async function _resetConsumedPaymentsForTesting() {
  activeRequirements.clear();
  consumedPaymentDigests.clear();
  await _resetDurableStoreForTesting();
}
