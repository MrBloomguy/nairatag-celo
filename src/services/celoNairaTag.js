import { createWalletClient, custom, decodeEventLog, isAddress, parseAbiItem } from 'viem';
import { CELO_NAIRATAG_REGISTRY_ADDRESS, CELO_NAIRATAG_RESOLVER_ADDRESS } from '../config/celo.js';
import { activeCeloChain, getEthereumProvider, publicClient, switchOrAddCeloNetwork } from './celoPayment.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_NODE = `0x${'0'.repeat(64)}`;
const CELO_NAIRATAG_ABI = [
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tag', type: 'string' }], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'primaryTagOf', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'bytes32' }] },
  { type: 'function', name: 'getRecord', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [{ name: 'owner', type: 'address' }, { name: 'resolver', type: 'address' }, { name: 'registeredAt', type: 'uint64' }, { name: 'canonical', type: 'string' }] }] },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [{ name: 'tag', type: 'string' }, { name: 'targetResolver', type: 'address' }], outputs: [{ name: 'node', type: 'bytes32' }] },
];
const TAG_CLAIMED_EVENT = parseAbiItem('event TagClaimed(bytes32 indexed node, string canonical, string rawTag, address indexed owner, address resolver)');

export function normalizeCeloTag(rawTag) {
  const tag = String(rawTag || '').trim().replace(/^[₦$@#]/, '').toLowerCase();
  if (tag.length < 3 || tag.length > 32) throw new Error('NairaTags must be between 3 and 32 characters.');
  if (!/^[a-z0-9_]+$/.test(tag) || tag.startsWith('_') || tag.endsWith('_') || tag.includes('__')) {
    throw new Error('Use letters, numbers, or single underscores inside the NairaTag.');
  }
  return tag;
}

async function getWalletTagRecord(walletAddress) {
  if (!walletAddress || !isAddress(walletAddress)) return null;
  const node = await publicClient.readContract({
    address: CELO_NAIRATAG_REGISTRY_ADDRESS,
    abi: CELO_NAIRATAG_ABI,
    functionName: 'primaryTagOf',
    args: [walletAddress],
  });
  if (node === ZERO_NODE) return null;
  const record = await publicClient.readContract({
    address: CELO_NAIRATAG_REGISTRY_ADDRESS,
    abi: CELO_NAIRATAG_ABI,
    functionName: 'getRecord',
    args: [node],
  });
  return { node, record };
}

export async function checkCeloTagAvailability(rawTag, walletAddress = null) {
  let cleanTag;
  try {
    cleanTag = normalizeCeloTag(rawTag);
  } catch (error) {
    return { available: false, reason: error.message };
  }

  try {
    const [owner, walletTag] = await Promise.all([
      publicClient.readContract({ address: CELO_NAIRATAG_REGISTRY_ADDRESS, abi: CELO_NAIRATAG_ABI, functionName: 'ownerOf', args: [cleanTag] }),
      getWalletTagRecord(walletAddress),
    ]);
    if (owner !== ZERO_ADDRESS) {
      return { available: false, isTaken: true, owner, cleanTag, canonicalTag: `₦${cleanTag}`, reason: `₦${cleanTag} is already claimed on Celo.` };
    }
    if (walletTag) {
      const existingTag = walletTag.record.canonical || walletTag.record[3] || '';
      return { available: false, walletRestricted: true, existingTag, cleanTag, reason: `This wallet already owns ${existingTag ? `₦${existingTag}` : 'a NairaTag'} on Celo.` };
    }
    return { available: true, cleanTag, canonicalTag: `₦${cleanTag}` };
  } catch (error) {
    return { available: false, reason: `Celo tag registry is unavailable: ${error.shortMessage || error.message}` };
  }
}

export async function getCeloTagForWallet(walletAddress) {
  try {
    const result = await getWalletTagRecord(walletAddress);
    if (!result) return { hasTag: false, tag: null };
    const record = result.record;
    const tag = record.canonical || record[3] || '';
    if (!tag) return { hasTag: false, tag: null };
    return { hasTag: true, tag: `₦${tag}`, cleanTag: tag, network: 'Celo Mainnet', claimedAt: Number(record.registeredAt ?? record[2] ?? 0n) * 1000 };
  } catch (error) {
    console.warn('[getCeloTagForWallet]', error.shortMessage || error.message);
    return { hasTag: false, tag: null };
  }
}

export async function claimCeloNairaTag({ rawTag, walletAddress }) {
  const cleanTag = normalizeCeloTag(rawTag);
  if (!walletAddress || !isAddress(walletAddress)) throw new Error('Connect a valid Celo wallet to claim a NairaTag.');
  const provider = getEthereumProvider();
  if (!provider) throw new Error('No EVM wallet provider detected.');
  const chainId = Number.parseInt(await provider.request({ method: 'eth_chainId' }), 16);
  if (chainId !== activeCeloChain.id) await switchOrAddCeloNetwork();

  const status = await checkCeloTagAvailability(cleanTag, walletAddress);
  if (!status.available) throw new Error(status.reason || 'This NairaTag cannot be claimed.');

  const walletClient = createWalletClient({ chain: activeCeloChain, transport: custom(provider) });
  const hash = await walletClient.writeContract({
    account: walletAddress,
    address: CELO_NAIRATAG_REGISTRY_ADDRESS,
    abi: CELO_NAIRATAG_ABI,
    functionName: 'claim',
    args: [cleanTag, CELO_NAIRATAG_RESOLVER_ADDRESS],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 30000 });
  if (receipt.status !== 'success') throw new Error(`Celo tag claim failed. Transaction: ${hash}`);

  let claim = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CELO_NAIRATAG_REGISTRY_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: [TAG_CLAIMED_EVENT], data: log.data, topics: log.topics });
      if (decoded.eventName === 'TagClaimed') claim = decoded.args;
    } catch { /* Ignore unrelated logs in the same receipt. */ }
  }

  return {
    success: true,
    cleanTag,
    tag: claim?.canonical || cleanTag,
    owner: claim?.owner || walletAddress,
    txHash: hash,
    receipt,
    explorerUrl: `${activeCeloChain.blockExplorers.default.url}/tx/${hash}`,
  };
}

// Backward compatibility aliases
export const checkArcTagAvailability = checkCeloTagAvailability;
export const claimArcNairaTag = claimCeloNairaTag;
export const getArcTagForWallet = getCeloTagForWallet;
export const normalizeArcTag = normalizeCeloTag;

