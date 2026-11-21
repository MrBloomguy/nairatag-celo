import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEXTILE_BASE_URL,
  CELO_CHAIN_ID,
  getIndicativePreview,
  requestFirmQuote,
  createTakerProofOfControl,
  appendAttributionSuffix,
  hasAttributionSuffix,
  prepareSwapExecution,
  TOKEN_DECIMALS,
} from '../src/services/textileRfqService.js';
import {
  executeCorridorPayment,
  getPersistedPaymentReceipts,
} from '../src/services/corridorPaymentFlow.js';
import {
  CELO_USDT_ADDRESS,
  CELO_CNGN_ADDRESS,
  TEXTILE_FX_ROUTER,
  CELO_ATTRIBUTION_TAG,
  CELO_ATTRIBUTION_SUFFIX,
} from '../src/config/celo.js';

test('Textile FX Configuration & Corridor Constants', () => {
  assert.equal(CELO_CHAIN_ID, 42220, 'Celo Mainnet chain ID must be 42220');
  assert.equal(TEXTILE_BASE_URL, 'https://api.textilecredit.com/v2', 'Must point to Textile v2 API');
  assert.equal(TEXTILE_FX_ROUTER.toLowerCase(), '0xa9aa0a64769cbed4d3b1ceb4df01cde915c235b3'.toLowerCase());
  assert.equal(CELO_USDT_ADDRESS.toLowerCase(), '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e'.toLowerCase());
  assert.equal(CELO_CNGN_ADDRESS.toLowerCase(), '0xf6829d7393dae24509eb1e52ee8e572e2e271a4f'.toLowerCase());
});

test('ERC-8021 Attribution Suffix Integrity', () => {
  const dummyCalldata = '0xa9059cbb000000000000000000000000c519729bf6d15e5984702bba2c553f1c74a73c9500000000000000000000000000000000000000000000000000000000000f4240';
  const taggedCalldata = appendAttributionSuffix(dummyCalldata);
  
  assert.ok(taggedCalldata.startsWith(dummyCalldata), 'Calldata must preserve original payload');
  assert.ok(taggedCalldata.endsWith(CELO_ATTRIBUTION_SUFFIX.slice(2)), 'Calldata must append ERC-8021 attribution suffix');
  assert.ok(hasAttributionSuffix(taggedCalldata), 'hasAttributionSuffix must return true');
  
  // Verify ASCII decoding of the tag inside suffix
  const tagBytes = Buffer.from('celo_9f7deabd99a6', 'utf8').toString('hex');
  assert.ok(CELO_ATTRIBUTION_SUFFIX.includes(tagBytes), 'Suffix must contain celo_9f7deabd99a6 hex bytes');
});

test('TakerControl EIP-712 Typed Signature Generation', async () => {
  const takerAddress = '0xc519729BF6D15e5984702BBa2C553f1c74A73C95';
  let recordedDomain = null;
  let recordedTypes = null;
  let recordedValue = null;

  const mockSignTypedData = async ({ domain, types, primaryType, message }) => {
    recordedDomain = domain;
    recordedTypes = types;
    recordedValue = message;
    return '0x' + '11'.repeat(65);
  };

  const proof = await createTakerProofOfControl({
    takerAddress,
    signTypedDataFn: mockSignTypedData,
    chainId: 42220,
  });

  assert.ok(proof.signature.startsWith('0x'));
  assert.ok(proof.nonce.startsWith('0x'));
  assert.equal(typeof proof.issuedAt, 'number');

  assert.equal(recordedDomain.name, 'Textile Taker Control');
  assert.equal(recordedDomain.version, '1');
  assert.equal(recordedDomain.chainId, 42220);
  assert.equal(recordedValue.taker.toLowerCase(), takerAddress.toLowerCase());
  assert.equal(recordedValue.chainId, 42220n);
  assert.ok(recordedTypes.TakerControl);
});

test('Live Textile FX v2 RFQ Preview for USD₮ -> cNGN Corridor', async () => {
  const preview = await getIndicativePreview({
    sellToken: CELO_USDT_ADDRESS,
    buyToken: CELO_CNGN_ADDRESS,
    sellAmount: '1000000', // 1 USD₮
  });

  if (preview.status === 'no_quote') {
    assert.ok(preview.routing);
  } else {
    assert.equal(preview.status, 'preview');
    assert.ok(Number(preview.formattedBuyAmount) > 1000, '1 USD₮ should yield > 1,000 cNGN');
    assert.ok(Number(preview.effectiveRate) > 1000, 'Exchange rate should be > 1,000 cNGN/USD₮');
    console.log(`\n  [LIVE RFQ PREVIEW] 1 USD₮ -> ${preview.formattedBuyAmount} cNGN (Rate: ${preview.effectiveRate})`);
  }
});

test('Live Textile FX v2 RFQ Preview for Reverse cNGN -> USD₮ Corridor', async () => {
  const preview = await getIndicativePreview({
    sellToken: CELO_CNGN_ADDRESS,
    buyToken: CELO_USDT_ADDRESS,
    sellAmount: '1500000000', // 1,500 cNGN
  });

  if (preview.status === 'no_quote') {
    assert.ok(preview.routing);
  } else {
    assert.equal(preview.status, 'preview');
    assert.ok(Number(preview.formattedBuyAmount) > 0.5, '1500 cNGN should yield > 0.5 USD₮');
    console.log(`  [LIVE RFQ REVERSE PREVIEW] 1,500 cNGN -> ${preview.formattedBuyAmount} USD₮ (Rate: ${preview.effectiveRate})`);
  }
});

test('Bundled Multi-Maker Swap Execution Validation', async () => {
  const mockQuoteResponse = {
    id: 'rfq_live_mock_test_123',
    transactions: {
      swap: {
        to: TEXTILE_FX_ROUTER,
        data: '0x12345678',
        value: '0',
      },
    },
    orders: [
      { maker: '0x1111111111111111111111111111111111111111' },
      { maker: '0x2222222222222222222222222222222222222222' },
    ],
  };

  const prepared = prepareSwapExecution(mockQuoteResponse, '0xc519729BF6D15e5984702BBa2C553f1c74A73C95');
  assert.equal(prepared.to.toLowerCase(), TEXTILE_FX_ROUTER.toLowerCase());
  assert.ok(hasAttributionSuffix(prepared.data), 'Prepared swap transaction must have ERC-8021 attribution suffix');
  assert.equal(prepared.bundledMakerCount, 2, 'Must record bundled maker count');
});
