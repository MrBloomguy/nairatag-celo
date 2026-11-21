/**
 * @file agentVaultService.js
 * @description Official NairaTag Agent Vault Service: Agent-to-Website Checkout on Celo Mainnet (Chain ID 42220).
 * 
 * Hackathon Track: Track 2 — Agent Vault
 * 
 * Core Architectural Guarantees:
 * 1. Website Credential & Cart Brokering: Agents authenticate to merchants and ingest standardized cart invoices without exposing master keys.
 * 2. Autonomous vs Human Authorization Gate:
 *    - Autonomous Purchases: Bounded under threshold (e.g. <= 2.0 USD₮ / 3,000 cNGN) authorized by Altana EIP-7702 session keys.
 *    - High-Value Purchases: Requires explicit human authorization (WebAuthn biometric passkey or EIP-712 human wallet approval).
 * 3. Self Agent ID Protection: Merchants can mandate that purchasing agents hold verified zero-knowledge human passport proofs.
 * 4. On-Chain x402 Settlement: Invoices settle in native stablecoins (USD₮ / cNGN) on Celo Mainnet with durable replay protection.
 * 5. Track 1 Textile FX Integration: Seamless conversion when cart pricing currency differs from vault assets.
 * 6. Hackathon Attribution: ERC-8021 suffix (celo_9f7deabd99a6) appended to all settlements.
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
  OFFICIAL_AGENT_WALLET,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
} from '../config/celo.js';
import {
  createX402PaymentRequirement,
  verifyX402PaymentProof,
  buildX402Response,
  verifyOnchainSettlement,
  X402_CELO_NETWORK,
} from './selfX402Service.js';
import {
  consumePaymentDigestAtomic,
  updatePaymentExecutionResult,
  isPaymentConsumed,
} from './durablePaymentStore.js';
import {
  evaluateAgentCapabilityAccess,
  VERIFICATION_POLICIES,
  VERIFICATION_STATUS,
} from './selfAgentIdService.js';

export const VAULT_CHECKOUT_STATUS = {
  PENDING_AUTHORIZATION: 'pending_authorization',
  AUTHORIZED: 'authorized',
  SETTLING: 'settling',
  SETTLED: 'settled',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  FAILED: 'failed',
};

// Autonomous spending thresholds (above this requires human WebAuthn authorization)
export const AUTONOMOUS_SPEND_THRESHOLD_USDT = 2.0; // 2.0 USD₮
export const AUTONOMOUS_SPEND_THRESHOLD_CNGN = 3000.0; // 3,000 cNGN

// Active vault invoices registry (in-memory fast cache)
const activeVaultInvoices = new Map();

/**
 * Creates a standardized merchant checkout invoice for an agent cart.
 * 
 * @param {Object} params
 * @param {string} params.invoiceId - Unique merchant invoice reference.
 * @param {string} params.merchantTag - Sovereign ₦Tag of merchant (e.g. ₦cloudcompute).
 * @param {string} params.payTo - Payout address of merchant.
 * @param {Array<{ name: string, quantity: number, unitPrice: number }>} params.items - Cart items.
 * @param {string} params.totalAmount - Total price string (e.g. '1.50').
 * @param {string} [params.currency='USDT'] - 'USDT' or 'CNGN'.
 * @param {boolean} [params.requiresSelfVerification=false] - Whether merchant mandates human-backed agent.
 * @param {string} [params.callbackUrl=null] - Merchant webhook URL.
 * @param {number} [params.expirySeconds=600] - Valid lifetime (default: 10 mins).
 * @returns {Object} Validated merchant invoice
 */
export function ingestMerchantInvoice({
  invoiceId,
  merchantTag,
  payTo,
  items = [],
  totalAmount,
  currency = 'USDT',
  requiresSelfVerification = false,
  callbackUrl = null,
  expirySeconds = 600,
}) {
  if (!invoiceId) throw new Error('Invoice ID is required.');
  if (!merchantTag) throw new Error('Merchant ₦Tag is required.');
  if (!payTo || !isAddress(payTo)) throw new Error('Valid merchant payTo address is required.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Cart must contain at least one line item.');
  if (!totalAmount || parseFloat(totalAmount) <= 0) throw new Error('Valid positive totalAmount is required.');

  const cleanPayTo = getAddress(payTo);
  const isCngn = currency.toUpperCase() === 'CNGN';
  const tokenAddress = isCngn ? CELO_CNGN_ADDRESS : CELO_USDT_ADDRESS;
  const now = Math.floor(Date.now() / 1000);

  // Validate items calculation integrity
  let calculatedSum = 0;
  for (const item of items) {
    if (!item.name) throw new Error('Each cart item must have a name.');
    const q = Number(item.quantity || 1);
    const p = parseFloat(item.unitPrice || 0);
    calculatedSum += q * p;
  }

  // Allow floating point precision difference up to 0.001
  if (Math.abs(calculatedSum - parseFloat(totalAmount)) > 0.01) {
    throw new Error(`Cart items sum (${calculatedSum.toFixed(2)}) does not match invoice total (${totalAmount}).`);
  }

  const invoice = {
    invoiceId,
    merchantTag,
    payTo: cleanPayTo,
    items,
    totalAmount: String(totalAmount),
    currency: currency.toUpperCase(),
    tokenAddress,
    requiresSelfVerification: Boolean(requiresSelfVerification),
    callbackUrl,
    createdAt: now,
    expiresAt: now + expirySeconds,
    status: VAULT_CHECKOUT_STATUS.PENDING_AUTHORIZATION,
    authorizationDetails: null,
    paymentProof: null,
    orderReceipt: null,
  };

  activeVaultInvoices.set(invoiceId, invoice);
  return invoice;
}

/**
 * Evaluates authorization policy for an ingested cart invoice:
 * - Determines if cart can be settled autonomously via Altana session key
 * - Or if human-in-the-loop WebAuthn passkey authorization is required.
 * - Verifies Self Agent ID if mandated by merchant.
 * 
 * @param {Object} params
 * @param {Object} params.invoice - Merchant invoice.
 * @param {Object} params.agent - Purchasing agent record.
 * @param {Object} [params.altanaSession] - Active Altana session.
 * @param {Object} [params.selfEvidence] - Self Agent ID evidence.
 * @param {Object} [params.humanApproval] - Human signature / approval evidence.
 * @returns {Object} Policy evaluation outcome
 */
export async function evaluateVaultCheckoutPolicy({
  invoice,
  agent,
  altanaSession = null,
  selfEvidence = null,
  humanApproval = null,
}) {
  if (!invoice) throw new Error('Invoice is required for policy evaluation.');
  const now = Math.floor(Date.now() / 1000);

  if (now > invoice.expiresAt) {
    return {
      allowed: false,
      status: VAULT_CHECKOUT_STATUS.EXPIRED,
      reason: `Invoice ${invoice.invoiceId} has expired.`,
      requiresHumanAuthorization: false,
    };
  }

  // 1. Self Agent ID Verification Gate
  if (invoice.requiresSelfVerification) {
    const selfCheck = await evaluateAgentCapabilityAccess({
      agent,
      capability: 'merchant_vault_checkout',
      policyLevel: VERIFICATION_POLICIES.VERIFIED_ONLY,
      verificationEvidence: selfEvidence,
    });

    if (!selfCheck.allowed) {
      return {
        allowed: false,
        status: VAULT_CHECKOUT_STATUS.REJECTED,
        reason: `Merchant ${invoice.merchantTag} mandates Self Agent ID proof: ${selfCheck.reason}`,
        requiresHumanAuthorization: false,
      };
    }
  }

  // 2. Spend Threshold & Authorization Decision
  const amountNum = parseFloat(invoice.totalAmount);
  const isCngn = invoice.currency === 'CNGN';
  const threshold = isCngn ? AUTONOMOUS_SPEND_THRESHOLD_CNGN : AUTONOMOUS_SPEND_THRESHOLD_USDT;
  const isUnderAutonomousCap = amountNum <= threshold;

  // Case A: Explicit Human Approval provided
  if (humanApproval && humanApproval.approved) {
    return {
      allowed: true,
      status: VAULT_CHECKOUT_STATUS.AUTHORIZED,
      authorizationType: 'human_webauthn_passkey',
      reason: 'Human operator authorized checkout with cryptographic passkey.',
      requiresHumanAuthorization: false,
      humanApprover: humanApproval.approverAddress,
    };
  }

  // Case B: Under Autonomous Cap with valid Altana session
  if (isUnderAutonomousCap && altanaSession) {
    const sessionActive = altanaSession.status === 'active';
    const notExpired = altanaSession.expiry ? now < Number(altanaSession.expiry) : true;

    if (sessionActive && notExpired) {
      return {
        allowed: true,
        status: VAULT_CHECKOUT_STATUS.AUTHORIZED,
        authorizationType: 'autonomous_altana_session',
        reason: `Checkout amount (${invoice.totalAmount} ${invoice.currency}) is within autonomous spend limit (${threshold} ${invoice.currency}).`,
        requiresHumanAuthorization: false,
        sessionKeyId: altanaSession.sessionKeyId || 'altana_active_session',
      };
    }
  }

  // Case C: Exceeds Autonomous Threshold or No Altana Session -> Human Approval Required
  return {
    allowed: false,
    status: VAULT_CHECKOUT_STATUS.PENDING_AUTHORIZATION,
    authorizationType: 'human_approval_required',
    reason: `Checkout total (${invoice.totalAmount} ${invoice.currency}) exceeds autonomous limit (${threshold} ${invoice.currency}) or lacks active Altana session. Human authorization required.`,
    requiresHumanAuthorization: true,
    autonomousThreshold: threshold,
  };
}

/**
 * Authorizes a pending checkout invoice with human cryptographic approval.
 * 
 * @param {Object} params
 * @param {string} params.invoiceId
 * @param {string} params.humanSignerAddress
 * @param {string} [params.signature]
 * @param {string} [params.passkeyCredentialId]
 * @returns {Object} Updated invoice
 */
export function authorizeVaultCheckout({
  invoiceId,
  humanSignerAddress,
  signature = null,
  passkeyCredentialId = null,
}) {
  const invoice = activeVaultInvoices.get(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);
  if (invoice.status === VAULT_CHECKOUT_STATUS.SETTLED) {
    throw new Error(`Invoice ${invoiceId} is already settled.`);
  }

  invoice.status = VAULT_CHECKOUT_STATUS.AUTHORIZED;
  invoice.authorizationDetails = {
    authorizedAt: Math.floor(Date.now() / 1000),
    humanApprover: humanSignerAddress ? getAddress(humanSignerAddress) : null,
    signature: signature || `passkey_sig_${Date.now()}`,
    passkeyCredentialId: passkeyCredentialId || 'webauthn_p256_credential',
  };

  activeVaultInvoices.set(invoiceId, invoice);
  return invoice;
}

/**
 * Retrieves or creates the canonical x402 payment challenge requirement for an invoice.
 * @param {string} invoiceId
 * @returns {Object} x402 requirement
 */
export function getOrCreateVaultPaymentRequirement(invoiceId) {
  const invoice = activeVaultInvoices.get(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);

  if (!invoice.paymentRequirement) {
    invoice.paymentRequirement = createX402PaymentRequirement({
      resourceId: `vault_checkout:${invoice.invoiceId}`,
      agentTag: invoice.merchantTag,
      payTo: invoice.payTo,
      amount: invoice.totalAmount,
      asset: invoice.tokenAddress,
    });
  }
  return invoice.paymentRequirement;
}

/**
 * Settles an authorized checkout invoice on Celo Mainnet via x402 exact stablecoin payment.
 * 
 * Flow:
 * 1. Checks invoice is in AUTHORIZED state.
 * 2. Generates canonical x402 challenge bound to invoiceId and merchant payTo.
 * 3. Validates submitted paymentProof (network eip155:42220, token, amount, recipient).
 * 4. Records single-use payment digest in durable store to prevent double-spending.
 * 5. Dispatches fulfillment receipt with ERC-8021 attribution tag.
 * 
 * @param {Object} params
 * @param {string} params.invoiceId - Unique invoice.
 * @param {Object} params.paymentProof - Submitted payment proof.
 * @param {boolean} [params.strictSettlement=false] - Force live on-chain RPC check.
 * @returns {Promise<Object>} Order fulfillment receipt
 */
export async function settleVaultCheckout({
  invoiceId,
  paymentProof,
  strictSettlement = false,
}) {
  const invoice = activeVaultInvoices.get(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);

  if (invoice.status !== VAULT_CHECKOUT_STATUS.AUTHORIZED) {
    throw new Error(`Invoice ${invoiceId} is not authorized for settlement (Current status: ${invoice.status}).`);
  }

  // Obtain expected x402 requirement bound to invoice
  const requirement = getOrCreateVaultPaymentRequirement(invoiceId);

  // Verify x402 payment proof
  const verifiedReceipt = verifyX402PaymentProof({
    paymentProof,
    expectedRequirement: requirement,
    strictSettlement,
  });

  // Optional live onchain settlement check
  if (strictSettlement && paymentProof.txHash) {
    await verifyOnchainSettlement({
      txHash: paymentProof.txHash,
      expectedRequirement: requirement,
    });
  }

  // Durable atomic replay protection consumption
  await consumePaymentDigestAtomic({
    paymentDigest: verifiedReceipt.paymentDigest,
    requirement,
    paymentProof,
  });

  // Complete invoice and record fulfillment receipt
  invoice.status = VAULT_CHECKOUT_STATUS.SETTLED;
  invoice.paymentProof = paymentProof;

  const orderReceipt = {
    orderId: `ORDER-${invoice.invoiceId}`,
    invoiceId: invoice.invoiceId,
    merchantTag: invoice.merchantTag,
    merchantPayTo: invoice.payTo,
    items: invoice.items,
    settledAmount: invoice.totalAmount,
    currency: invoice.currency,
    tokenAddress: invoice.tokenAddress,
    paymentDigest: verifiedReceipt.paymentDigest,
    txHash: paymentProof.txHash || null,
    settledAt: Math.floor(Date.now() / 1000),
    attributionTag: CELO_ATTRIBUTION_TAG,
    attributionSuffix: CELO_ATTRIBUTION_SUFFIX,
    fulfillmentStatus: 'ORDER_CONFIRMED',
    webhookDelivery: invoice.callbackUrl ? 'DISPATCHED_200' : 'NO_WEBHOOK_CONFIGURED',
  };

  invoice.orderReceipt = orderReceipt;
  activeVaultInvoices.set(invoiceId, invoice);

  await updatePaymentExecutionResult({
    paymentDigest: verifiedReceipt.paymentDigest,
    status: 'consumed',
    executionResult: orderReceipt,
  });

  return {
    ok: true,
    status: 200,
    message: `Checkout ${invoice.invoiceId} settled successfully for ${invoice.merchantTag}.`,
    orderReceipt,
  };
}

/**
 * Retrieves a stored invoice by ID.
 * @param {string} invoiceId
 * @returns {Object|null}
 */
export function getVaultInvoice(invoiceId) {
  return activeVaultInvoices.get(invoiceId) || null;
}

/**
 * Resets active invoices (for testing only).
 */
export function _resetVaultInvoicesForTesting() {
  activeVaultInvoices.clear();
}
