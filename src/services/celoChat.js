import { keccak256, stringToHex } from 'viem';
import { getCeloSessionToken } from './celoSession.js';

const CELO_CHAIN_ID = 42220;
const CELO_CHAT_API = import.meta.env.VITE_CELO_CHAT_API || 'https://nairatag.ng/api/arc-chat';

export function createCeloChatConversationId() {
  return crypto.randomUUID();
}

const conversationIds = new Map();

export function getOrCreateCeloChatConversationId(walletAddress, agentTag = 'arc') {
  const key = `nairatag:arc-chat:${String(walletAddress || '').toLowerCase()}:${String(agentTag || 'arc').toLowerCase()}`;
  const current = conversationIds.get(key);
  if (current) return current;
  const conversationId = createCeloChatConversationId();
  conversationIds.set(key, conversationId);
  return conversationId;
}

async function signCeloChatAction({ action, walletAddress, conversationId = '', turnId = '', prompt = '' }) {
  const provider = typeof window !== 'undefined' ? window.ethereum : null;
  if (!provider?.request) throw new Error('Connect an EVM wallet to save your Celo chat.');
  const timestamp = Date.now();
  const contentHash = action === 'send' ? keccak256(stringToHex(prompt)) : '';
  const message = [
    'NairaTag Celo Chat',
    `Action: ${action}`,
    `Conversation: ${conversationId}`,
    `Turn: ${turnId}`,
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Chain: ${CELO_CHAIN_ID}`,
    `Timestamp: ${timestamp}`,
    `Content hash: ${contentHash}`,
  ].join('\n');
  const signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
  return { action, walletAddress, conversationId, turnId, timestamp, signature };
}

async function postCeloChat(payload, token = null) {
  const response = await fetch(CELO_CHAT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || `Celo chat service returned ${response.status}.`);
  return result;
}

export async function sendCeloChatMessage({ walletAddress, conversationId, turnId, prompt, agentTag = 'arc', title }) {
  if (!walletAddress) throw new Error('Connect your Celo wallet to save this conversation.');
  const token = getCeloSessionToken(walletAddress);
  if (token) return postCeloChat({ action: 'send', walletAddress, conversationId, turnId, prompt, agentTag, title }, token);
  const signed = await signCeloChatAction({ action: 'send', walletAddress, conversationId, turnId, prompt });
  return postCeloChat({ ...signed, prompt, agentTag, title });
}

export async function getCeloChatHistory({ walletAddress, conversationId }) {
  if (!walletAddress) throw new Error('Connect your Celo wallet to load saved conversations.');
  const token = getCeloSessionToken(walletAddress);
  if (token) return postCeloChat({ action: 'history', walletAddress, conversationId }, token);
  const signed = await signCeloChatAction({ action: 'history', walletAddress, conversationId });
  return postCeloChat(signed);
}

export async function listCeloChatConversations({ walletAddress }) {
  if (!walletAddress) throw new Error('Connect your Celo wallet to load saved conversations.');
  const token = getCeloSessionToken(walletAddress);
  if (token) return postCeloChat({ action: 'list', walletAddress }, token);
  const signed = await signCeloChatAction({ action: 'list', walletAddress });
  return postCeloChat(signed);
}

export async function clearCeloChatHistory({ walletAddress }) {
  if (!walletAddress) throw new Error('Connect your Celo wallet to clear saved conversations.');
  const token = getCeloSessionToken(walletAddress);
  if (token) return postCeloChat({ action: 'clear', walletAddress }, token);
  const signed = await signCeloChatAction({ action: 'clear', walletAddress });
  return postCeloChat(signed);
}


// Backward compatibility aliases
export const createArcChatConversationId = createCeloChatConversationId;
export const getOrCreateArcChatConversationId = getOrCreateCeloChatConversationId;
export const sendArcChatMessage = sendCeloChatMessage;
export const getArcChatHistory = getCeloChatHistory;
export const listArcChatConversations = listCeloChatConversations;
export const clearArcChatHistory = clearCeloChatHistory;
