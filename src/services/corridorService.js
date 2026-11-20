import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  formatUnits,
  isAddress,
  getAddress,
  encodeFunctionData,
  concat,
} from 'viem';
import {
  celoMainnet,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
  CELO_CNGN_ADDRESS,
  CELO_USDT_ADDRESS,
  TEXTILE_FX_ROUTER,
  ERC20_ABI,
} from '../config/arc.js';
import { getEthereumProvider, publicClient } from './arcPayment.js';

export const CELO_CORRIDOR_POOL = '0x6519d56Eb0A69FC0338657784c783B169b8f7d32';
export const CELO_SWAP_ROUTER = '0x5615CDAb10dc425a742d643d949a7F474C01abc4';

export const POOL_ABI = [
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
];

export const SWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IV3SwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
];

/**
 * Reads live onchain exchange rate from Celo Mainnet pool (0x6519...7d32)
 * Returns { rateUsdtToCngn, rateCngnToUsdt }
 */
export async function getLiveCorridorRate() {
  try {
    const slot0 = await publicClient.readContract({
      address: CELO_CORRIDOR_POOL,
      abi: POOL_ABI,
      functionName: 'slot0',
    });

    const sqrtPriceX96 = BigInt(slot0[0]);
    const Q96 = 2n ** 96n;
    const priceScaled = Number((sqrtPriceX96 * 1000000n) / Q96) / 1000000;
    const rateUsdtToCngn = priceScaled ** 2;
    const rateCngnToUsdt = rateUsdtToCngn > 0 ? 1 / rateUsdtToCngn : 0;

    return {
      rateUsdtToCngn: Number(rateUsdtToCngn.toFixed(2)),
      rateCngnToUsdt: Number(rateCngnToUsdt.toFixed(6)),
      poolAddress: CELO_CORRIDOR_POOL,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.warn('Fallback corridor rate:', err);
    return {
      rateUsdtToCngn: 1438.99,
      rateCngnToUsdt: 0.000695,
      poolAddress: CELO_CORRIDOR_POOL,
      timestamp: Date.now(),
    };
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
 * Executes a Corridor Swap (USD₮ ⇄ cNGN) with mandatory ERC-8021 attribution suffix.
 * direction: 'USDT_TO_CNGN' | 'CNGN_TO_USDT'
 */
export async function executeCorridorSwap({
  fromAddress,
  direction = 'USDT_TO_CNGN',
  amountIn,
  onStatusUpdate = () => {},
}) {
  if (!fromAddress || !isAddress(fromAddress)) {
    throw new Error('Valid wallet must be connected.');
  }

  const cleanAmount = String(amountIn).trim();
  if (!cleanAmount || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
    throw new Error('Please enter a valid amount greater than 0.');
  }

  const parsedAmountIn = parseUnits(cleanAmount, 6);
  const isUsdtToCngn = direction === 'USDT_TO_CNGN';
  const tokenIn = isUsdtToCngn ? CELO_USDT_ADDRESS : CELO_CNGN_ADDRESS;
  const tokenOut = isUsdtToCngn ? CELO_CNGN_ADDRESS : CELO_USDT_ADDRESS;

  const provider = getEthereumProvider();
  if (!provider) throw new Error('EVM wallet provider unavailable.');

  const walletClient = createWalletClient({
    chain: celoMainnet,
    transport: custom(provider),
  });

  const userAddr = getAddress(fromAddress);

  // 1. Check Allowance
  onStatusUpdate({ step: 'allowance', message: 'Checking corridor allowance...' });
  const currentAllowance = await publicClient.readContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddr, CELO_SWAP_ROUTER],
  });

  if (currentAllowance < parsedAmountIn) {
    onStatusUpdate({ step: 'approving', message: `Approving ${isUsdtToCngn ? 'USD₮' : 'cNGN'} for Swap Router...` });
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CELO_SWAP_ROUTER, 2n ** 256n - 1n],
    });

    const taggedApprove = concat([approveData, CELO_ATTRIBUTION_SUFFIX]);
    const approveHash = await walletClient.sendTransaction({
      account: userAddr,
      to: tokenIn,
      data: taggedApprove,
    });

    await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
  }

  // 2. Prepare exactInputSingle Swap
  onStatusUpdate({ step: 'swapping', message: 'Sign corridor swap in your wallet...' });

  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        fee: 100, // 0.01% fee tier
        recipient: userAddr,
        amountIn: parsedAmountIn,
        amountOutMinimum: 0n, // Can apply slippage calculation
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  // Append attribution tag (ERC-8021)
  const taggedSwapCalldata = concat([swapCalldata, CELO_ATTRIBUTION_SUFFIX]);

  const hash = await walletClient.sendTransaction({
    account: userAddr,
    to: CELO_SWAP_ROUTER,
    data: taggedSwapCalldata,
    value: 0n,
  });

  onStatusUpdate({ step: 'confirming', message: 'Confirming corridor swap on Celo Mainnet...' });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 45000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`Swap reverted. Hash: ${hash}`);
  }

  return {
    txHash: hash,
    receipt,
    explorerUrl: `https://celoscan.io/tx/${hash}`,
    direction,
    amountIn: cleanAmount,
    tokenInSymbol: isUsdtToCngn ? 'USD₮' : 'cNGN',
    tokenOutSymbol: isUsdtToCngn ? 'cNGN' : 'USD₮',
    attributionTag: CELO_ATTRIBUTION_TAG,
  };
}
