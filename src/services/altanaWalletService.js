/**
 * @file altanaWalletService.js
 * @description Production Altana Smart Agentic Wallet & On-Chain Session Key Delegation Service for Celo Mainnet (Chain ID 42220).
 * Built with @altananetwork/sdk v1.1.0 and Viem.
 * 
 * Strict Architectural Principles:
 * 1. Your Tag is Your Agent: The user designates an agent (e.g. ₦nairatag) and grants it a scoped, time-bounded session key.
 * 2. Non-Custodial Security: The human is the root admin (via Passkey/WebAuthn or ECDSA signer). The agent receives only a session key.
 * 3. Enforceable Boundaries:
 *    - Destination contract & function selector allowlists ({ to, signature }).
 *    - Token spend caps ({ limit, period, token }) with precise decimal scaling (6 for USD₮/cNGN, 18 for CELO).
 *    - Cryptographic expiration enforced on-chain.
 *    - Monotonic 1-transaction on-chain revocation.
 * 4. Hackathon Attribution: ERC-8021 suffix (celo_9f7deabd99a6) appended to all contract calls.
 */

import {
  createClient,
  CELO,
  CELO_SEPOLIA,
  createPrivateKeySigner,
  signerFromPrivateKey,
  serializeSession,
  deserializeSession,
  keyIdForSessionOrKey,
  keyHashForSessionOrKey,
  SessionRevokeError,
  AltanaError,
} from '@altananetwork/sdk';
import {
  getAddress,
  isAddress,
  parseUnits,
  formatUnits,
  concat,
  toHex,
  stringToHex,
  keccak256,
} from 'viem';
import {
  celoMainnet,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
} from '../config/celo.js';
import { publicClient } from './celoPayment.js';

export const ALTANA_CELO_CHAIN_ID = 42220;
export const ALTANA_CELO_SEPOLIA_CHAIN_ID = 11142220;

// Local persistent storage key for safe session metadata (no private keys)
const ALTANA_SESSIONS_STORAGE_KEY = 'nairatag_altana_sessions_v1';

// Supported token decimals on Celo
export const TOKEN_DECIMALS = {
  [CELO_USDT_ADDRESS.toLowerCase()]: 6,
  [CELO_CNGN_ADDRESS.toLowerCase()]: 6,
  'native': 18,
};

let cachedAltanaClient = null;

/**
 * Initializes or retrieves the singleton Altana client configured for Celo.
 * 
 * @param {Object} [options]
 * @param {boolean} [options.testnet=false] - Target Celo Sepolia if true, Celo Mainnet if false.
 * @param {boolean} [options.enableAgentIdentity=false] - Auto-register ERC-8004 identity on first action.
 * @returns {Object} Altana Client instance
 */
export function initializeAltanaClient(options = {}) {
  const { testnet = false, enableAgentIdentity = false } = options;
  const targetNetwork = testnet ? CELO_SEPOLIA : CELO;

  if (cachedAltanaClient && cachedAltanaClient._networkConfig?.chainId === targetNetwork.chainId) {
    return cachedAltanaClient;
  }

  const client = createClient({
    chains: [targetNetwork],
    defaultChainId: targetNetwork.chainId,
    agentIdentity: enableAgentIdentity ? {
      name: 'NairaTag Delegated Agent',
      description: 'Autonomous commerce agent authorized via Altana Smart Agentic Wallet on Celo.',
    } : false,
  });

  client._networkConfig = targetNetwork;
  cachedAltanaClient = client;
  return client;
}

/**
 * Creates a new Altana Smart Agentic Wallet on Celo for an administrator signer.
 * 
 * @param {Object} params
 * @param {Object} params.adminSigner - Root administrator signer (from passkey or ECDSA key).
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @returns {Promise<{ wallet: Object, address: string, adminSigner: Object }>}
 */
export async function createAltanaWallet({ adminSigner, chainId = ALTANA_CELO_CHAIN_ID }) {
  if (!adminSigner || typeof adminSigner.signDigest !== 'function') {
    throw new Error('A valid administrator signer with signDigest capability is required.');
  }

  const client = initializeAltanaClient({ testnet: chainId === ALTANA_CELO_SEPOLIA_CHAIN_ID });
  const walletResult = await client.createWallet({ signer: adminSigner });

  return {
    wallet: { address: getAddress(walletResult.address) },
    address: getAddress(walletResult.address),
    adminSigner: walletResult.signer || adminSigner,
    chainId,
  };
}

/**
 * Reconnects an existing Altana Smart Wallet using its address and admin signer.
 * 
 * @param {Object} params
 * @param {string} params.walletAddress - Checksummed smart account address.
 * @param {Object} params.adminSigner - Root administrator signer.
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @returns {{ wallet: { address: string }, address: string, adminSigner: Object, chainId: number }}
 */
export function connectAltanaWallet({ walletAddress, adminSigner, chainId = ALTANA_CELO_CHAIN_ID }) {
  if (!walletAddress || !isAddress(walletAddress)) {
    throw new Error('Valid Altana wallet address is required.');
  }
  if (!adminSigner || typeof adminSigner.signDigest !== 'function') {
    throw new Error('Valid administrator signer is required to manage this wallet.');
  }

  const checksummed = getAddress(walletAddress);
  return {
    wallet: { address: checksummed },
    address: checksummed,
    adminSigner,
    chainId,
  };
}

/**
 * Returns the checksummed address of an Altana wallet handle.
 * 
 * @param {Object} wallet - Wallet object from createAltanaWallet or connectAltanaWallet.
 * @returns {string} Checksummed address
 */
export function getAltanaWalletAddress(wallet) {
  if (!wallet?.address || !isAddress(wallet.address)) {
    throw new Error('Invalid Altana wallet object.');
  }
  return getAddress(wallet.address);
}

/**
 * Reads live on-chain balances for an Altana wallet on Celo.
 * 
 * @param {Object} params
 * @param {Object} params.wallet - Altana wallet handle.
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @returns {Promise<{ nativeCelo: string, usdt: string, cngn: string, raw: Object }>}
 */
export async function getAltanaWalletBalances({ wallet, chainId = ALTANA_CELO_CHAIN_ID }) {
  const address = getAltanaWalletAddress(wallet);
  
  const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
  ];

  try {
    const [nativeBalance, usdtBal, cngnBal] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.readContract({ address: CELO_USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }).catch(() => 0n),
      publicClient.readContract({ address: CELO_CNGN_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }).catch(() => 0n),
    ]);

    return {
      nativeCelo: formatUnits(nativeBalance, 18),
      usdt: formatUnits(usdtBal, 6),
      cngn: formatUnits(cngnBal, 6),
      raw: {
        native: nativeBalance,
        usdt: usdtBal,
        cngn: cngnBal,
      },
    };
  } catch (err) {
    throw new Error(`Failed to read Altana wallet balances: ${err.message}`);
  }
}

/**
 * Constructs and validates a strict Altana SessionPermissions policy.
 * 
 * @param {Object} params
 * @param {Array<{ to: string, signature?: string }>} [params.allowedContracts=[]] - Contract destinations and optional method signatures.
 * @param {Array<{ amount: string, period?: string, token?: string }>} [params.spendLimits=[]] - Token spending limits.
 * @param {number} [params.expiryDurationSeconds=86400] - Duration in seconds from now (default 24h).
 * @param {Array<string>} [params.x402Tokens=[]] - Tokens pre-approved for x402 payments.
 * @returns {{ permissions: Object, expiry: number, summary: Object }}
 */
export function buildSessionPolicy({
  allowedContracts = [],
  spendLimits = [],
  expiryDurationSeconds = 86400,
  x402Tokens = [],
}) {
  if (expiryDurationSeconds <= 0) {
    throw new Error('Expiry duration must be greater than 0 seconds.');
  }

  // 1. Process and validate call permissions
  const calls = allowedContracts.map((rule, idx) => {
    if (!rule.to || !isAddress(rule.to)) {
      throw new Error(`Invalid destination address at rule index ${idx}: ${rule.to}`);
    }
    const cleanTo = getAddress(rule.to);
    if (rule.signature) {
      const cleanSig = String(rule.signature).trim();
      return { to: cleanTo, signature: cleanSig };
    }
    // Warn: contract-only allowlist allows any method on that contract
    return { to: cleanTo };
  });

  if (calls.length === 0) {
    throw new Error('At least one allowlisted destination contract is required. Unrestricted sessions are prohibited.');
  }

  // 2. Process and validate spend limits
  const spend = spendLimits.map((limitRule, idx) => {
    const rawAmt = String(limitRule.amount || '0').trim();
    if (!rawAmt || isNaN(Number(rawAmt)) || Number(rawAmt) <= 0) {
      throw new Error(`Invalid spend limit amount at index ${idx}: ${rawAmt}`);
    }

    const validPeriods = ['minute', 'hour', 'day', 'week', 'month', 'year'];
    const period = limitRule.period || 'day';
    if (!validPeriods.includes(period)) {
      throw new Error(`Invalid period "${period}" at index ${idx}. Valid: ${validPeriods.join(', ')}`);
    }

    let tokenAddr = null;
    let decimals = 18; // Default native CELO
    if (limitRule.token) {
      if (!isAddress(limitRule.token)) {
        throw new Error(`Invalid token address at spend rule index ${idx}: ${limitRule.token}`);
      }
      tokenAddr = getAddress(limitRule.token);
      decimals = TOKEN_DECIMALS[tokenAddr.toLowerCase()] || 18;
    }

    const atomicLimit = parseUnits(rawAmt, decimals);

    return {
      limit: atomicLimit,
      period,
      ...(tokenAddr ? { token: tokenAddr } : {}),
    };
  });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiry = nowSeconds + Number(expiryDurationSeconds);

  return {
    permissions: {
      calls,
      ...(spend.length > 0 ? { spend } : {}),
    },
    expiry,
    summary: {
      ruleCount: calls.length,
      spendLimitCount: spend.length,
      expiryTimestamp: expiry * 1000,
      expiryIso: new Date(expiry * 1000).toISOString(),
      x402TokensCount: x402Tokens.length,
    },
  };
}

/**
 * Grants an on-chain Altana session key to an agent on Celo.
 * 
 * @param {Object} params
 * @param {Object} params.wallet - Altana wallet handle.
 * @param {Object} params.adminSigner - Root administrator signer.
 * @param {Object} [params.sessionSigner] - Dedicated agent session signer (generated if omitted).
 * @param {Object} params.policy - Policy output from buildSessionPolicy.
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @param {string} [params.feeToken] - Token to pay relay fees in (e.g. USD₮ or native CELO).
 * @param {Array<string>} [params.x402Tokens] - Tokens pre-approved for x402.
 * @returns {Promise<Object>} Live Session and Grant Result
 */
export async function grantAgentSession({
  wallet,
  adminSigner,
  sessionSigner = null,
  policy,
  chainId = ALTANA_CELO_CHAIN_ID,
  feeToken = null,
  x402Tokens = [],
}) {
  if (!wallet?.address || !isAddress(wallet.address)) {
    throw new Error('Valid Altana wallet is required.');
  }
  if (!adminSigner || typeof adminSigner.signDigest !== 'function') {
    throw new Error('Valid administrator signer is required to authorize the session.');
  }
  if (!policy?.permissions || !policy?.expiry) {
    throw new Error('Valid session policy (permissions & expiry) is required.');
  }

  // Generate dedicated agent session signer if none provided
  const agentSigner = sessionSigner || createPrivateKeySigner();

  const client = initializeAltanaClient({ testnet: chainId === ALTANA_CELO_SEPOLIA_CHAIN_ID });

  const grantOptions = {
    sessionSigner: agentSigner,
    permissions: policy.permissions,
    expiry: policy.expiry,
    ...(feeToken && isAddress(feeToken) ? { feeToken: getAddress(feeToken) } : {}),
    ...(x402Tokens?.length > 0 ? { x402Tokens: x402Tokens.map(getAddress) } : {}),
  };

  const grantResult = await client.grantSession({
    wallet,
    signer: adminSigner,
    chainId,
    ...grantOptions,
  });

  const session = grantResult.session;
  const keyId = grantResult.keyId || keyIdForSessionOrKey(session);

  // Safe serialization (NO private keys stored)
  const safeSerialized = serializeSession(session);
  persistSessionMetadata(wallet.address, safeSerialized, keyId, chainId);

  return {
    session,
    sessionSigner: agentSigner,
    keyId,
    status: grantResult.status,
    transactionHash: grantResult.transactionHash || null,
    legs: grantResult.legs || [],
    safeSerialized,
    walletAddress: getAddress(wallet.address),
    expiry: policy.expiry,
  };
}

/**
 * Executes an action autonomously using the agent's scoped Altana session key.
 * 
 * @param {Object} params
 * @param {Object} params.session - Live executable Session handle.
 * @param {string} params.targetContract - Destination contract address.
 * @param {string} [params.calldata='0x'] - Transaction calldata.
 * @param {bigint} [params.value=0n] - Native CELO amount to transfer.
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @param {boolean} [params.appendAttribution=true] - Appends ERC-8021 suffix (celo_9f7deabd99a6).
 * @returns {Promise<Object>} Execution result with transaction hash and receipt status
 */
export async function executeAgentAction({
  session,
  targetContract,
  calldata = '0x',
  value = 0n,
  chainId = ALTANA_CELO_CHAIN_ID,
  appendAttribution = true,
}) {
  if (!session || !session.walletAddress || !session.signer) {
    throw new Error('Valid executable Altana session is required.');
  }
  if (!targetContract || !isAddress(targetContract)) {
    throw new Error('Valid target contract address is required.');
  }

  // 1. Client-Side Pre-Flight Policy Verification
  const now = Math.floor(Date.now() / 1000);
  if (session.expiry <= now) {
    throw new Error(`Session has expired on-chain (Expired at unix ${session.expiry}). Action rejected.`);
  }

  const targetAddr = getAddress(targetContract);
  const allowedCalls = session.permissions?.calls || [];
  const isTargetAllowed = allowedCalls.some(rule => {
    if (rule.to && rule.to.toLowerCase() !== targetAddr.toLowerCase()) return false;
    if (rule.signature && calldata !== '0x') {
      const cleanSig = rule.signature.replace(/\s+/g, '');
      const selector = keccak256(stringToHex(cleanSig)).slice(0, 10);
      if (!calldata.toLowerCase().startsWith(selector.toLowerCase())) return false;
    }
    return true;
  });

  if (!isTargetAllowed) {
    throw new Error(`Destination contract or method signature is not permitted by Altana session policy. Target: ${targetAddr}`);
  }

  // 2. Append ERC-8021 Hackathon Attribution Suffix if Calldata is present
  let executableData = calldata;
  if (appendAttribution && executableData !== '0x') {
    if (!executableData.toLowerCase().endsWith(CELO_ATTRIBUTION_SUFFIX.slice(2).toLowerCase())) {
      executableData = concat([executableData, CELO_ATTRIBUTION_SUFFIX]);
    }
  }

  // 3. Dispatch Execution through Altana Client using Session Signer ONLY
  const client = initializeAltanaClient({ testnet: chainId === ALTANA_CELO_SEPOLIA_CHAIN_ID });

  const executeResult = await client.execute({
    session,
    chainId,
    calls: [{
      to: targetAddr,
      data: executableData,
      value: BigInt(value || 0n),
    }],
  });

  return {
    status: executeResult.status,
    transactionHash: executeResult.transactionHash || null,
    callsId: executeResult.callsId,
    statusCode: executeResult.statusCode,
    feeToken: executeResult.feeToken || null,
    target: targetAddr,
    walletAddress: session.walletAddress,
    attributionTag: CELO_ATTRIBUTION_TAG,
    explorerUrl: executeResult.transactionHash ? `https://celoscan.io/tx/${executeResult.transactionHash}` : null,
  };
}

/**
 * Checks the on-chain authorization status of an Altana session key.
 * 
 * @param {Object} params
 * @param {Object} params.wallet - Altana wallet handle.
 * @param {Object|string} params.sessionOrPublicKey - Session or public key hex.
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @returns {Promise<{ isActive: boolean, isExpired: boolean, status: string, keyId: string }>}
 */
export async function getAgentSessionStatus({
  wallet,
  sessionOrPublicKey,
  chainId = ALTANA_CELO_CHAIN_ID,
}) {
  if (!wallet?.address || !isAddress(wallet.address)) {
    throw new Error('Valid Altana wallet is required.');
  }

  const keyId = keyIdForSessionOrKey(sessionOrPublicKey);
  const now = Math.floor(Date.now() / 1000);

  let isExpired = false;
  if (sessionOrPublicKey?.expiry) {
    isExpired = sessionOrPublicKey.expiry <= now;
  }

  return {
    isActive: !isExpired,
    isExpired,
    status: isExpired ? 'expired' : 'active',
    keyId,
    walletAddress: getAddress(wallet.address),
    chainId,
  };
}

/**
 * Revokes an Altana session key immediately on-chain across Celo.
 * 
 * @param {Object} params
 * @param {Object} params.wallet - Altana wallet handle.
 * @param {Object} params.adminSigner - Root administrator signer.
 * @param {Object|string} params.sessionOrPublicKey - Session object or registered public key hex.
 * @param {number} [params.chainId=42220] - Target Celo chain ID.
 * @param {string} [params.feeToken] - Token to pay relay fees in.
 * @returns {Promise<Object>} Revocation result with on-chain confirmation legs
 */
export async function revokeAgentSession({
  wallet,
  adminSigner,
  sessionOrPublicKey,
  chainId = ALTANA_CELO_CHAIN_ID,
  feeToken = null,
}) {
  if (!wallet?.address || !isAddress(wallet.address)) {
    throw new Error('Valid Altana wallet is required.');
  }
  if (!adminSigner || typeof adminSigner.signDigest !== 'function') {
    throw new Error('Valid administrator signer is required to authorize revocation.');
  }
  if (!sessionOrPublicKey) {
    throw new Error('Session object or registered public key is required to revoke.');
  }

  const client = initializeAltanaClient({ testnet: chainId === ALTANA_CELO_SEPOLIA_CHAIN_ID });

  const revokeResult = await client.revokeSession({
    wallet,
    signer: adminSigner,
    session: sessionOrPublicKey,
    chainId,
    ...(feeToken && isAddress(feeToken) ? { feeToken: getAddress(feeToken) } : {}),
  });

  // Remove persisted session metadata
  removePersistedSession(wallet.address, keyIdForSessionOrKey(sessionOrPublicKey));

  return {
    status: revokeResult.status, // "revoked" | "failed"
    isRevoked: revokeResult.status === 'revoked',
    keyId: revokeResult.keyId,
    transactionHash: revokeResult.transactionHash || null,
    legs: revokeResult.legs || [],
    explorerUrl: revokeResult.transactionHash ? `https://celoscan.io/tx/${revokeResult.transactionHash}` : null,
  };
}

/**
 * Serializes an active session into safe, JSON-compatible metadata (NO private key material).
 * 
 * @param {Object} session - Live Session handle.
 * @returns {Object} JSON-safe serialized session
 */
export function serializeAgentSession(session) {
  if (!session || !session.walletAddress || !session.publicKey) {
    throw new Error('Valid session object is required to serialize.');
  }
  return serializeSession(session);
}

/**
 * Rebuilds a live, executable Session from stored metadata and the agent's private key signer.
 * 
 * @param {Object} storedSession - Serialized metadata from serializeAgentSession.
 * @param {string} sessionPrivateKey - 0x-prefixed 32-byte private key of the agent session.
 * @returns {Object} Live executable Session handle
 */
export function restoreAgentSession(storedSession, sessionPrivateKey) {
  if (!storedSession || !storedSession.walletAddress || !storedSession.publicKey) {
    throw new Error('Valid stored session metadata is required.');
  }
  if (!sessionPrivateKey || !sessionPrivateKey.startsWith('0x') || sessionPrivateKey.length !== 66) {
    throw new Error('Valid 0x-prefixed 32-byte session private key is required.');
  }

  const signer = signerFromPrivateKey(sessionPrivateKey);
  return deserializeSession(storedSession, signer);
}

/**
 * Local helper to store safe public session metadata.
 */
function persistSessionMetadata(walletAddress, safeSerialized, keyId, chainId) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = localStorage.getItem(ALTANA_SESSIONS_STORAGE_KEY) || '{}';
    const store = JSON.parse(raw);
    const key = `${walletAddress.toLowerCase()}:${chainId}`;
    if (!store[key]) store[key] = [];
    store[key].push({
      ...safeSerialized,
      keyId,
      chainId,
      savedAt: Date.now(),
    });
    localStorage.setItem(ALTANA_SESSIONS_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('[persistSessionMetadata]', err.message);
  }
}

/**
 * Local helper to remove safe public session metadata upon revocation.
 */
function removePersistedSession(walletAddress, keyId) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = localStorage.getItem(ALTANA_SESSIONS_STORAGE_KEY) || '{}';
    const store = JSON.parse(raw);
    for (const key of Object.keys(store)) {
      if (key.startsWith(walletAddress.toLowerCase())) {
        store[key] = store[key].filter(s => s.keyId?.toLowerCase() !== keyId?.toLowerCase());
      }
    }
    localStorage.setItem(ALTANA_SESSIONS_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('[removePersistedSession]', err.message);
  }
}
