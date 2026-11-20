export { activeArcChain };

export async function estimateTransferFee() {
  return "0.0001 CELO";
}

let activeWalletProvider = null;

export function setActiveWalletProvider(provider) {
  activeWalletProvider = provider || null;
}

/**
 * @file arcPayment.js
 * @description Celo Mainnet Payment & Attribution Service using Viem.
 * Handles:
 * - Celo Mainnet (42220) network detection and auto-switching
 * - Native CELO and cNGN balance reading
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
  activeArcChain,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
  ARC_ERC8004_IDENTITY_REGISTRY,
  ERC8004_IDENTITY_ABI,
  CELO_CNGN_ADDRESS,
  CELO_USDT_ADDRESS,
  ERC20_ABI,
} from '../config/arc.js';

export const publicClient = createPublicClient({
  chain: celoMainnet,
  transport: http('https://forno.celo.org'),
});

export function getEthereumProvider(preferredType) {
  if (typeof window === 'undefined') return null;
  if (activeWalletProvider) return activeWalletProvider;

  if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
    if (preferredType === 'MetaMask') {
      const mm = window.ethereum.providers.find((p) => p.isMetaMask && !p.isRabby);
      if (mm) return mm;
    }
    if (preferredType === 'Rabby') {
      const rabby = window.ethereum.providers.find((p) => p.isRabby);
      if (rabby) return rabby;
    }
    return window.ethereum.providers[0];
  }

  return window.ethereum || null;
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
    isArc: currentChainId === celoMainnet.id,
  };
}

export async function switchOrAddArcNetwork() {
  const provider = getEthereumProvider();
  if (!provider) throw new Error('No EVM wallet found');

  const chainIdHex = `0x${celoMainnet.id.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
    return true;
  } catch (switchError) {
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: 'Celo Mainnet',
            nativeCurrency: {
              name: 'CELO',
              symbol: 'CELO',
              decimals: 18,
            },
            rpcUrls: ['https://forno.celo.org'],
            blockExplorerUrls: ['https://celoscan.io'],
          },
        ],
      });
      return true;
    }
    throw switchError;
  }
}

/**
 * Reads real onchain CELO balance for a wallet address on Celo Mainnet.
 */
export async function getUsdcBalance(walletAddress) {
  if (!walletAddress || !isAddress(walletAddress)) {
    return { formatted: '0.00', raw: 0n, symbol: 'CELO' };
  }

  try {
    const rawBalance = await publicClient.getBalance({
      address: getAddress(walletAddress),
    });

    const formatted = formatUnits(rawBalance, 18);
    return {
      formatted: Number(formatted).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }),
      rawString: formatted,
      raw: rawBalance,
      symbol: 'CELO',
    };
  } catch (err) {
    console.error('[getBalance error]', err);
    return { formatted: '0.00', raw: 0n, symbol: 'CELO' };
  }
}

/**
 * Executes a tagged on-chain payment on Celo Mainnet with ERC-8021 attribution (celo_9f7deabd99a6).
 */
export async function sendUsdcOnArc({
  fromAddress,
  toAddress,
  tagOrAddress,
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

  const cleanAmount = String(amountUsdc).trim();
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

/**
 * 1-Click Tagged ERC-8004 Identity Registration on Celo Mainnet.
 * Emits the attribution tag (celo_9f7deabd99a6) AND mints the ERC-8004 identity in a single transaction.
 */
export async function registerTaggedErc8004Identity({ fromAddress, onStatusUpdate = () => {} }) {
  if (!fromAddress || !isAddress(fromAddress)) {
    throw new Error('Valid agent wallet must be connected.');
  }

  const provider = getEthereumProvider();
  if (!provider) throw new Error('EVM wallet provider unavailable.');

  const currentChainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
  if (currentChainId !== celoMainnet.id) {
    await switchOrAddArcNetwork();
  }

  const walletClient = createWalletClient({
    chain: celoMainnet,
    transport: custom(provider),
  });

  const agentURI = 'https://celo.nairatag.ng/.well-known/agent-card.json';
  const baseCalldata = encodeFunctionData({
    abi: ERC8004_IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  // Append attribution tag suffix (ERC-8021)
  const taggedCalldata = concat([baseCalldata, CELO_ATTRIBUTION_SUFFIX]);

  onStatusUpdate({ step: 'transacting', message: 'Sign ERC-8004 registration in your wallet...' });

  const hash = await walletClient.sendTransaction({
    account: getAddress(fromAddress),
    to: ARC_ERC8004_IDENTITY_REGISTRY,
    value: 0n,
    data: taggedCalldata,
  });

  onStatusUpdate({ step: 'confirming', message: 'Waiting for Celo block confirmation...' });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 35000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`ERC-8004 Registration reverted. Hash: ${hash}`);
  }

  return {
    txHash: hash,
    receipt,
    explorerUrl: `https://celoscan.io/tx/${hash}`,
    agentURI,
    tag: CELO_ATTRIBUTION_TAG,
  };
}
