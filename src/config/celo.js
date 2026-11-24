/**
 * @file celo.js
 * @description Official Celo Mainnet chain configuration, ERC-8004 registries, stablecoins, and attribution parameters.
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

export const activeCeloChain = celoMainnet;

/**
 * Celo Hackathon Attribution Tag (ERC-8021)
 * Entry: celo_9f7deabd99a6
 */
export const CELO_ATTRIBUTION_TAG = 'celo_9f7deabd99a6';
export const CELO_ATTRIBUTION_SUFFIX = '0x63656c6f5f396637646561626439396136110080218021802180218021802180218021';
export const OFFICIAL_AGENT_WALLET = '0xc519729BF6D15e5984702BBa2C553f1c74A73C95';
export const OFFICIAL_AGENT_TOKEN_ID = 10078;
export const OFFICIAL_AGENT_REGISTRATION_TX = '0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7';

/**
 * Official ERC-8004 Agentic Economy Registries on Celo Mainnet (42220)
 */
export const CELO_ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
export const CELO_ERC8004_REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
export const CELO_ERC8004_VALIDATION_REGISTRY = '0x8004Cb1BF31DAf7788923b405b754f57acEB4272';

/**
 * Celo Mainnet Stablecoins & Routers
 */
export const CELO_CNGN_ADDRESS = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
export const CELO_USDT_ADDRESS = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';
export const CELO_CUSD_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
export const TEXTILE_FX_ROUTER = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3';

/**
 * Canonical NairaTag Contracts on Celo Mainnet (42220)
 * Deployed & Verified: Block 83385800
 */
export const CELO_NAIRATAG_REGISTRY_ADDRESS = '0x6D3950a390c7F60287d545cC5785c594e07439F9';
export const CELO_NAIRATAG_RESOLVER_ADDRESS = '0xa3760573DE321DA2955573c69a4f497d57C769A2';
export const CELO_NAIRATAG_ESCROW_ADDRESS = '0x9f3de805eAa94516d216d6f1add78860B291BB76';

export const CELO_MAINNET_CONFIG = {
  chainId: 42220,
  name: 'Celo Mainnet',
  rpcUrl: 'https://forno.celo.org',
  explorerUrl: 'https://celoscan.io',
  contracts: {
    cngn: CELO_CNGN_ADDRESS,
    usdt: CELO_USDT_ADDRESS,
    cusd: CELO_CUSD_ADDRESS,
    nairatagRegistry: CELO_NAIRATAG_REGISTRY_ADDRESS,
    nairatagResolver: CELO_NAIRATAG_RESOLVER_ADDRESS,
    escrow: CELO_NAIRATAG_ESCROW_ADDRESS,
    erc8004Identity: CELO_ERC8004_IDENTITY_REGISTRY,
    erc8004Reputation: CELO_ERC8004_REPUTATION_REGISTRY,
  },
};

// Aliases for transition
export const arcTestnet = celoMainnet;
export const arcMainnet = celoMainnet;
export const activeArcChain = celoMainnet;
export const ARC_USDC_ADDRESS = CELO_CNGN_ADDRESS;
export const ARC_USDC_DECIMALS = 18;
export const ARC_EURC_ADDRESS = CELO_CUSD_ADDRESS;
export const ARC_CIRBTC_ADDRESS = CELO_USDT_ADDRESS;
export const ARC_ERC8004_IDENTITY_REGISTRY = CELO_ERC8004_IDENTITY_REGISTRY;
export const ARC_ERC8004_REPUTATION_REGISTRY = CELO_ERC8004_REPUTATION_REGISTRY;
export const ARC_ERC8004_VALIDATION_REGISTRY = CELO_ERC8004_VALIDATION_REGISTRY;
export const ARC_NAIRATAG_REGISTRY_ADDRESS = CELO_NAIRATAG_REGISTRY_ADDRESS;
export const ARC_NAIRATAG_RESOLVER_ADDRESS = CELO_NAIRATAG_RESOLVER_ADDRESS;
export const ARC_NAIRATAG_ESCROW_ADDRESS = CELO_NAIRATAG_ESCROW_ADDRESS;
export const ARC_MEMO_ADDRESS = CELO_NAIRATAG_ESCROW_ADDRESS;
export const ARC_MAINNET_CONFIG = CELO_MAINNET_CONFIG;
export const ARC_TESTNET_CONFIG = CELO_MAINNET_CONFIG;

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
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
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
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
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

export const CELO_ESCROW_ABI = [
  {
    type: 'function',
    name: 'createTask',
    stateMutability: 'payable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'creatorUrn', type: 'string' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      { name: 'disputeWindow', type: 'uint32' },
      { name: 'initialAssignee', type: 'address' },
      { name: 'assigneeUrn', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'releaseTask',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'assignAgent',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'assignee', type: 'address' },
      { name: 'assigneeUrn', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitDeliverable',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'deliverableHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'tasks',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'creator', type: 'address' },
      { name: 'creatorUrn', type: 'string' },
      { name: 'assignee', type: 'address' },
      { name: 'assigneeUrn', type: 'string' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      { name: 'disputeWindow', type: 'uint32' },
      { name: 'submittedAt', type: 'uint64' },
      { name: 'status', type: 'uint8' },
      { name: 'deliverableHash', type: 'bytes32' },
    ],
  },
];

// Compatibility aliases
export const CELO_TESTNET_CONFIG = CELO_MAINNET_CONFIG;
export const CELO_USDC_ADDRESS = CELO_USDT_ADDRESS;


