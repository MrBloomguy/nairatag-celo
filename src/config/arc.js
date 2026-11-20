/**
 * @file arc.js
 * @description Official Celo Mainnet chain configuration, ERC-8004 registries, and attribution parameters.
 */

import { defineChain } from 'viem';

/**
 * Celo Mainnet (Chain ID 42220 / 0xA4EC)
 */
export const celoMainnet = defineChain({
  id: 42220,
  name: 'Celo Mainnet',
  network: 'celo',
  nativeCurrency: {
    name: 'CELO',
    symbol: 'CELO',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://forno.celo.org', 'https://celo-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
    },
    public: {
      http: ['https://forno.celo.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'CeloScan',
      url: 'https://celoscan.io',
    },
  },
  testnet: false,
});

export const arcTestnet = celoMainnet;
export const arcMainnet = celoMainnet;
export const activeArcChain = celoMainnet;

/**
 * Celo Hackathon Attribution Tag (ERC-8021)
 * Entry: celo_9f7deabd99a6
 */
export const CELO_ATTRIBUTION_TAG = 'celo_9f7deabd99a6';
export const CELO_ATTRIBUTION_SUFFIX = '0x63656c6f5f396637646561626439396136110080218021802180218021802180218021';
export const OFFICIAL_AGENT_WALLET = '0xc519729BF6D15e5984702BBa2C553f1c74A73C95';

/**
 * Official ERC-8004 Agentic Economy Registries on Celo Mainnet (42220)
 */
export const ARC_ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
export const ARC_ERC8004_REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
export const ARC_ERC8004_VALIDATION_REGISTRY = '0x8004Cb1BF31DAf7788923b405b754f57acEB4272';

/**
 * Celo Mainnet Stablecoins & Tokens
 */
export const CELO_CNGN_ADDRESS = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
export const CELO_USDT_ADDRESS = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';
export const CELO_CUSD_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
export const TEXTILE_FX_ROUTER = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3';

// Backwards compatibility aliases
export const ARC_USDC_ADDRESS = CELO_CNGN_ADDRESS;
export const ARC_USDC_DECIMALS = 18;
export const ARC_EURC_ADDRESS = CELO_CUSD_ADDRESS;
export const ARC_CIRBTC_ADDRESS = CELO_USDT_ADDRESS;

/**
 * Deployed Canonical NairaTag Contracts on Celo
 */
export const ARC_NAIRATAG_REGISTRY_ADDRESS = '0xb34518cC33314ee63841120bDd3Baa3BD1baf9e0';
export const ARC_NAIRATAG_RESOLVER_ADDRESS = '0x293EA56588b8abac78Bab6241466ad8C30bB955A';
export const ARC_NAIRATAG_ESCROW_ADDRESS = '0xb9a0250a6C0908fA01574a5416321096279c4d53';
export const ARC_MEMO_ADDRESS = '0xb9a0250a6C0908fA01574a5416321096279c4d53';

export const ARC_MAINNET_CONFIG = {
  chainId: 42220,
  name: 'Celo Mainnet',
  rpcUrl: 'https://forno.celo.org',
  explorerUrl: 'https://celoscan.io',
  contracts: {
    cngn: CELO_CNGN_ADDRESS,
    usdt: CELO_USDT_ADDRESS,
    cusd: CELO_CUSD_ADDRESS,
    nairatagRegistry: ARC_NAIRATAG_REGISTRY_ADDRESS,
    nairatagResolver: ARC_NAIRATAG_RESOLVER_ADDRESS,
    escrow: ARC_NAIRATAG_ESCROW_ADDRESS,
    erc8004Identity: ARC_ERC8004_IDENTITY_REGISTRY,
    erc8004Reputation: ARC_ERC8004_REPUTATION_REGISTRY,
  },
};
export const ARC_TESTNET_CONFIG = ARC_MAINNET_CONFIG;

/**
 * Minimal ERC-20 ABI
 */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
];

/**
 * ERC-8004 Identity Registry ABI
 */
export const ERC8004_IDENTITY_ABI = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'setAgentURI',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newAgentURI', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setAgentWallet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'agentWallet', type: 'address' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Transfer',
    anonymous: false,
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
];

export const ERC8004_REPUTATION_ABI = [
  {
    type: 'function',
    name: 'giveFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'score', type: 'int128' },
      { name: 'feedbackType', type: 'uint8' },
      { name: 'tag', type: 'string' },
      { name: 'metadataURI', type: 'string' },
      { name: 'evidenceURI', type: 'string' },
      { name: 'comment', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
];

export const ERC8004_VALIDATION_ABI = [];
export const ARC_MEMO_ABI = [];
