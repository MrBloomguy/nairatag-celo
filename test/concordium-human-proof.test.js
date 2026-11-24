import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRandomChallengeHex,
  buildConcordiumIdStatement,
  requestConcordiumHumanProof,
  CONCORDIUM_TESTNET,
} from '../src/services/concordiumAgentRegistry.js';

test('1. generateRandomChallengeHex produces 64-char cryptographically unique hex strings', () => {
  const challenge1 = generateRandomChallengeHex(32);
  const challenge2 = generateRandomChallengeHex(32);

  assert.equal(challenge1.length, 64);
  assert.equal(challenge2.length, 64);
  assert.match(challenge1, /^[0-9a-f]{64}$/);
  assert.match(challenge2, /^[0-9a-f]{64}$/);
  assert.notEqual(challenge1, challenge2);
});

test('2. buildConcordiumIdStatement builds valid atomic ZK statement for age >= 18', async () => {
  const statement = await buildConcordiumIdStatement({ minAge: 18 });

  assert.ok(Array.isArray(statement));
  assert.equal(statement.length, 1);
  const item = statement[0];
  assert.equal(item.type, 'AttributeInRange');
  assert.equal(item.attributeTag, 'dob');
  assert.equal(item.lower, '18000101');
  assert.ok(typeof item.upper === 'string' && item.upper.length === 8);
});

test('3. requestConcordiumHumanProof rejects when connection or client is missing', async () => {
  await assert.rejects(
    () => requestConcordiumHumanProof(null, '4WBJM9RyoYQiwtjB1YxdqJAF1SMVyUao7KjA6fMbQKAUKarpkk'),
    /Connect your Concordium Browser Wallet/i
  );

  await assert.rejects(
    () => requestConcordiumHumanProof({}, '4WBJM9RyoYQiwtjB1YxdqJAF1SMVyUao7KjA6fMbQKAUKarpkk'),
    /does not support Zero-Knowledge identity proofs/i
  );
});

test('4. requestConcordiumHumanProof rejects when account is invalid', async () => {
  const mockConnection = {
    client: {
      requestIdProof: async () => ({ credential: 'cred1', proof: { proofs: [] } }),
    },
  };

  await assert.rejects(
    () => requestConcordiumHumanProof(mockConnection, ''),
    /valid Concordium account address is required/i
  );
});

test('5. requestConcordiumHumanProof handles wallet user cancellation gracefully', async () => {
  const mockConnection = {
    client: {
      requestIdProof: async () => {
        throw new Error('User rejected the proof request in wallet');
      },
    },
  };

  await assert.rejects(
    () => requestConcordiumHumanProof(mockConnection, '4WBJM9RyoYQiwtjB1YxdqJAF1SMVyUao7KjA6fMbQKAUKarpkk'),
    /Human verification was rejected or cancelled in Concordium Wallet/i
  );
});

test('6. requestConcordiumHumanProof succeeds and returns structured zero-PII proof output', async () => {
  let capturedAccount;
  let capturedStatement;
  let capturedChallenge;

  const mockConnection = {
    client: {
      requestIdProof: async (account, statement, challenge) => {
        capturedAccount = account;
        capturedStatement = statement;
        capturedChallenge = challenge;
        return {
          credential: '4j4b9b99dfa98e8f8c8a123',
          proof: {
            v: 0,
            value: {
              proofs: [{ type: 'AttributeInRange', attributeTag: 'dob', proof: 'zkp-proof-data' }],
            },
          },
        };
      },
    },
  };

  const account = '4WBJM9RyoYQiwtjB1YxdqJAF1SMVyUao7KjA6fMbQKAUKarpkk';
  const result = await requestConcordiumHumanProof(mockConnection, account, { minAge: 18 });

  assert.equal(result.account, account);
  assert.equal(capturedAccount, account);
  assert.equal(result.credential, '4j4b9b99dfa98e8f8c8a123');
  assert.equal(result.valid, true);
  assert.equal(result.network, CONCORDIUM_TESTNET.network);
  assert.equal(result.minAge, 18);
  assert.ok(result.challenge);
  assert.equal(result.challenge, capturedChallenge);
  assert.ok(Array.isArray(capturedStatement));
  assert.equal(capturedStatement[0].attributeTag, 'dob');
  assert.ok(result.proof);
  assert.ok(result.verifiedAt);
});
