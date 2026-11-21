/**
 * @file corridorService.js
 * @description Unified Celo Mainnet Corridor Service (USD₮ ⇄ cNGN).
 * Bridges UI components to Textile FX v2 RFQ Engine & Onchain Fallbacks.
 */

import {
  formatUnits,
  isAddress,
  getAddress,
} from 'viem';
import {
  CELO_CNGN_ADDRESS,
  CELO_USDT_ADDRESS,
  ERC20_ABI,
} from '../config/celo.js';
import { publicClient } from './celoPayment.js';
import {
  getIndicativePreview,
  requestFirmQuote,
  executeTextileSwap,
  toAtomicUnits,
  fromAtomicUnits,
} from './textileRfqService.js';
import {
  prepareCorridorPayment,
  executeCorridorPayment,
  transferCngnToRecipient,
  getPersistedPaymentReceipts,
} from './corridorPaymentFlow.js';

export {
  getIndicativePreview,
  requestFirmQuote,
  executeTextileSwap,
  prepareCorridorPayment,
  executeCorridorPayment,
  transferCngnToRecipient,
  getPersistedPaymentReceipts,
  toAtomicUnits,
  fromAtomicUnits,
};

export const CELO_CORRIDOR_POOL = '0x6519d56Eb0A69FC0338657784c783B169b8f7d32';

/**
 * Reads live exchange rate from Textile FX API v2 RFQ engine.
 * Falls back to on-chain pool slot0 if external network is unavailable.
 */
export async function getLiveCorridorRate() {
  try {
    // 1. Try Textile FX v2 RFQ preview for 1 USD₮
    const preview = await getIndicativePreview({
      sellToken: CELO_USDT_ADDRESS,
      buyToken: CELO_CNGN_ADDRESS,
      sellAmount: '1000000', // 1 USD₮
    });

    const rateUsdtToCngn = Number(preview.formattedBuyAmount);
    const rateCngnToUsdt = rateUsdtToCngn > 0 ? Number((1 / rateUsdtToCngn).toFixed(6)) : 0;

    return {
      rateUsdtToCngn,
      rateCngnToUsdt,
      source: 'Textile FX v2 RFQ',
      availableLiquidityUsdt: preview.availableSellAmount,
      feeAmountCngn: preview.formattedFeeAmount,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.warn('[Textile RFQ rate fetch failed, reading onchain pool]', err.message);

    // 2. Onchain Fallback: Uniswap V3 Pool slot0
    try {
      const slot0 = await publicClient.readContract({
        address: CELO_CORRIDOR_POOL,
        abi: [
          {
            inputs: [],
            name: 'slot0',
            outputs: [
              { internalType: 'uint160', name: 'sqrtPriceX96', type: 'uint160' },
              { internalType: 'int24', name: 'tick', type: 'int24' },
              { internalType: 'uint16', name: 'observationIndex', type: 'uint16' },
              { internalType: 'uint16', name: 'observationCardinality', type: 'uint16' },
              { internalType: 'uint16', name: 'observationCardinalityNext', type: 'uint16' },
              { internalType: 'uint8', name: 'feeProtocol', type: 'uint8' },
              { internalType: 'bool', name: 'unlocked', type: 'bool' },
            ],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'slot0',
      });

      const sqrtPriceX96 = BigInt(slot0[0]);
      const Q96 = 2n ** 96n;
      const priceScaled = Number((sqrtPriceX96 * 1000000n) / Q96) / 1000000;
      const rateUsdtToCngn = Number((priceScaled ** 2).toFixed(2));
      const rateCngnToUsdt = rateUsdtToCngn > 0 ? Number((1 / rateUsdtToCngn).toFixed(6)) : 0;

      return {
        rateUsdtToCngn,
        rateCngnToUsdt,
        source: 'Celo Mainnet Pool (0x6519...7d32)',
        timestamp: Date.now(),
      };
    } catch {
      return {
        rateUsdtToCngn: 1445.50,
        rateCngnToUsdt: 0.000692,
        source: 'Anchor Fallback',
        timestamp: Date.now(),
      };
    }
  }
}

/**
 * Reads wallet balances for USD₮, cNGN, and native CELO
 */
export async function getCorridorBalances(walletAddress) {
  if (!walletAddress || !isAddress(walletAddress)) {
    return { usdt: '0.00', cngn: '0.00', celo: '0.00', rawUsdt: 0n, rawCngn: 0n };
  }

  const addr = getAddress(walletAddress);

  try {
    const [usdtRaw, cngnRaw, celoRaw] = await Promise.all([
      publicClient.readContract({
        address: CELO_USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [addr],
      }),
      publicClient.readContract({
        address: CELO_CNGN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [addr],
      }),
      publicClient.getBalance({ address: addr }),
    ]);

    return {
      usdt: Number(formatUnits(usdtRaw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
      cngn: Number(formatUnits(cngnRaw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      celo: Number(formatUnits(celoRaw, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
      rawUsdt: usdtRaw,
      rawCngn: cngnRaw,
      rawCelo: celoRaw,
    };
  } catch (err) {
    console.warn('Failed reading corridor balances:', err);
    return { usdt: '0.00', cngn: '0.00', celo: '0.00', rawUsdt: 0n, rawCngn: 0n };
  }
}

/**
 * High-level swap executor calling Textile FX v2
 */
export async function executeCorridorSwap({
  fromAddress,
  direction = 'USDT_TO_CNGN',
  amountIn,
  firmQuoteRecord = null,
  onStatusUpdate = () => {},
}) {
  if (firmQuoteRecord) {
    return executeTextileSwap({
      quoteRecord: firmQuoteRecord,
      fromAddress,
      onStatusUpdate,
    });
  }

  throw new Error('Firm quote from Textile FX v2 is required before execution.');
}
