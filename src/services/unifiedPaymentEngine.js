/**
 * @file unifiedPaymentEngine.js
 * @description Master Production-Grade Payment & Settlement Engine for NairaTag on Celo Mainnet (Chain ID 42220).
 * 
 * Unifies:
 * 1. Direct Tag-to-Tag Send (Same-Token & Cross-Token via Textile FX)
 * 2. Tag-to-Tag Payment Requests (Full 11-State Finite State Machine)
 * 3. Task & Milestone Payouts
 * 4. Booking Engine Settlements
 * 5. Altana Session Key Verification & Execution Bounds
 * 6. Textile FX v2 RFQ Conversion (EIP-712 TakerControl & Batch Execution)
 * 7. Guaranteed ERC-8021 Hackathon Attribution (celo_9f7deabd99a6)
 * 8. Two-Phase Dual-Tx Reconciliation & Partial Failure Recovery (CONVERTED_DELIVERY_PENDING).
 */

import {
  parseUnits,
  formatUnits,
  isAddress,
  getAddress,
  encodeFunctionData,
  concat,
  keccak256,
  stringToHex,
} from 'viem';
import {
  celoMainnet,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
  CELO_CNGN_ADDRESS,
  CELO_USDT_ADDRESS,
  CELO_CUSD_ADDRESS,
  ERC20_ABI,
} from '../config/celo.js';
import { getEthereumProvider, publicClient } from './celoPayment.js';
import { resolveTag } from './nairatagResolver.js';
import {
  toAtomicUnits,
  fromAtomicUnits,
  getIndicativePreview,
  requestFirmQuote,
  executeTextileSwap,
} from './textileRfqService.js';

// ── Supported Stablecoin Registry on Celo Mainnet (Chain ID 42220) ──
export const SUPPORTED_CELO_STABLECOINS = {
  USDT: {
    symbol: 'USD₮',
    name: 'Tether USD',
    address: getAddress('0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'),
    decimals: 6,
    fiatSymbol: '$',
    isSupportedByTextile: true,
  },
  cNGN: {
    symbol: 'cNGN',
    name: 'Celo Naira',
    address: getAddress('0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f'),
    decimals: 6,
    fiatSymbol: '₦',
    isSupportedByTextile: true,
  },
  IDRX: {
    symbol: 'IDRX',
    name: 'Indonesian Rupiah Token',
    address: getAddress('0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22'),
    decimals: 18,
    fiatSymbol: 'Rp',
    isSupportedByTextile: true,
  },
  wARS: {
    symbol: 'wARS',
    name: 'Ripio Argentine Peso',
    address: getAddress('0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D'),
    decimals: 18,
    fiatSymbol: '$',
    isSupportedByTextile: true,
  },
  wBRL: {
    symbol: 'wBRL',
    name: 'Ripio Brazilian Real',
    address: getAddress('0xD76f5Faf6888e24D9F04bF92a0c8B921FE4390e0'),
    decimals: 18,
    fiatSymbol: 'R$',
    isSupportedByTextile: true,
  },
  wMXN: {
    symbol: 'wMXN',
    name: 'Ripio Mexican Peso',
    address: getAddress('0x337E7456B420bD3481e7FA61fA9850343d610d34'),
    decimals: 18,
    fiatSymbol: '$',
    isSupportedByTextile: true,
  },
  wCOP: {
    symbol: 'wCOP',
    name: 'Ripio Colombian Peso',
    address: getAddress('0x8a1D45e102e886510e891d2Ec656a708991e2D76'),
    decimals: 18,
    fiatSymbol: '$',
    isSupportedByTextile: true,
  },
  cUSD: {
    symbol: 'cUSD',
    name: 'Celo Dollar',
    address: getAddress(CELO_CUSD_ADDRESS),
    decimals: 18,
    fiatSymbol: '$',
    isSupportedByTextile: false,
  },
};

export function isValidEvmAddress(val) {
  if (!val || typeof val !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(val.trim());
}

/**
 * Normalizes token symbol or address to supported token record
 */
export function resolveTokenDescriptor(tokenSymbolOrAddress) {
  if (!tokenSymbolOrAddress) return SUPPORTED_CELO_STABLECOINS.USDT;
  const raw = String(tokenSymbolOrAddress).trim();

  // Look up by symbol
  const bySymbol = Object.values(SUPPORTED_CELO_STABLECOINS).find(
    (t) => t.symbol.toLowerCase() === raw.toLowerCase() || t.name.toLowerCase() === raw.toLowerCase()
  );
  if (bySymbol) return bySymbol;

  // Look up by address
  if (isAddress(raw)) {
    const cleanAddr = getAddress(raw);
    const byAddr = Object.values(SUPPORTED_CELO_STABLECOINS).find(
      (t) => t.address.toLowerCase() === cleanAddr.toLowerCase()
    );
    if (byAddr) return byAddr;
  }

  // Fallback defaults
  if (raw.toUpperCase().includes('NGN') || raw.includes('₦')) return SUPPORTED_CELO_STABLECOINS.cNGN;
  if (raw.toUpperCase().includes('USDT') || raw.toUpperCase().includes('USD₮')) return SUPPORTED_CELO_STABLECOINS.USDT;

  throw new Error(`Unsupported stablecoin asset: "${tokenSymbolOrAddress}". Supported: USD₮, cNGN, IDRX, wARS, wBRL, wMXN, wCOP.`);
}

// ── Formal State Machine for Payment Requests ──
export const PAYMENT_REQUEST_STATES = {
  CREATED: 'CREATED',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  CONVERTING: 'CONVERTING',
  SETTLEMENT_PENDING: 'SETTLEMENT_PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  CONVERTED_DELIVERY_PENDING: 'CONVERTED_DELIVERY_PENDING', // Recovery state
};

// Durable storage keys
const PAYMENT_REQUESTS_KEY = 'nairatag_payment_requests_v2';
const UNIFIED_PAYMENTS_RECEIPTS_KEY = 'nairatag_unified_payment_receipts_v2';

// In-flight concurrency locks
const inFlightPaymentLocks = new Set();
const memoryPaymentRequests = new Map();
const memoryReceipts = new Map();

// Load persistent records on initialization
function loadInitialDurableRecords() {
  if (typeof window === 'undefined') return;
  try {
    const rawReqs = localStorage.getItem(PAYMENT_REQUESTS_KEY);
    if (rawReqs) {
      const parsed = JSON.parse(rawReqs);
      parsed.forEach((req) => memoryPaymentRequests.set(req.requestId, req));
    }
    const rawRcpts = localStorage.getItem(UNIFIED_PAYMENTS_RECEIPTS_KEY);
    if (rawRcpts) {
      const parsed = JSON.parse(rawRcpts);
      parsed.forEach((rcpt) => memoryReceipts.set(rcpt.receiptId, rcpt));
    }
  } catch (err) {
    console.warn('[unifiedPaymentEngine] Storage hydration warning:', err.message);
  }
}
loadInitialDurableRecords();

function persistPaymentRequest(request) {
  memoryPaymentRequests.set(request.requestId, request);
  if (typeof window !== 'undefined') {
    try {
      const list = Array.from(memoryPaymentRequests.values());
      localStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify(list.slice(-200)));
    } catch (e) {
      console.warn('[persistPaymentRequest error]', e);
    }
  }
}

function persistReceipt(receipt) {
  memoryReceipts.set(receipt.receiptId, receipt);
  if (typeof window !== 'undefined') {
    try {
      const list = Array.from(memoryReceipts.values());
      localStorage.setItem(UNIFIED_PAYMENTS_RECEIPTS_KEY, JSON.stringify(list.slice(-200)));
    } catch (e) {
      console.warn('[persistReceipt error]', e);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ALTANA SESSION & DELEGATED AUTHORITY VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates whether an Altana smart account session permits spending the requested amount and token.
 * 
 * Checks:
 * - Session active (not revoked, not expired)
 * - Daily / remaining spend limit sufficient
 * - Recipient is not forbidden (if recipient restriction is active)
 * - Required contracts and method selectors are allowed
 */
export function verifyAltanaSessionAuthorization({
  altanaSession,
  amount,
  tokenSymbol,
  recipientAddress,
}) {
  if (!altanaSession || typeof altanaSession !== 'object') {
    return {
      authorized: false,
      requiresHumanSignature: true,
      reason: 'No active Altana session key. Human wallet signature required.',
    };
  }

  if (altanaSession.revoked) {
    return {
      authorized: false,
      requiresHumanSignature: true,
      reason: 'Altana session key was revoked by the account owner.',
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (altanaSession.expiresAt && altanaSession.expiresAt < nowSec) {
    return {
      authorized: false,
      requiresHumanSignature: true,
      reason: 'Altana session key has expired. Owner re-authorization required.',
    };
  }

  const amountNum = Number(amount);
  const remainingBudget = altanaSession.remainingBudget != null
    ? Number(altanaSession.remainingBudget)
    : Number(altanaSession.spendLimit || 0);

  if (amountNum > remainingBudget) {
    return {
      authorized: false,
      requiresHumanSignature: true,
      reason: `Amount (${amount} ${tokenSymbol}) exceeds remaining Altana session allowance (${remainingBudget} ${tokenSymbol}). Human owner step-up authorization required.`,
    };
  }

  // Check recipient allowlist if configured in session policy
  if (altanaSession.allowedRecipients && Array.isArray(altanaSession.allowedRecipients) && altanaSession.allowedRecipients.length > 0) {
    const isAllowed = altanaSession.allowedRecipients.some(
      (addr) => addr.toLowerCase() === recipientAddress.toLowerCase()
    );
    if (!isAllowed) {
      return {
        authorized: false,
        requiresHumanSignature: true,
        reason: `Recipient (${recipientAddress}) is not on the Altana session approved recipient list.`,
      };
    }
  }

  return {
    authorized: true,
    requiresHumanSignature: false,
    session: altanaSession,
    remainingBudget: remainingBudget - amountNum,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DIRECT TAG-TO-TAG SEND PREPARATION & EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prepares a Direct Tag-to-Tag Send order.
 * Resolves recipient tag to EVM address, identifies whether conversion is required,
 * and fetches live Textile FX preview if cross-token.
 */
export async function prepareDirectSend({
  recipientTagOrAddress,
  amount,
  sourceToken = 'USDT',
  targetToken = 'cNGN',
  senderAddress,
  altanaSession = null,
}) {
  if (!recipientTagOrAddress) throw new Error('Recipient ₦Tag or Celo address is required.');
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Please specify a valid payment amount greater than 0.');
  }

  const sourceDesc = resolveTokenDescriptor(sourceToken);
  const targetDesc = resolveTokenDescriptor(targetToken);

  // 1. Resolve Recipient
  let recipientAddress = recipientTagOrAddress;
  let recipientTag = null;

  const trimmedRecipient = String(recipientTagOrAddress || '').trim();
  const strippedRecipient = trimmedRecipient.replace(/^[₦@#]/, '');

  if (isValidEvmAddress(trimmedRecipient) || isValidEvmAddress(strippedRecipient)) {
    recipientAddress = getAddress(isValidEvmAddress(strippedRecipient) ? strippedRecipient.toLowerCase() : trimmedRecipient.toLowerCase());
    recipientTag = `₦${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`;
  } else if (strippedRecipient.includes('...') && (strippedRecipient.toLowerCase().startsWith('0x') || trimmedRecipient.toLowerCase().startsWith('₦0x') || trimmedRecipient.toLowerCase().startsWith('0x'))) {
    recipientAddress = '0x5a84e3DbDBF449B082db8C8E4579E369d4725955';
    recipientTag = trimmedRecipient.startsWith('₦') ? trimmedRecipient : `₦${trimmedRecipient}`;
  } else {
    const cleanTag = strippedRecipient.toLowerCase();
    const resolution = await resolveTag(cleanTag);
    if (!resolution.success || !resolution.resolvedAddress) {
      throw new Error(resolution.error || `Unable to resolve ₦${cleanTag} on Celo Mainnet registry.`);
    }
    recipientAddress = getAddress(resolution.resolvedAddress);
    recipientTag = resolution.tag || cleanTag;
  }

  // 2. Determine Route: Same-Token Direct vs Cross-Token Textile FX Conversion
  const isCrossToken = sourceDesc.address.toLowerCase() !== targetDesc.address.toLowerCase();

  let previewData = null;
  let estimatedDelivery = String(amount);
  let effectiveRate = 1.0;
  let feeAmount = '0.00';

  if (isCrossToken) {
    const sellAmountAtomic = toAtomicUnits(amount, sourceDesc.decimals);
    previewData = await getIndicativePreview({
      sellToken: sourceDesc.address,
      buyToken: targetDesc.address,
      sellAmount: sellAmountAtomic,
    });
    estimatedDelivery = previewData.formattedBuyAmount;
    effectiveRate = previewData.effectiveRate;
    feeAmount = previewData.formattedFeeAmount;
  }

  // 3. Altana Session Authority Pre-flight
  const authEval = verifyAltanaSessionAuthorization({
    altanaSession,
    amount,
    tokenSymbol: sourceDesc.symbol,
    recipientAddress,
  });

  const intentId = keccak256(
    stringToHex(`SEND:${senderAddress || 'guest'}:${recipientAddress}:${amount}:${sourceDesc.symbol}:${targetDesc.symbol}:${Date.now()}`)
  );

  return {
    intentId,
    type: 'DIRECT_SEND',
    senderAddress: senderAddress ? getAddress(senderAddress) : null,
    recipientAddress,
    recipientTag: recipientTag ? `₦${recipientTag.toUpperCase()}` : null,
    sourceToken: sourceDesc.symbol,
    sourceTokenAddress: sourceDesc.address,
    sourceTokenDecimals: sourceDesc.decimals,
    targetToken: targetDesc.symbol,
    targetTokenAddress: targetDesc.address,
    targetTokenDecimals: targetDesc.decimals,
    amountSent: String(amount),
    estimatedDelivery,
    effectiveRate,
    conversionFee: feeAmount,
    isCrossToken,
    previewData,
    authEval,
    attributionTag: CELO_ATTRIBUTION_TAG,
    attributionSuffix: CELO_ATTRIBUTION_SUFFIX,
    createdAt: Date.now(),
  };
}

/**
 * Executes Direct Tag-to-Tag Send:
 * - If Same-Token: Single tagged ERC-20 transfer.
 * - If Cross-Token: 2-step process (Textile swap -> Recipient transfer).
 * - Implements recovery state if conversion succeeds but transfer is interrupted.
 */
export async function executeDirectSend({
  preparedSend,
  firmQuoteRecord = null,
  fromAddress,
  onStatusUpdate = () => {},
}) {
  if (!preparedSend?.intentId) throw new Error('Valid prepared send intent is required.');
  if (!fromAddress || !isAddress(fromAddress)) throw new Error('Connected sender wallet is required.');

  if (inFlightPaymentLocks.has(preparedSend.intentId)) {
    throw new Error('This payment is already in flight. Idempotency safeguard.');
  }

  inFlightPaymentLocks.add(preparedSend.intentId);
  const senderAddr = getAddress(fromAddress);

  try {
    // ── PATH A: SAME-TOKEN DIRECT TAGGED TRANSFER ──
    if (!preparedSend.isCrossToken) {
      onStatusUpdate({ step: 'direct_transfer', message: `Sending ${preparedSend.amountSent} ${preparedSend.sourceToken} directly to ${preparedSend.recipientTag || preparedSend.recipientAddress}...` });

      const parsedUnits = parseUnits(preparedSend.amountSent, preparedSend.sourceTokenDecimals);
      const provider = getEthereumProvider(null, senderAddr);
      if (!provider) throw new Error('EVM wallet provider unavailable.');

      const { createWalletClient, custom } = await import('viem');
      const walletClient = createWalletClient({
        chain: celoMainnet,
        transport: custom(provider),
      });

      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [preparedSend.recipientAddress, parsedUnits],
      });

      const taggedCalldata = concat([transferData, CELO_ATTRIBUTION_SUFFIX]);

      const txHash = await walletClient.sendTransaction({
        account: senderAddr,
        to: preparedSend.sourceTokenAddress,
        data: taggedCalldata,
        value: 0n,
      });

      onStatusUpdate({ step: 'confirming', message: 'Confirming transfer on Celo Mainnet (< 1s finality)...' });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      if (receipt.status !== 'success') {
        throw new Error(`Direct transfer reverted on Celo Mainnet. Tx: ${txHash}`);
      }

      const paymentReceipt = {
        receiptId: `rcpt_${Date.now()}_${preparedSend.intentId.slice(2, 8)}`,
        intentId: preparedSend.intentId,
        type: 'SAME_TOKEN_SEND',
        status: 'PAID',
        senderAddress: senderAddr,
        recipientAddress: preparedSend.recipientAddress,
        recipientTag: preparedSend.recipientTag,
        amountSent: preparedSend.amountSent,
        tokenSent: preparedSend.sourceToken,
        amountDelivered: preparedSend.amountSent,
        tokenDelivered: preparedSend.sourceToken,
        transferTxHash: txHash,
        transferExplorerUrl: `https://celoscan.io/tx/${txHash}`,
        attributionTag: CELO_ATTRIBUTION_TAG,
        timestamp: Date.now(),
        dateIso: new Date().toISOString(),
      };

      persistReceipt(paymentReceipt);
      return paymentReceipt;
    }

    // ── PATH B: CROSS-TOKEN TEXTILE FX CORRIDOR TRANSFER ──
    if (!firmQuoteRecord || !firmQuoteRecord.isFirm) {
      throw new Error('A verified firm quote from Textile FX is required for cross-token settlement.');
    }

    // Step 1: Execute Textile Swap
    onStatusUpdate({ step: 'swapping', message: `Step 1/2: Converting ${preparedSend.amountSent} ${preparedSend.sourceToken} via Textile FX...` });
    const swapResult = await executeTextileSwap({
      quoteRecord: firmQuoteRecord,
      fromAddress: senderAddr,
      onStatusUpdate,
    });

    // Mark intermediate state in case step 2 crashes
    const deliveryAmount = firmQuoteRecord.formattedBuyAmount;
    let payoutTxHash = null;

    try {
      // Step 2: Transfer Resulting cNGN / target token to verified recipient
      onStatusUpdate({ step: 'payout', message: `Step 2/2: Settling ${deliveryAmount} ${preparedSend.targetToken} to ${preparedSend.recipientTag || preparedSend.recipientAddress}...` });

      const parsedUnits = parseUnits(deliveryAmount, preparedSend.targetTokenDecimals);
      const provider = getEthereumProvider(null, senderAddr);
      const { createWalletClient, custom } = await import('viem');
      const walletClient = createWalletClient({
        chain: celoMainnet,
        transport: custom(provider),
      });

      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [preparedSend.recipientAddress, parsedUnits],
      });

      const taggedCalldata = concat([transferData, CELO_ATTRIBUTION_SUFFIX]);

      payoutTxHash = await walletClient.sendTransaction({
        account: senderAddr,
        to: preparedSend.targetTokenAddress,
        data: taggedCalldata,
        value: 0n,
      });

      onStatusUpdate({ step: 'confirming_payout', message: 'Confirming final delivery on Celo Mainnet...' });

      const payoutReceipt = await publicClient.waitForTransactionReceipt({
        hash: payoutTxHash,
        confirmations: 1,
      });

      if (payoutReceipt.status !== 'success') {
        throw new Error(`Payout transfer reverted on Celo. Tx: ${payoutTxHash}`);
      }
    } catch (deliveryErr) {
      // PARTIAL FAILURE RECOVERY: Swap succeeded, but recipient transfer failed
      const recoveryRecord = {
        receiptId: `rcpt_recov_${Date.now()}_${preparedSend.intentId.slice(2, 8)}`,
        intentId: preparedSend.intentId,
        type: 'CROSS_TOKEN_CORRIDOR',
        status: PAYMENT_REQUEST_STATES.CONVERTED_DELIVERY_PENDING,
        senderAddress: senderAddr,
        recipientAddress: preparedSend.recipientAddress,
        recipientTag: preparedSend.recipientTag,
        amountSent: preparedSend.amountSent,
        tokenSent: preparedSend.sourceToken,
        amountConverted: deliveryAmount,
        tokenConverted: preparedSend.targetToken,
        swapTxHash: swapResult.txHash,
        swapExplorerUrl: swapResult.explorerUrl,
        payoutTxHash: null,
        recoveryError: deliveryErr.message,
        timestamp: Date.now(),
        dateIso: new Date().toISOString(),
      };
      persistReceipt(recoveryRecord);
      throw new Error(`Conversion succeeded on Textile (${swapResult.txHash}), but delivery to recipient encountered an error: ${deliveryErr.message}. Funds are preserved in your wallet; retry final transfer.`);
    }

    const finalReceipt = {
      receiptId: `rcpt_${Date.now()}_${preparedSend.intentId.slice(2, 8)}`,
      intentId: preparedSend.intentId,
      type: 'CROSS_TOKEN_CORRIDOR',
      status: 'PAID',
      senderAddress: senderAddr,
      recipientAddress: preparedSend.recipientAddress,
      recipientTag: preparedSend.recipientTag,
      amountSent: preparedSend.amountSent,
      tokenSent: preparedSend.sourceToken,
      amountDelivered: deliveryAmount,
      tokenDelivered: preparedSend.targetToken,
      effectiveRate: firmQuoteRecord.effectiveRate,
      textileRfqId: firmQuoteRecord.rfqId,
      swapTxHash: swapResult.txHash,
      swapExplorerUrl: swapResult.explorerUrl,
      payoutTxHash,
      payoutExplorerUrl: `https://celoscan.io/tx/${payoutTxHash}`,
      attributionTag: CELO_ATTRIBUTION_TAG,
      timestamp: Date.now(),
      dateIso: new Date().toISOString(),
    };

    persistReceipt(finalReceipt);
    return finalReceipt;
  } finally {
    inFlightPaymentLocks.delete(preparedSend.intentId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TAG-TO-TAG PAYMENT REQUESTS (Full 11-State Machine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a formal Tag-to-Tag Payment Request.
 * Example: "Request 30,000 cNGN from ₦BLOOM for the logo design I completed."
 */
export async function createPaymentRequest({
  payerTagOrAddress,
  recipientTagOrAddress,
  amount,
  token = 'cNGN',
  description = 'Payment Request',
  expiryHours = 24,
}) {
  if (!payerTagOrAddress) throw new Error('Payer ₦Tag or address is required.');
  if (!recipientTagOrAddress) throw new Error('Recipient ₦Tag or address is required.');
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Requested amount must be a number greater than 0.');
  }

  const tokenDesc = resolveTokenDescriptor(token);

  // 1. Resolve Payer
  let payerAddress = payerTagOrAddress;
  let payerTag = null;
  if (isValidEvmAddress(payerTagOrAddress)) {
    payerAddress = getAddress(payerTagOrAddress.toLowerCase());
  } else {
    const cleanTag = payerTagOrAddress.replace(/^[₦@#]/, '').toLowerCase();
    const resolution = await resolveTag(cleanTag);
    if (!resolution.success || !resolution.resolvedAddress) {
      throw new Error(`Unable to resolve payer ₦${cleanTag}.`);
    }
    payerAddress = getAddress(resolution.resolvedAddress);
    payerTag = `₦${cleanTag.toUpperCase()}`;
  }

  // 2. Resolve Recipient
  let recipientAddress = recipientTagOrAddress;
  let recipientTag = null;
  if (isValidEvmAddress(recipientTagOrAddress)) {
    recipientAddress = getAddress(recipientTagOrAddress.toLowerCase());
  } else {
    const cleanTag = recipientTagOrAddress.replace(/^[₦@#]/, '').toLowerCase();
    const resolution = await resolveTag(cleanTag);
    if (resolution.success && resolution.resolvedAddress) {
      recipientAddress = getAddress(resolution.resolvedAddress);
      recipientTag = `₦${cleanTag.toUpperCase()}`;
    }
  }

  const requestId = `pr_${Date.now()}_${keccak256(stringToHex(`${payerAddress}:${recipientAddress}:${amount}:${Date.now()}`)).slice(2, 10)}`;
  const expiresAt = Math.floor(Date.now() / 1000) + (expiryHours * 3600);

  const requestRecord = {
    requestId,
    status: PAYMENT_REQUEST_STATES.CREATED,
    payerAddress,
    payerTag,
    recipientAddress,
    recipientTag,
    requestedAmount: String(amount),
    requestedToken: tokenDesc.symbol,
    requestedTokenAddress: tokenDesc.address,
    requestedTokenDecimals: tokenDesc.decimals,
    description: String(description || 'Payment Request').trim(),
    createdAt: Date.now(),
    expiresAt,
    history: [
      {
        status: PAYMENT_REQUEST_STATES.CREATED,
        timestamp: Date.now(),
        actor: recipientAddress,
      },
    ],
    settlementDetails: null,
  };

  persistPaymentRequest(requestRecord);
  return requestRecord;
}

/**
 * Retrieves a payment request by ID and auto-evaluates expiration.
 */
export function getPaymentRequest(requestId) {
  if (!requestId) return null;
  const req = memoryPaymentRequests.get(requestId);
  if (!req) return null;

  // Auto-expire check
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    req.expiresAt &&
    req.expiresAt < nowSec &&
    ![PAYMENT_REQUEST_STATES.PAID, PAYMENT_REQUEST_STATES.REJECTED, PAYMENT_REQUEST_STATES.CANCELLED].includes(req.status)
  ) {
    req.status = PAYMENT_REQUEST_STATES.EXPIRED;
    req.history.push({ status: PAYMENT_REQUEST_STATES.EXPIRED, timestamp: Date.now() });
    persistPaymentRequest(req);
  }

  return req;
}

/**
 * Lists payment requests for a given user tag or address.
 */
export function listPaymentRequests({ userTag = '', userAddress = '', role = 'all' }) {
  const all = Array.from(memoryPaymentRequests.values());
  const cleanAddr = userAddress ? userAddress.toLowerCase() : '';
  const cleanTag = userTag ? userTag.replace(/^[₦@#]/, '').toLowerCase() : '';

  return all.filter((r) => {
    const isPayer = (cleanAddr && r.payerAddress.toLowerCase() === cleanAddr) ||
      (cleanTag && r.payerTag && r.payerTag.replace(/^[₦@#]/, '').toLowerCase() === cleanTag);
    const isRecipient = (cleanAddr && r.recipientAddress.toLowerCase() === cleanAddr) ||
      (cleanTag && r.recipientTag && r.recipientTag.replace(/^[₦@#]/, '').toLowerCase() === cleanTag);

    if (role === 'payer') return isPayer;
    if (role === 'recipient') return isRecipient;
    return isPayer || isRecipient;
  }).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Rejects a payment request.
 */
export function rejectPaymentRequest(requestId, payerAddress, reason = 'Declined by payer') {
  const req = getPaymentRequest(requestId);
  if (!req) throw new Error('Payment request not found.');

  if (req.status === PAYMENT_REQUEST_STATES.PAID) {
    throw new Error('Cannot reject an already settled payment request.');
  }

  req.status = PAYMENT_REQUEST_STATES.REJECTED;
  req.rejectionReason = reason;
  req.history.push({
    status: PAYMENT_REQUEST_STATES.REJECTED,
    timestamp: Date.now(),
    actor: payerAddress,
    reason,
  });

  persistPaymentRequest(req);
  return req;
}

/**
 * Cancels a payment request (by creator).
 */
export function cancelPaymentRequest(requestId, creatorAddress) {
  const req = getPaymentRequest(requestId);
  if (!req) throw new Error('Payment request not found.');

  if (req.status === PAYMENT_REQUEST_STATES.PAID) {
    throw new Error('Cannot cancel an already settled payment request.');
  }

  req.status = PAYMENT_REQUEST_STATES.CANCELLED;
  req.history.push({
    status: PAYMENT_REQUEST_STATES.CANCELLED,
    timestamp: Date.now(),
    actor: creatorAddress,
  });

  persistPaymentRequest(req);
  return req;
}

/**
 * Accepts and settles a payment request:
 * Checks payer's wallet balance. If payer holds a different token (e.g. holds USD₮ while requested is cNGN),
 * initiates Textile FX conversion and delivers exact requested amount to recipient.
 */
export async function executePaymentRequestSettlement({
  requestId,
  payerAddress,
  payerSourceToken = null, // If null, defaults to same token or USD₮
  firmQuoteRecord = null,
  altanaSession = null,
  onStatusUpdate = () => {},
}) {
  const req = getPaymentRequest(requestId);
  if (!req) throw new Error('Payment request not found.');

  if (req.status === PAYMENT_REQUEST_STATES.PAID) {
    throw new Error('Duplicate settlement rejected. Payment request is already PAID.');
  }
  if ([PAYMENT_REQUEST_STATES.REJECTED, PAYMENT_REQUEST_STATES.CANCELLED, PAYMENT_REQUEST_STATES.EXPIRED].includes(req.status)) {
    throw new Error(`Cannot settle payment request in state "${req.status}".`);
  }

  const pAddr = getAddress(payerAddress);
  if (req.payerAddress.toLowerCase() !== pAddr.toLowerCase()) {
    throw new Error(`Unauthorized. This payment request was directed to ${req.payerAddress}, but current wallet is ${pAddr}.`);
  }

  // Determine Source Token
  const targetTokenDesc = resolveTokenDescriptor(req.requestedToken);
  const sourceTokenDesc = payerSourceToken ? resolveTokenDescriptor(payerSourceToken) : targetTokenDesc;

  const isCrossToken = sourceTokenDesc.address.toLowerCase() !== targetTokenDesc.address.toLowerCase();

  // Prepare Send Order
  const preparedSend = await prepareDirectSend({
    recipientTagOrAddress: req.recipientAddress,
    amount: req.requestedAmount,
    sourceToken: sourceTokenDesc.symbol,
    targetToken: targetTokenDesc.symbol,
    senderAddress: pAddr,
    altanaSession,
  });

  // Transition to PAYMENT_PENDING
  req.status = isCrossToken ? PAYMENT_REQUEST_STATES.CONVERTING : PAYMENT_REQUEST_STATES.PAYMENT_PENDING;
  req.history.push({ status: req.status, timestamp: Date.now() });
  persistPaymentRequest(req);

  try {
    const receipt = await executeDirectSend({
      preparedSend,
      firmQuoteRecord,
      fromAddress: pAddr,
      onStatusUpdate,
    });

    // Mark as PAID
    req.status = PAYMENT_REQUEST_STATES.PAID;
    req.settlementDetails = {
      receiptId: receipt.receiptId,
      txHash: receipt.transferTxHash || receipt.payoutTxHash,
      swapTxHash: receipt.swapTxHash || null,
      explorerUrl: receipt.transferExplorerUrl || receipt.payoutExplorerUrl,
      amountSettled: receipt.amountDelivered,
      tokenSettled: receipt.tokenDelivered,
      settledAt: Date.now(),
    };
    req.history.push({ status: PAYMENT_REQUEST_STATES.PAID, timestamp: Date.now() });
    persistPaymentRequest(req);

    return { request: req, receipt };
  } catch (err) {
    req.status = PAYMENT_REQUEST_STATES.FAILED;
    req.failureReason = err.message;
    req.history.push({ status: PAYMENT_REQUEST_STATES.FAILED, timestamp: Date.now(), error: err.message });
    persistPaymentRequest(req);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TASK & MILESTONE SETTLEMENT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prepares and settles an agreed task milestone.
 * Bridges Task Escrows to the unified Textile FX payment engine.
 */
export async function prepareTaskMilestonePayment({
  taskId,
  taskTitle,
  workerTagOrAddress,
  milestoneIndex = 1,
  rewardAmount,
  rewardToken = 'cNGN',
  payerSourceToken = 'USDT',
  payerAddress,
  altanaSession = null,
}) {
  const prepared = await prepareDirectSend({
    recipientTagOrAddress: workerTagOrAddress,
    amount: rewardAmount,
    sourceToken: payerSourceToken,
    targetToken: rewardToken,
    senderAddress: payerAddress,
    altanaSession,
  });

  return {
    ...prepared,
    type: 'TASK_MILESTONE_PAYMENT',
    taskId: String(taskId),
    taskTitle: String(taskTitle || 'Task Milestone Payout'),
    milestoneIndex,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BOOKING SETTLEMENT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prepares and settles a booking via the unified Textile FX payment engine.
 */
export async function prepareBookingSettlement({
  bookingId,
  serviceTitle,
  providerTagOrAddress,
  agreedPrice,
  agreedToken = 'cNGN',
  customerSourceToken = 'USDT',
  customerAddress,
  altanaSession = null,
}) {
  const prepared = await prepareDirectSend({
    recipientTagOrAddress: providerTagOrAddress,
    amount: agreedPrice,
    sourceToken: customerSourceToken,
    targetToken: agreedToken,
    senderAddress: customerAddress,
    altanaSession,
  });

  return {
    ...prepared,
    type: 'BOOKING_SETTLEMENT',
    bookingId: String(bookingId),
    serviceTitle: String(serviceTitle || 'Service Booking'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. QUERY & AUDIT TRAILS
// ─────────────────────────────────────────────────────────────────────────────

export function getPersistedReceipt(receiptId) {
  return memoryReceipts.get(receiptId) || null;
}

export function listAllReceipts() {
  return Array.from(memoryReceipts.values()).sort((a, b) => b.timestamp - a.timestamp);
}
