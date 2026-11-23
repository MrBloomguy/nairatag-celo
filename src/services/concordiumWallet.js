import { CONCORDIUM_TESTNET } from './concordiumAgentRegistry.js';

/**
 * Connects the official Concordium Browser Wallet and enforces the configured
 * Testnet before returning an account that can be used for later actions.
 * Wallet state is held in memory only; this helper never writes browser storage.
 */
export async function connectConcordiumTestnetWallet({ onAccountChanged, onChainChanged } = {}) {
  const { BrowserWalletConnector } = await import('@concordium/wallet-connectors');
  let selectedGenesisHash;

  const delegate = {
    onAccountChanged: (_connection, account) => onAccountChanged?.(account || null),
    onChainChanged: (_connection, genesisHash) => {
      selectedGenesisHash = genesisHash;
      onChainChanged?.(genesisHash);
    },
    onConnected: (_connection, account) => onAccountChanged?.(account || null),
    onDisconnected: () => onAccountChanged?.(null),
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

    onAccountChanged?.(account);
    onChainChanged?.(selectedGenesisHash);
    return { connection, account, genesisHash: selectedGenesisHash };
  } catch (error) {
    if (connection) await connection.disconnect().catch(() => {});
    if (error?.message?.includes('Browser Wallet extension not detected')) {
      throw new Error('Install or unlock the Concordium Browser Wallet, then try again.');
    }
    if (error?.message?.toLowerCase()?.includes('not whitelisted') || error?.message?.toLowerCase()?.includes('whitelisted')) {
      throw new Error('Open your Concordium Wallet extension in the browser toolbar and click "Connect" or "Whitelist" to authorize localhost:5173.');
    }
    throw error;
  }
}
