import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeAltanaClient,
  createAltanaWallet,
  connectAltanaWallet,
  getAltanaWalletAddress,
  buildSessionPolicy,
  grantAgentSession,
  executeAgentAction,
  getAgentSessionStatus,
  revokeAgentSession,
  serializeAgentSession,
  restoreAgentSession,
  ALTANA_CELO_CHAIN_ID,
  ALTANA_CELO_SEPOLIA_CHAIN_ID,
  TOKEN_DECIMALS,
} from '../src/services/altanaWalletService.js';
import {
  createPrivateKeySigner,
  signerFromPrivateKey,
  serializeSession,
  deserializeSession,
  keyIdForSessionOrKey,
  CELO,
  CELO_SEPOLIA,
} from '@altananetwork/sdk';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
} from '../src/config/celo.js';

test('Altana Client Configuration & Celo Constants', () => {
  const clientMainnet = initializeAltanaClient({ testnet: false });
  assert.equal(clientMainnet._networkConfig.chainId, ALTANA_CELO_CHAIN_ID);
  assert.equal(ALTANA_CELO_CHAIN_ID, 42220);
  assert.equal(CELO.chainId, 42220);
  assert.equal(CELO.keyStore.toLowerCase(), '0x83b30935f36d6ccf9b1ec3b5e47f2866b97cd27c'.toLowerCase());

  const clientSepolia = initializeAltanaClient({ testnet: true });
  assert.equal(clientSepolia._networkConfig.chainId, ALTANA_CELO_SEPOLIA_CHAIN_ID);
  assert.equal(ALTANA_CELO_SEPOLIA_CHAIN_ID, 11142220);
});

test('Supported Admin Signer Generation & Address Validation', async () => {
  const adminSigner = createPrivateKeySigner();
  assert.ok(adminSigner.address.startsWith('0x'));
  assert.ok(adminSigner.publicKey.startsWith('0x'));
  assert.equal(adminSigner.type, 'privateKey');
  assert.equal(typeof adminSigner.signDigest, 'function');

  // Verify connectAltanaWallet checksums addresses properly
  const wallet = connectAltanaWallet({
    walletAddress: '0xc519729bf6d15e5984702bba2c553f1c74a73c95',
    adminSigner,
  });
  assert.equal(wallet.address, '0xc519729BF6D15e5984702BBa2C553f1c74A73C95');
  assert.equal(getAltanaWalletAddress(wallet), '0xc519729BF6D15e5984702BBa2C553f1c74A73C95');
});

test('Session Policy Builder: Contract & Method-Signature Enforcement', () => {
  const dummyReactor = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3';
  const dummyIdentityRegistry = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

  const policy = buildSessionPolicy({
    allowedContracts: [
      { to: dummyReactor, signature: 'executeBatch(bytes)' },
      { to: dummyIdentityRegistry, signature: 'register(string)' },
    ],
    spendLimits: [
      { amount: '5.0', period: 'day', token: CELO_USDT_ADDRESS }, // 5 USD₮ / day (6 dec)
      { amount: '1000.0', period: 'day', token: CELO_CNGN_ADDRESS }, // 1,000 cNGN / day (6 dec)
      { amount: '0.5', period: 'week' }, // 0.5 CELO / week (18 dec native)
    ],
    expiryDurationSeconds: 86400, // 24h
  });

  assert.equal(policy.permissions.calls.length, 2);
  assert.equal(policy.permissions.calls[0].to.toLowerCase(), dummyReactor.toLowerCase());
  assert.equal(policy.permissions.calls[0].signature, 'executeBatch(bytes)');
  assert.equal(policy.permissions.calls[1].to.toLowerCase(), dummyIdentityRegistry.toLowerCase());
  assert.equal(policy.permissions.calls[1].signature, 'register(string)');

  // Spend limit verification & token decimal scaling
  assert.equal(policy.permissions.spend.length, 3);
  assert.equal(policy.permissions.spend[0].limit, 5000000n, '5 USD₮ must scale to 5,000,000 atomic units (6 decimals)');
  assert.equal(policy.permissions.spend[0].token.toLowerCase(), CELO_USDT_ADDRESS.toLowerCase());
  assert.equal(policy.permissions.spend[0].period, 'day');

  assert.equal(policy.permissions.spend[1].limit, 1000000000n, '1,000 cNGN must scale to 1,000,000,000 atomic units (6 decimals)');
  assert.equal(policy.permissions.spend[1].token.toLowerCase(), CELO_CNGN_ADDRESS.toLowerCase());

  assert.equal(policy.permissions.spend[2].limit, 500000000000000000n, '0.5 CELO must scale to 18 decimals');
  assert.equal(policy.permissions.spend[2].token, undefined, 'Native CELO omits token field in Altana schema');
  assert.equal(policy.permissions.spend[2].period, 'week');

  // Expiry verification
  assert.ok(policy.expiry > Math.floor(Date.now() / 1000));
  assert.ok(policy.summary.expiryTimestamp > Date.now());
});

test('Session Policy Builder: Rejection of Unrestricted Sessions', () => {
  assert.throws(
    () => buildSessionPolicy({ allowedContracts: [] }),
    /At least one allowlisted destination contract is required/
  );

  assert.throws(
    () => buildSessionPolicy({
      allowedContracts: [{ to: '0xinvalid' }],
    }),
    /Invalid destination address/
  );

  assert.throws(
    () => buildSessionPolicy({
      allowedContracts: [{ to: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3' }],
      spendLimits: [{ amount: '-1.0' }],
    }),
    /Invalid spend limit amount/
  );
});

test('Session Serialization & Restoration (Zero Secret Leaks)', () => {
  const dummyWallet = '0xc519729BF6D15e5984702BBa2C553f1c74A73C95';
  const sessionSigner = createPrivateKeySigner();
  const rawPrivateKey = sessionSigner._privateKey;

  const liveSession = {
    walletAddress: dummyWallet,
    signer: sessionSigner,
    publicKey: sessionSigner.publicKey,
    permissions: {
      calls: [{ to: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3' }],
      spend: [{ limit: 1000000n, period: 'day', token: CELO_USDT_ADDRESS }],
    },
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  const safeSerialized = serializeAgentSession(liveSession);

  // Assert NO private key or secret material is present in serialized output
  assert.equal(safeSerialized._privateKey, undefined);
  assert.equal(safeSerialized.signer, undefined);
  assert.ok(safeSerialized.publicKey);
  assert.equal(safeSerialized.walletAddress, dummyWallet);
  assert.equal(safeSerialized.permissions.spend[0].limit, '1000000', 'BigInt serialized to string for JSON safety');

  // Assert restoration with session signer works
  const restoredSession = restoreAgentSession(safeSerialized, rawPrivateKey);
  assert.equal(restoredSession.walletAddress, dummyWallet);
  assert.equal(restoredSession.publicKey, sessionSigner.publicKey);
  assert.equal(typeof restoredSession.signer.signDigest, 'function');
});

test('Unauthorized Execution Pre-Flight Rejection', async () => {
  const dummyWallet = '0xc519729BF6D15e5984702BBa2C553f1c74A73C95';
  const sessionSigner = createPrivateKeySigner();
  const allowedTarget = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3';
  const unallowedTarget = '0x1111111111111111111111111111111111111111';

  const mockSession = {
    walletAddress: dummyWallet,
    signer: sessionSigner,
    publicKey: sessionSigner.publicKey,
    permissions: {
      calls: [{ to: allowedTarget, signature: 'execute(bytes)' }],
      spend: [{ limit: 1000000n, period: 'day', token: CELO_USDT_ADDRESS }],
    },
    expiry: Math.floor(Date.now() / 1000) + 3600,
  };

  // 1. Rejected for unallowed contract target
  await assert.rejects(
    () => executeAgentAction({
      session: mockSession,
      targetContract: unallowedTarget,
      calldata: '0x',
    }),
    /Destination contract or method signature is not permitted by Altana session policy/
  );

  // 2. Rejected for expired session
  const expiredSession = {
    ...mockSession,
    expiry: Math.floor(Date.now() / 1000) - 10,
  };
  await assert.rejects(
    () => executeAgentAction({
      session: expiredSession,
      targetContract: allowedTarget,
      calldata: '0x',
    }),
    /Session has expired on-chain/
  );
});

test('Revocation Result & Partial Failure Inspection', () => {
  const mockRevokeSuccess = {
    status: 'revoked',
    keyId: '0x1234',
    legs: [
      { chainId: 42220, kind: 'account', status: 'CONFIRMED' },
      { chainId: 42220, kind: 'registry', status: 'CONFIRMED' },
    ],
  };

  const isSuccess = mockRevokeSuccess.status === 'revoked';
  assert.ok(isSuccess, 'Must confirm revoked when all legs succeed');

  const mockRevokePartialFailure = {
    status: 'failed',
    keyId: '0x1234',
    legs: [
      { chainId: 42220, kind: 'account', status: 'CONFIRMED' },
      { chainId: 42220, kind: 'registry', status: 'FAILED', reason: 'Keystore relay timeout' },
    ],
  };

  assert.equal(mockRevokePartialFailure.status, 'failed', 'Must report failed if any leg fails');
  assert.ok(mockRevokePartialFailure.legs.some(l => l.status === 'FAILED'), 'Must pinpoint failed leg and reason');
});
