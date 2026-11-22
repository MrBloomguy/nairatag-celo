/**
 * @file corridorPaymentFlow.js
 * @description End-to-end Cross-Currency Agent Payment Orchestrator for NairaTag on Celo.
 * Connects:
 * 1. NairaTag Identity Resolution (e.g. ₦segun / @food / +234...)
 * 2. Textile FX v2 RFQ Indicative & Firm Quotes (USD₮ ⇄ cNGN)
 * 3. Explicit User Multi-Step Authorization
 * 4. Token Allowance & Swap Execution via Textile Reactor
 * 5. On-chain cNGN settlement to external recipient with ERC-8021 Attribution
 * 6. Cryptographically Verifiable Payment Receipts & Idempotency Safeguards.
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

// Idempotency cache to prevent accidental double-payments
const executedPaymentIntents = new Set();
const PAYMENT_RECEIPTS_KEY = 'nairatag_corridor_payment_receipts';

/**
 * Persists payment receipt in client storage
 */
export function persistPaymentReceipt(receipt) {
  if (typeof window === 'undefined' || !receipt?.receiptId) return;
  try {
    const raw = localStorage.getItem(PAYMENT_RECEIPTS_KEY);
    const records = raw ? JSON.parse(raw) : [];
    records.unshift(receipt);
    localStorage.setItem(PAYMENT_RECEIPTS_KEY, JSON.stringify(records.slice(0, 50)));
  } catch (err) {
    console.warn('[persistPaymentReceipt error]', err);
  }
}

/**
 * Retrieves persisted payment receipts
 */
export function getPersistedPaymentReceipts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENT_RECEIPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Prepares a cross-currency payment order:
 * Resolves recipient tag and fetches live indicative pricing from Textile FX.
 */
export async function prepareCorridorPayment({
  recipientTagOrAddress,
  amountInUsdt,
}) {
  if (!recipientTagOrAddress) {
    throw new Error('Recipient NairaTag or EVM address is required.');
  }
  if (!amountInUsdt || isNaN(Number(amountInUsdt)) || Number(amountInUsdt) <= 0) {
    throw new Error('Please enter a valid payment amount greater than 0.');
  }

  // 1. Resolve Recipient
  let recipientAddress = recipientTagOrAddress;
  let resolvedTag = null;
  let isPhoneGateway = false;

  if (isAddress(recipientTagOrAddress)) {
    recipientAddress = getAddress(recipientTagOrAddress);
  } else {
    const resolution = await resolveTag(recipientTagOrAddress);
    if (!resolution.success || !resolution.resolvedAddress) {
      throw new Error(resolution.error || `Unable to resolve recipient "${recipientTagOrAddress}".`);
    }
    recipientAddress = getAddress(resolution.resolvedAddress);
    resolvedTag = resolution.tag || recipientTagOrAddress;
    isPhoneGateway = Boolean(resolution.phone);
  }

  // 2. Fetch Live Indicative Textile FX Rate
  const sellAmountAtomic = toAtomicUnits(amountInUsdt, 6);
  const preview = await getIndicativePreview({
    sellToken: CELO_USDT_ADDRESS,
    buyToken: CELO_CNGN_ADDRESS,
    sellAmount: sellAmountAtomic,
  });

  const intentId = keccak256(stringToHex(`${recipientAddress}:${amountInUsdt}:${Date.now()}`));

  return {
    intentId,
    recipientAddress,
    recipientTag: resolvedTag,
    isPhoneGateway,
    amountInUsdt: String(amountInUsdt),
    sellAmountAtomic,
    previewBuyAmountCngn: preview.formattedBuyAmount,
    buyAmountAtomic: preview.buyAmountRaw,
    effectiveRate: preview.effectiveRate,
    feeAmount: preview.formattedFeeAmount,
    availableLiquidity: preview.availableSellAmount,
    isIndicative: true,
  };
}

/**
 * Transfers resulting cNGN to verified external recipient on Celo Mainnet.
 * Stamps transaction with mandatory ERC-8021 attribution suffix (celo_9f7deabd99a6).
 */
export async function transferCngnToRecipient({
  fromAddress,
  recipientAddress,
  amountCngn,
  memoText = '',
  onStatusUpdate = () => {},
}) {
  if (!fromAddress || !isAddress(fromAddress)) {
    throw new Error('Valid sender wallet is required.');
  }
  if (!recipientAddress || !isAddress(recipientAddress)) {
    throw new Error('Valid recipient address is required.');
  }

  const cleanAmount = String(amountCngn).trim();
  const parsedUnits = parseUnits(cleanAmount, 6);
  const userAddr = getAddress(fromAddress);
  const targetAddr = getAddress(recipientAddress);

  const provider = getEthereumProvider(null, userAddr);
  if (!provider) throw new Error('EVM wallet provider unavailable.');

  const { createWalletClient, custom } = await import('viem');
  const walletClient = createWalletClient({
    chain: celoMainnet,
    transport: custom(provider),
  });

  onStatusUpdate({ step: 'transferring', message: `Sending ${cleanAmount} cNGN to recipient...` });

  // Standard ERC-20 transfer calldata
  const transferData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [targetAddr, parsedUnits],
  });

  // Append ERC-8021 hackathon attribution suffix
  const taggedCalldata = concat([transferData, CELO_ATTRIBUTION_SUFFIX]);

  const hash = await walletClient.sendTransaction({
    account: userAddr,
    to: CELO_CNGN_ADDRESS,
    data: taggedCalldata,
    value: 0n,
  });

  onStatusUpdate({ step: 'confirming_transfer', message: 'Confirming transfer on Celo Mainnet...' });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  if (receipt.status !== 'success') {
    throw new Error(`cNGN transfer reverted on Celo. Tx: ${hash}`);
  }

  return {
    txHash: hash,
    receipt,
    blockNumber: Number(receipt.blockNumber),
    explorerUrl: `https://celoscan.io/tx/${hash}`,
    recipient: targetAddr,
    amountCngn: cleanAmount,
    attributionTag: CELO_ATTRIBUTION_TAG,
  };
}

/**
 * Orchestrates complete payment execution:
 * 1. Checks idempotency.
 * 2. Swaps USD₮ -> cNGN via Textile FX.
 * 3. Transfers exact cNGN to verified recipient.
 * 4. Issues cryptographically verifiable receipt.
 */
export async function executeCorridorPayment({
  paymentIntent,
  firmQuoteRecord,
  fromAddress,
  onStatusUpdate = () => {},
}) {
  if (!paymentIntent?.intentId) {
    throw new Error('Valid payment intent is required.');
  }
  if (executedPaymentIntents.has(paymentIntent.intentId)) {
    throw new Error('This payment intent has already been executed (idempotency safeguard).');
  }

  // Mark as in-flight
  executedPaymentIntents.add(paymentIntent.intentId);

  try {
    // 1. Execute Textile Swap
    onStatusUpdate({ step: 'swap_phase', message: 'Step 1/2: Converting USD₮ to cNGN via Textile FX...' });
    const swapResult = await executeTextileSwap({
      quoteRecord: firmQuoteRecord,
      fromAddress,
      onStatusUpdate,
    });

    // 2. Transfer cNGN to recipient
    onStatusUpdate({ step: 'payout_phase', message: `Step 2/2: Settling ${firmQuoteRecord.formattedBuyAmount} cNGN to ${paymentIntent.recipientTag || paymentIntent.recipientAddress}...` });
    const payoutResult = await transferCngnToRecipient({
      fromAddress,
      recipientAddress: paymentIntent.recipientAddress,
      amountCngn: firmQuoteRecord.formattedBuyAmount,
      memoText: `NairaTag Corridor: ${paymentIntent.recipientTag || ''}`,
      onStatusUpdate,
    });

    // 3. Construct Verifiable Receipt
    const receipt = {
      receiptId: `rcpt_${Date.now()}_${paymentIntent.intentId.slice(2, 10)}`,
      status: 'completed',
      timestamp: Date.now(),
      dateIso: new Date().toISOString(),
      senderAddress: fromAddress,
      recipientAddress: paymentIntent.recipientAddress,
      recipientTag: paymentIntent.recipientTag,
      amountSentUsdt: paymentIntent.amountInUsdt,
      amountDeliveredCngn: firmQuoteRecord.formattedBuyAmount,
      effectiveRate: firmQuoteRecord.effectiveRate,
      textileRfqId: firmQuoteRecord.rfqId,
      swapTxHash: swapResult.txHash,
      swapExplorerUrl: swapResult.explorerUrl,
      payoutTxHash: payoutResult.txHash,
      payoutExplorerUrl: payoutResult.explorerUrl,
      attributionTag: CELO_ATTRIBUTION_TAG,
      network: 'Celo Mainnet (42220)',
    };

    persistPaymentReceipt(receipt);
    return receipt;
  } catch (err) {
    // Release in-flight lock on failure so user can retry safely
    executedPaymentIntents.delete(paymentIntent.intentId);
    throw err;
  }
}
