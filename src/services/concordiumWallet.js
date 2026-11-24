import { CONCORDIUM_TESTNET } from './concordiumAgentRegistry.js';

let activeWalletSession = null;

/** Returns the active in-memory Concordium wallet session if connected. */
export function getActiveConcordiumWallet() {
  return activeWalletSession;
}

/**
 * Connects the official Concordium Browser Wallet and enforces the configured
 * Testnet before returning an account that can be used for later actions.
 * Wallet state is held in memory only; this helper never writes browser storage.
 */
export async function connectConcordiumTestnetWallet({ onAccountChanged, onChainChanged } = {}) {
  const { BrowserWalletConnector } = await import('@concordium/wallet-connectors');
  let selectedGenesisHash;

  const delegate = {
    onAccountChanged: (_connection, account) => {
      if (activeWalletSession) activeWalletSession.account = account || null;
      onAccountChanged?.(account || null);
    },
    onChainChanged: (_connection, genesisHash) => {
      selectedGenesisHash = genesisHash;
      if (activeWalletSession) activeWalletSession.genesisHash = genesisHash;
      onChainChanged?.(genesisHash);
    },
    onConnected: (_connection, account) => {
      if (activeWalletSession) activeWalletSession.account = account || null;
      onAccountChanged?.(account || null);
    },
    onDisconnected: () => {
      activeWalletSession = null;
      onAccountChanged?.(null);
    },
  };

  let connection;
  try {
    connection = await BrowserWalletConnector.create(delegate);
    await connection.connect();

    const [account, genesisHash] = await Promise.all([
      connection.getConnectedAccount(),
      connection.client.getSelectedChain(),
    ]);
    selectedGenesisHash = genesisHash || selectedGenesisHash;

    if (!account) {
      throw new Error('Select a Concordium account in your wallet and try again.');
    }
    if (!selectedGenesisHash || selectedGenesisHash.toLowerCase() !== CONCORDIUM_TESTNET.genesisHash) {
      throw new Error(`Switch the Concordium wallet to ${CONCORDIUM_TESTNET.name}, then connect again.`);
    }

    const session = { connection, account, genesisHash: selectedGenesisHash };
    activeWalletSession = session;

    onAccountChanged?.(account);
    onChainChanged?.(selectedGenesisHash);
    return session;
  } catch (error) {
    if (connection) await connection.disconnect().catch(() => {});
    activeWalletSession = null;
    if (error?.message?.includes('Browser Wallet extension not detected')) {
      throw new Error('Install or unlock the Concordium Browser Wallet, then try again.');
    }
    if (error?.message?.toLowerCase()?.includes('not whitelisted') || error?.message?.toLowerCase()?.includes('whitelisted')) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'this site';
      throw new Error(`Open the Concordium Wallet extension icon in your browser toolbar, unlock it, and click "Connect" or "Whitelist" to authorize ${currentOrigin}.`);
    }
    throw error;
  }
}

