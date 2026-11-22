/**
 * @file celoPayment.js
 * @description Celo Mainnet Payment & Attribution Service using Viem.
 * Handles:
 * - Celo Mainnet (42220) network detection and auto-switching
 * - Native CELO and cNGN / USD₮ balance reading
 * - Automatic ERC-8021 Transaction Attribution tagging (celo_9f7deabd99a6)
 * - 1-Click Tagged ERC-8004 Identity Registration
 */

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
  activeCeloChain,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
  CELO_ERC8004_IDENTITY_REGISTRY,
  ERC8004_IDENTITY_ABI,
  CELO_CNGN_ADDRESS,
  CELO_USDT_ADDRESS,
  ERC20_ABI,
} from '../config/celo.js';

export { activeCeloChain, activeCeloChain as activeArcChain };

export async function estimateTransferFee() {
  return "0.0001 CELO";
}

let activeWalletProvider = null;

export function setActiveWalletProvider(provider) {
  activeWalletProvider = provider || null;
}

export const publicClient = createPublicClient({
  chain: celoMainnet,
  transport: http('https://forno.celo.org'),
});

/**
 * Safely binds the request method of an EVM provider to preserve `this` context
 * and avoid extension-level `onMessage` / Communicator runtime errors.
 */
function wrapSafeProvider(rawProvider) {
  if (!rawProvider) return null;
  try {
    if (typeof rawProvider.request === 'function') {
      const boundRequest = rawProvider.request.bind(rawProvider);
      return new Proxy(rawProvider, {
        get(target, prop, receiver) {
          if (prop === 'request') {
            return boundRequest;
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    }
  } catch (err) {
    console.warn('[wrapSafeProvider warning]', err);
  }
  return rawProvider;
}

export function getEthereumProvider(preferredType, accountAddress) {
  if (typeof window === 'undefined') return null;
  if (activeWalletProvider) return wrapSafeProvider(activeWalletProvider);

  // If window.ethereum exposes a providers array (multiple extensions installed)
  if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
    // 1. If preferred type is MetaMask
    if (preferredType === 'MetaMask') {
      const mm = window.ethereum.providers.find((p) => p.isMetaMask && !p.isCoinbaseWallet && !p.isRabby);
      if (mm) return wrapSafeProvider(mm);
    }
    // 2. If preferred type is Rabby
    if (preferredType === 'Rabby') {
      const rabby = window.ethereum.providers.find((p) => p.isRabby);
      if (rabby) return wrapSafeProvider(rabby);
    }
    // 3. Match by account address if provided
    if (accountAddress) {
      const matched = window.ethereum.providers.find((p) => {
        try {
          const sel = (p.selectedAddress || p.address || '').toLowerCase();
          return sel && sel === accountAddress.toLowerCase();
        } catch {
          return false;
        }
      });
      if (matched) return wrapSafeProvider(matched);
    }
    // 4. Look up in providerMap if available
    if (window.ethereum?.providerMap && typeof window.ethereum.providerMap.get === 'function') {
      const mappedMM = window.ethereum.providerMap.get('MetaMask');
      if (mappedMM) return wrapSafeProvider(mappedMM);
    }
    // 5. Prefer genuine MetaMask, Rabby, or Opera MiniPay over Coinbase Wallet to prevent onMessage popup errors
    const nonCoinbase = window.ethereum.providers.find(
      (p) => !p.isCoinbaseWallet && (p.isMetaMask || p.isRabby || p.isOpera)
    );
    if (nonCoinbase) return wrapSafeProvider(nonCoinbase);

    // Fallback to first non-coinbase provider if possible
    const anyNonCoinbase = window.ethereum.providers.find((p) => !p.isCoinbaseWallet);
    if (anyNonCoinbase) return wrapSafeProvider(anyNonCoinbase);

    return wrapSafeProvider(window.ethereum.providers[0]);
  }

  // Single provider fallback
  return wrapSafeProvider(window.ethereum || null);
}

export async function connectWallet(preferredType) {
  const provider = getEthereumProvider(preferredType);
  if (!provider) {
    throw new Error('No EVM wallet detected. Please install MetaMask, Rabby, or Opera MiniPay.');
  }

  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts authorized.');
  }

  const address = getAddress(accounts[0]);
  const chainIdHex = await provider.request({ method: 'eth_chainId' });
  const currentChainId = parseInt(chainIdHex, 16);

  return {
    address,
    chainId: currentChainId,
    isCelo: currentChainId === celoMainnet.id,
    isArc: currentChainId === celoMainnet.id,
  };
}

export async function switchOrAddCeloNetwork() {
  const provider = getEthereumProvider();
  if (!provider) throw new Error('No EVM wallet found');

  const chainIdHex = `0x${celoMainnet.id.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError) {
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: celoMainnet.name,
            nativeCurrency: celoMainnet.nativeCurrency,
            rpcUrls: celoMainnet.rpcUrls.default.http,
            blockExplorerUrls: [celoMainnet.blockExplorers.default.url],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}
export const switchOrAddArcNetwork = switchOrAddCeloNetwork;

export async function getCeloBalance(walletAddress) {
  if (!walletAddress || !isAddress(walletAddress)) {
    return { formatted: '0.00', raw: 0n, symbol: 'CELO' };
  }

  try {
    const raw = await publicClient.getBalance({
      address: getAddress(walletAddress),
    });

    return {
      formatted: Number(formatUnits(raw, 18)).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }),
      raw,
      rawString: raw.toString(),
      symbol: 'CELO',
    };
  } catch (err) {
    console.error('[getBalance error]', err);
    return { formatted: '0.00', raw: 0n, symbol: 'CELO' };
  }
}
export const getUsdcBalance = getCeloBalance;

/**
 * Executes a tagged on-chain payment on Celo Mainnet with ERC-8021 attribution (celo_9f7deabd99a6).
 */
export async function sendPaymentOnCelo({
  fromAddress,
  toAddress,
  tagOrAddress,
  amount,
  amountUsdc,
  memoText = '',
  memo,
  onStatusUpdate = () => {},
}) {
  const startTime = Date.now();
  if (!fromAddress || !isAddress(fromAddress)) {
    throw new Error('Valid sender wallet is not connected.');
  }

  let targetAddress = toAddress;
  if (!targetAddress && tagOrAddress) {
    if (isAddress(tagOrAddress)) {
      targetAddress = tagOrAddress;
    } else {
      const { resolveTag } = await import('./nairatagResolver.js');
      const resolved = await resolveTag(tagOrAddress);
      if (!resolved.success || !resolved.resolvedAddress) {
        throw new Error(resolved.error || `Could not resolve recipient tag ${tagOrAddress}`);
      }
      targetAddress = resolved.resolvedAddress;
    }
  }

  if (!targetAddress || !isAddress(targetAddress)) {
    throw new Error('Resolved recipient address is invalid.');
  }

  const cleanAmount = String(amount || amountUsdc).trim();
  if (!cleanAmount || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
    throw new Error('Please enter a valid amount greater than 0.');
  }

  const baseUnits = parseUnits(cleanAmount, 18);
  const provider = getEthereumProvider();
  if (!provider) throw new Error('EVM wallet provider unavailable.');

  const walletClient = createWalletClient({
    chain: celoMainnet,
    transport: custom(provider),
  });

  onStatusUpdate({ step: 'transacting', message: 'Sending tagged transaction on Celo Mainnet...' });

  // Native CELO transfer tagged with ERC-8021 attribution suffix
  const hash = await walletClient.sendTransaction({
    account: getAddress(fromAddress),
    to: getAddress(targetAddress),
    value: baseUnits,
    data: CELO_ATTRIBUTION_SUFFIX,
  });

  if (!hash || !hash.startsWith('0x')) {
    throw new Error('No transaction hash returned from wallet.');
  }

  onStatusUpdate({ step: 'confirming', message: 'Waiting for Celo confirmation...' });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 30000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted on Celo. Tx Hash: ${hash}`);
  }

  return {
    hash,
    txHash: hash,
    receipt,
    explorerUrl: `https://celoscan.io/tx/${hash}`,
    blockNumber: Number(receipt.blockNumber),
    from: fromAddress,
    to: targetAddress,
    recipientAddress: targetAddress,
    amount: cleanAmount,
    hasMemo: true,
    memoText: `Attribution Tag: ${CELO_ATTRIBUTION_TAG}`,
    executionTimeMs: Date.now() - startTime,
  };
}
export const sendUsdcOnArc = sendPaymentOnCelo;

/**
 * 1-Click Tagged ERC-8004 Identity Registration on Celo Mainnet.
 */
export async function registerCeloAgentIdentity({
  fromAddress,
  agentURI = 'https://celo.nairatag.ng/.well-known/agent-card.json',
  onStatusUpdate = () => {},
}) {
  if (!fromAddress || !isAddress(fromAddress)) {
    throw new Error('Valid wallet address is required.');
  }

  const provider = getEthereumProvider();
  if (!provider) throw new Error('EVM wallet provider unavailable.');

  const walletClient = createWalletClient({
    chain: celoMainnet,
    transport: custom(provider),
  });

  onStatusUpdate({ step: 'signing', message: 'Sign ERC-8004 registration on Celo Mainnet...' });

  const registerData = encodeFunctionData({
    abi: ERC8004_IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  const taggedRegisterData = concat([registerData, CELO_ATTRIBUTION_SUFFIX]);

  const hash = await walletClient.sendTransaction({
    account: getAddress(fromAddress),
    to: CELO_ERC8004_IDENTITY_REGISTRY,
    data: taggedRegisterData,
    value: 0n,
  });

  onStatusUpdate({ step: 'confirming', message: 'Confirming registration on Celo Mainnet...' });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 30000,
  });

  return {
    txHash: hash,
    receipt,
    explorerUrl: `https://celoscan.io/tx/${hash}`,
    blockNumber: Number(receipt.blockNumber),
    attributionTag: CELO_ATTRIBUTION_TAG,
  };
}
export const registerArcAgentIdentity = registerCeloAgentIdentity;
