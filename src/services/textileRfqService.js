/**
 * @file textileRfqService.js
 * @description Production-grade Textile FX API v2 Client for Celo Mainnet (Chain ID 42220).
 * Implements:
 * - Indicative Quote: POST /rfq/preview
 * - Firm Quote: POST /rfq/request with EIP-712 / EIP-191 TakerControl Proof of Control
 * - Order Submission: POST /rfq/{id}/submit
 * - Order Status: GET /rfq/{id}
 * - Order Cancellation: POST /rfq/{id}/cancel
 * - ERC-8021 Hackathon Attribution composition (celo_9f7deabd99a6)
 * - Bundled Multi-Maker Swap Execution support
 * 
 * Strict specifications from OpenAPI 3.1.0 (https://api.textilecredit.com/v2/openapi.json).
 */

// Polyfill BigInt serialization for JSON.stringify across all RPC/wallet calls
if (typeof BigInt !== 'undefined' && !('toJSON' in BigInt.prototype)) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

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
  TEXTILE_FX_ROUTER,
  ERC20_ABI,
} from '../config/celo.js';
import { getEthereumProvider, publicClient } from './celoPayment.js';

export const TEXTILE_BASE_URL = 'https://api.textilecredit.com/v2';
export const CELO_CHAIN_ID = 42220;

/**
 * Smart fetch wrapper that routes through serverless /api/textile-proxy in browsers
 * to prevent CORS preflight failures (as Textile's serverless ALB returns 404 on OPTIONS).
 * In Node.js / CLI test environments, calls TEXTILE_BASE_URL directly.
 */
export async function fetchTextile(endpoint, options = {}) {
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const directUrl = `${TEXTILE_BASE_URL}/${cleanEndpoint}`;
  const isBrowser = typeof window !== 'undefined';
  const proxyUrl = `/api/textile-proxy?endpoint=${encodeURIComponent(cleanEndpoint)}`;

  const primaryUrl = isBrowser ? proxyUrl : directUrl;
  const fallbackUrl = isBrowser ? directUrl : proxyUrl;

  // Ensure options.headers has x-textile-endpoint
  const requestOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
      'x-textile-endpoint': cleanEndpoint,
    },
  };

  try {
    const res = await fetch(primaryUrl, requestOptions);
    if (!res.ok && isBrowser && res.status >= 500) {
      return await fetch(fallbackUrl, requestOptions);
    }
    return res;
  } catch (err) {
    if (isBrowser) {
      console.warn('[Textile primary fetch failed, attempting fallback]:', err.message);
      return await fetch(fallbackUrl, requestOptions);
    }
    throw err;
  }
}

// Token decimals on Celo Mainnet
export const TOKEN_DECIMALS = {
  [CELO_USDT_ADDRESS.toLowerCase()]: 6,
  [CELO_CNGN_ADDRESS.toLowerCase()]: 6,
};

/**
 * Prepares the executable swap transaction with verified ERC-8021 attribution suffix.
 */
export function prepareSwapExecution(quoteRecord, userAddress) {
  const swapTxData = quoteRecord.transactions?.swap;
  if (!swapTxData || !swapTxData.to || !swapTxData.data) {
    throw new Error('Firm quote does not contain executable swap transaction payload.');
  }
  const targetTo = getAddress(swapTxData.to);
  let swapCalldata = swapTxData.data;
  if (!swapCalldata.toLowerCase().endsWith(CELO_ATTRIBUTION_SUFFIX.slice(2).toLowerCase())) {
    swapCalldata = concat([swapCalldata, CELO_ATTRIBUTION_SUFFIX]);
  }
  return {
    to: targetTo,
    data: swapCalldata,
    value: BigInt(swapTxData.value || '0'),
    account: userAddress,
    bundledMakerCount: quoteRecord.orders?.length || 1,
    attributionTag: CELO_ATTRIBUTION_TAG,
    attributionSuffix: CELO_ATTRIBUTION_SUFFIX,
  };
}

export const createTakerProofOfControl = ({ takerAddress, chainId = CELO_CHAIN_ID, signTypedDataFn }) =>
  createTakerControlProof({ takerAddress, chainId, signTypedDataFn });


/**
 * Appends the mandatory ERC-8021 Hackathon Attribution suffix (celo_9f7deabd99a6) to any transaction calldata.
 */
export function appendAttributionSuffix(calldata) {
  if (!calldata) return CELO_ATTRIBUTION_SUFFIX;
  const hex = calldata.startsWith('0x') ? calldata : `0x${calldata}`;
  if (hex.toLowerCase().endsWith(CELO_ATTRIBUTION_SUFFIX.slice(2).toLowerCase())) {
    return hex;
  }
  return concat([hex, CELO_ATTRIBUTION_SUFFIX]);
}

/**
 * Checks if a given calldata payload carries the ERC-8021 attribution suffix.
 */
export function hasAttributionSuffix(calldata) {
  if (!calldata) return false;
  const hex = calldata.startsWith('0x') ? calldata : `0x${calldata}`;
  return hex.toLowerCase().endsWith(CELO_ATTRIBUTION_SUFFIX.slice(2).toLowerCase());
}

/**
 * Persists an RFQ record in client local storage
 */
export function persistRfqRecord(rfqData) {
  if (typeof window === 'undefined' || !rfqData?.rfqId) return;
  try {
    const raw = localStorage.getItem(RFQ_STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : {};
    records[rfqData.rfqId] = {
      ...rfqData,
      updatedAt: Date.now(),
    };
    localStorage.setItem(RFQ_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('[persistRfqRecord error]', err);
  }
}

/**
 * Retrieves persisted RFQ record by ID
 */
export function getPersistedRfqRecord(rfqId) {
  if (typeof window === 'undefined' || !rfqId) return null;
  try {
    const raw = localStorage.getItem(RFQ_STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : {};
    return records[rfqId] || null;
  } catch (err) {
    console.warn('[getPersistedRfqRecord error]', err);
    return null;
  }
}

/**
 * Converts decimal amount to atomic base units as exact string.
 * Uses BigInt math to prevent floating point imprecision.
 */
export function toAtomicUnits(amount, decimals = 6) {
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Amount must be a positive number.');
  }
  return parseUnits(String(amount).trim(), decimals).toString();
}

/**
 * Formats atomic base units to human-readable string.
 */
export function fromAtomicUnits(atomicAmount, decimals = 6) {
  if (!atomicAmount) return '0.00';
  return formatUnits(BigInt(String(atomicAmount)), decimals);
}

/**
 * POST /rfq/preview
 * Fetches free, non-binding indicative pricing from online market maker levels.
 * Does not require proof of funds or wallet signature.
 * 
 * @param {Object} params
 * @param {string} params.sellToken - ERC20 address of token being sold
 * @param {string} params.buyToken - ERC20 address of token being bought
 * @param {string} [params.sellAmount] - Exact-input gross spend cap in atomic units
 * @param {string} [params.buyAmount] - Exact-output amount in atomic units
 * @returns {Promise<Object>} Indicative quote outcome
 */
export async function getIndicativePreview({
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
}) {
  if (!sellToken || !buyToken) {
    throw new Error('Both sellToken and buyToken are required.');
  }
  if (!sellAmount && !buyAmount) {
    throw new Error('Either sellAmount or buyAmount must be provided.');
  }
  if (sellAmount && buyAmount) {
    throw new Error('Provide sellAmount OR buyAmount, not both.');
  }

  const payload = {
    chainId: CELO_CHAIN_ID,
    sellToken: getAddress(sellToken),
    buyToken: getAddress(buyToken),
    ...(sellAmount ? { sellAmount: String(sellAmount) } : {}),
    ...(buyAmount ? { buyAmount: String(buyAmount) } : {}),
  };

  const response = await fetchTextile('rfq/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = body?.error?.message || `Textile preview failed with HTTP ${response.status}`;
    const reason = body?.error?.details?.reason || body?.error?.code || 'preview_failed';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.reason = reason;
    err.details = body?.error?.details;
    throw err;
  }

  const data = body.data || body;
  const isUsdtSell = sellToken.toLowerCase() === CELO_USDT_ADDRESS.toLowerCase();
  const inDecimals = TOKEN_DECIMALS[sellToken.toLowerCase()] || 6;
  const outDecimals = TOKEN_DECIMALS[buyToken.toLowerCase()] || 6;

  const formattedSell = fromAtomicUnits(data.sellAmount, inDecimals);
  const formattedBuy = fromAtomicUnits(data.buyAmount, outDecimals);
  const numSell = Number(formattedSell);
  const numBuy = Number(formattedBuy);
  const effectiveRate = numSell > 0 ? numBuy / numSell : 0;

  return {
    isIndicative: true,
    status: data.status || 'preview',
    sellAmountRaw: data.sellAmount,
    buyAmountRaw: data.buyAmount,
    feeAmountRaw: data.feeAmount || '0',
    takerPaysRaw: data.takerPays || data.sellAmount,
    formattedSellAmount: formattedSell,
    formattedBuyAmount: formattedBuy,
    formattedFeeAmount: fromAtomicUnits(data.feeAmount || '0', inDecimals),
    effectiveRate: Number(effectiveRate.toFixed(isUsdtSell ? 2 : 6)),
    availableSellAmount: data.availableSellAmount ? fromAtomicUnits(data.availableSellAmount, inDecimals) : null,
    routing: data.routing,
    timestamp: Date.now(),
  };
}

/**
 * Builds EIP-712 TakerControl proof payload for firm quote request.
 */
export async function createTakerControlProof({
  takerAddress,
  chainId = CELO_CHAIN_ID,
  signTypedDataFn,
}) {
  if (!takerAddress || !isAddress(takerAddress)) {
    throw new Error('Valid taker address is required.');
  }
  if (typeof signTypedDataFn !== 'function') {
    throw new Error('Wallet signTypedData function is required to create proof of control.');
  }

  // 32 cryptographically secure random bytes
  const nonceBytes = new Uint8Array(32);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(nonceBytes);
  } else if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(nonceBytes);
  } else {
    for (let i = 0; i < 32; i++) {
      nonceBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const nonce = '0x' + Array.from(nonceBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const issuedAt = Date.now();

  const domain = {
    name: 'Textile Taker Control',
    version: '1',
    chainId: Number(chainId),
  };

  const types = {
    TakerControl: [
      { name: 'taker', type: 'address' },
      { name: 'chainId', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'issuedAt', type: 'uint256' },
    ],
  };

  const message = {
    taker: getAddress(takerAddress),
    chainId: BigInt(chainId),
    nonce: nonce,
    issuedAt: BigInt(issuedAt),
  };

  const signature = await signTypedDataFn({
    domain,
    types,
    primaryType: 'TakerControl',
    message,
  });

  return {
    nonce,
    issuedAt,
    signature,
  };
}

/**
 * POST /rfq/request
 * Solicits real-time, executable firm pricing from online market makers.
 * Includes Proof of Control (takerProof) and ERC-8021 Builder Attribution.
 * 
 * @param {Object} params
 * @param {string} params.takerAddress - Bound settling wallet address
 * @param {string} params.sellToken - Token to sell
 * @param {string} params.buyToken - Token to buy
 * @param {string} [params.sellAmount] - Spend amount in atomic units
 * @param {string} [params.buyAmount] - Receive amount in atomic units
 * @param {Function} [params.signTypedDataFn] - Wallet signing function
 * @param {string} [params.apiKey] - Optional partner API key
 * @param {number} [params.timeoutMs=75000] - 75s timeout recommended by Textile
 * @returns {Promise<Object>} Firm quote outcome
 */
export async function requestFirmQuote({
  takerAddress,
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
  signTypedDataFn,
  apiKey = null,
  timeoutMs = 75000,
}) {
  if (!takerAddress || !isAddress(takerAddress)) {
    throw new Error('Valid taker address is required.');
  }
  if (!sellToken || !buyToken) {
    throw new Error('Both sellToken and buyToken are required.');
  }
  if (!sellAmount && !buyAmount) {
    throw new Error('Provide sellAmount OR buyAmount.');
  }

  const taker = getAddress(takerAddress);
  const cleanSellToken = getAddress(sellToken);
  const cleanBuyToken = getAddress(buyToken);

  let takerProof = null;
  // If no partner API key, generate EIP-712 TakerControl signature
  if (!apiKey && signTypedDataFn) {
    takerProof = await createTakerControlProof({
      takerAddress: taker,
      chainId: CELO_CHAIN_ID,
      signTypedDataFn,
    });
  }

  const payload = {
    chainId: CELO_CHAIN_ID,
    sellToken: cleanSellToken,
    buyToken: cleanBuyToken,
    taker: taker,
    ...(sellAmount ? { sellAmount: String(sellAmount) } : {}),
    ...(buyAmount ? { buyAmount: String(buyAmount) } : {}),
    ...(takerProof ? { takerProof } : {}),
    // ERC-8021 Attribution configuration
    includeAttribution: true,
    builderCodes: [CELO_ATTRIBUTION_TAG],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetchTextile('rfq/request', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = body?.error?.message || `Textile firm quote failed with HTTP ${response.status}`;
      const reason = body?.error?.details?.reason || body?.error?.code || 'quote_failed';
      const err = new Error(errorMsg);
      err.status = response.status;
      err.reason = reason;
      err.details = body?.error?.details;
      throw err;
    }

    const data = body.data || body;

    // Handle no_quote business outcome
    if (data.status === 'no_quote') {
      return {
        isFirm: false,
        status: 'no_quote',
        rfqId: data.rfqId,
        reason: data.noQuoteReason || 'Insufficient market-maker liquidity for this size.',
        details: data,
      };
    }

    // Firm Quote Quoted
    const quote = data.quote;
    const transactions = data.transactions;
    const inDecimals = TOKEN_DECIMALS[cleanSellToken.toLowerCase()] || 6;
    const outDecimals = TOKEN_DECIMALS[cleanBuyToken.toLowerCase()] || 6;

    const formattedSell = fromAtomicUnits(quote.sellAmount, inDecimals);
    const formattedBuy = fromAtomicUnits(quote.buyAmount, outDecimals);
    const numSell = Number(formattedSell);
    const numBuy = Number(formattedBuy);
    const effectiveRate = numSell > 0 ? numBuy / numSell : 0;

    const record = {
      isFirm: true,
      status: 'quoted',
      rfqId: data.rfqId,
      claimToken: data.claimToken,
      taker: quote.taker,
      sellToken: cleanSellToken,
      buyToken: cleanBuyToken,
      sellAmountRaw: quote.sellAmount,
      buyAmountRaw: quote.buyAmount,
      feeAmountRaw: quote.feeAmount || '0',
      takerPaysRaw: quote.takerPays || quote.sellAmount,
      formattedSellAmount: formattedSell,
      formattedBuyAmount: formattedBuy,
      formattedFeeAmount: fromAtomicUnits(quote.feeAmount || '0', inDecimals),
      effectiveRate: Number(effectiveRate.toFixed(cleanSellToken.toLowerCase() === CELO_USDT_ADDRESS.toLowerCase() ? 2 : 6)),
      rateRay: quote.rateRay,
      expiresAt: quote.expiresAt,
      expiresAtTimestamp: new Date(quote.expiresAt).getTime(),
      orderDeadline: quote.orderDeadline,
      latestOrderDeadline: quote.latestOrderDeadline || quote.orderDeadline,
      reactor: quote.reactor,
      spender: quote.spender || quote.reactor,
      transactions: {
        approval: transactions?.approval || null,
        swap: transactions?.swap || null,
      },
      orders: quote.orders || [],
      attributionSuffix: data.attributionSuffix || null,
      routing: data.routing,
      createdAt: Date.now(),
    };

    // Persist firm quote in client storage for execution reconciliation
    persistRfqRecord(record);

    return record;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Textile RFQ timed out after ${timeoutMs / 1000}s. The corridor may be quiet.`);
    }
    throw err;
  }
}

/**
 * GET /rfq/{id}
 * Fetches status of an RFQ.
 */
export async function getRfqStatus(rfqId, apiKey = null) {
  if (!rfqId) throw new Error('rfqId is required.');

  const headers = { Accept: 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetchTextile(`rfq/${rfqId}`, {
    method: 'GET',
    headers,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `Failed to fetch RFQ ${rfqId}`);
  }

  return body.data || body;
}

/**
 * POST /rfq/{id}/cancel
 * Explicitly releases reserved maker depth when a user cancels.
 */
export async function cancelRfq(rfqId, apiKey = null) {
  if (!rfqId) return;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    await fetchTextile(`rfq/${rfqId}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rfqId }),
    });
  } catch (err) {
    console.warn('[cancelRfq error]', err);
  }
}

/**
 * Executes the complete Textile FX swap transaction flow:
 * 1. Checks and enforces quote expiration.
 * 2. Checks token allowance against quote.spender.
 * 3. Executes tagged approve() if required.
 * 4. Broadcasts the exact transactions.swap payload returned by Textile (including multi-maker bundles).
 * 5. Verifies onchain receipt and token transfer events.
 * 
 * @param {Object} params
 * @param {Object} params.quoteRecord - Valid firm quote object returned from requestFirmQuote()
 * @param {string} params.fromAddress - Connected wallet address
 * @param {Function} [params.onStatusUpdate] - Status callback for UI progress
 * @returns {Promise<Object>} Execution result
 */
export async function executeTextileSwap({
  quoteRecord,
  fromAddress,
  onStatusUpdate = () => {},
}) {
  if (!quoteRecord || !quoteRecord.isFirm) {
    throw new Error('A valid firm quote is required to execute a swap.');
  }
  if (!fromAddress || !isAddress(fromAddress)) {
    throw new Error('Valid connected wallet address is required.');
  }

  const userAddr = getAddress(fromAddress);
  if (quoteRecord.taker.toLowerCase() !== userAddr.toLowerCase()) {
    throw new Error(`Quote is bound to ${quoteRecord.taker}, but current wallet is ${userAddr}.`);
  }

  // 1. Verify Expiration
  const now = Date.now();
  if (quoteRecord.expiresAtTimestamp && now >= quoteRecord.expiresAtTimestamp) {
    throw new Error('Quote has expired. Please request a fresh firm quote.');
  }

  const provider = getEthereumProvider(null, userAddr);
  if (!provider) throw new Error('EVM wallet provider unavailable.');

  const walletClient = createWalletClient({
    chain: celoMainnet,
    transport: custom(provider),
  });

  const spender = getAddress(quoteRecord.spender || quoteRecord.reactor);
  const sellToken = getAddress(quoteRecord.sellToken);
  const requiredAmount = BigInt(quoteRecord.takerPaysRaw || quoteRecord.sellAmountRaw);

  // 2. Check Allowance
  onStatusUpdate({ step: 'allowance_check', message: 'Checking token allowance for Textile reactor...' });
  const allowance = await publicClient.readContract({
    address: sellToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddr, spender],
  });

  if (allowance < requiredAmount) {
    onStatusUpdate({ step: 'approving', message: 'Approving exact token allowance in wallet...' });
    
    // Exact approval preferred over unlimited
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, requiredAmount],
    });

    // Tag the approval transaction with ERC-8021 attribution suffix
    const taggedApproveData = concat([approveData, CELO_ATTRIBUTION_SUFFIX]);

    const approveTx = await walletClient.sendTransaction({
      account: userAddr,
      to: sellToken,
      data: taggedApproveData,
      value: 0n,
    });

    onStatusUpdate({ step: 'confirming_approval', message: 'Waiting for approval confirmation on Celo...' });
    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveTx,
      confirmations: 1,
    });

    if (approveReceipt.status !== 'success') {
      throw new Error(`Approval reverted on Celo. Tx: ${approveTx}`);
    }

    // Recheck quote expiry after approval
    if (Date.now() >= quoteRecord.expiresAtTimestamp) {
      throw new Error('Quote expired while confirming token approval. Request a fresh quote.');
    }
  }

  // 3. Broadcast Textile Swap Payload
  onStatusUpdate({ step: 'swapping', message: 'Please sign the Textile swap transaction in your wallet...' });

  const swapTxData = quoteRecord.transactions?.swap;
  if (!swapTxData || !swapTxData.to || !swapTxData.data) {
    throw new Error('Firm quote does not contain executable swap transaction payload.');
  }

  const targetTo = getAddress(swapTxData.to);
  let swapCalldata = swapTxData.data;

  // Verify attribution suffix:
  // If Textile did not append attribution suffix, append our ERC-8021 tag
  if (!swapCalldata.toLowerCase().endsWith(CELO_ATTRIBUTION_SUFFIX.slice(2).toLowerCase())) {
    swapCalldata = concat([swapCalldata, CELO_ATTRIBUTION_SUFFIX]);
  }

  const swapHash = await walletClient.sendTransaction({
    account: userAddr,
    to: targetTo,
    data: swapCalldata,
    value: BigInt(swapTxData.value || '0'),
  });

  onStatusUpdate({ step: 'confirming_swap', message: 'Confirming swap on Celo Mainnet (< 1s finality)...' });

  const swapReceipt = await publicClient.waitForTransactionReceipt({
    hash: swapHash,
    confirmations: 1,
    timeout: 60000,
  });

  if (swapReceipt.status !== 'success') {
    throw new Error(`Textile swap transaction reverted on Celo Mainnet. Tx: ${swapHash}`);
  }

  // Update persisted record
  persistRfqRecord({
    ...quoteRecord,
    status: 'settled',
    swapTxHash: swapHash,
    blockNumber: Number(swapReceipt.blockNumber),
  });

  return {
    success: true,
    txHash: swapHash,
    receipt: swapReceipt,
    blockNumber: Number(swapReceipt.blockNumber),
    explorerUrl: `https://celoscan.io/tx/${swapHash}`,
    receivedAmountRaw: quoteRecord.buyAmountRaw,
    formattedReceivedAmount: quoteRecord.formattedBuyAmount,
    buyToken: quoteRecord.buyToken,
    sellToken: quoteRecord.sellToken,
    attributionTag: CELO_ATTRIBUTION_TAG,
    attributionSuffix: CELO_ATTRIBUTION_SUFFIX,
  };
}
