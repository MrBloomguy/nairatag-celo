# Textile FX Corridor: Testing Guide & Verification
## NairaTag on Celo Mainnet (`Chain ID 42220`)

---

## 1. Overview of Test Architecture

The NairaTag Textile FX test suite is divided into three tiers:
1. **Unit Tests**: Offline verification of domain constants, ERC-8021 byte composition, and calldata tagging.
2. **Mock Signature Tests**: Validation of EIP-712 `TakerControl` struct formatting and typing without requiring private keys.
3. **Live Gateway Tests**: Direct HTTP calls against `https://api.textilecredit.com/v2` verifying live maker depth, conversion ratios, and liquidity availability for both USD₮ -> cNGN and cNGN -> USD₮ corridors.

---

## 2. Running the Test Suite

```bash
# Run all tests in the Celo workspace
npm test
```

### Expected Output
```
✔ resolves a canonical NairaTag and registered voice aliases (18.355ms)
✔ does not route a missing or retired identity to another integration (5.1419ms)
✔ asks for clarification when an alias is shared by published agents (1.5408ms)
✔ does not confuse a currency amount with a NairaTag mention (5.5501ms)
✔ discovers only declared callable capabilities on available integrations (1.5722ms)
✔ does not infer a capability from marketing text or a disabled tool (0.4172ms)
✔ recognizes explicit capability-discovery requests (1.1348ms)
✔ maps public registry identity, aliases, capability and lifecycle fields without exposing runtime config (1.2664ms)
✔ Textile FX Configuration & Corridor Constants (6.2328ms)
✔ ERC-8021 Attribution Suffix Integrity (1.0401ms)
✔ TakerControl EIP-712 Typed Signature Generation (5.0238ms)

  [LIVE RFQ PREVIEW] 1 USD₮ -> 1445.467557 cNGN (Rate: 1445.47)
✔ Live Textile FX v2 RFQ Preview for USD₮ -> cNGN Corridor (1014.3141ms)
  [LIVE RFQ REVERSE PREVIEW] 1,500 cNGN -> 1.037104 USD₮ (Rate: 0.000691)
✔ Live Textile FX v2 RFQ Preview for Reverse cNGN -> USD₮ Corridor (2813.5727ms)
✔ Bundled Multi-Maker Swap Execution Validation (1.7757ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
```

---

## 3. Test Cases Breakdown

### 1. ERC-8021 Attribution Suffix Integrity
- Verifies that any calldata payload preserves its original function signature and parameters.
- Validates that the 35-byte suffix `0x6365...8021` is appended to the exact end.
- Decodes the hex string `63656c6f5f396637646561626439396136` back to `celo_9f7deabd99a6`.

### 2. EIP-712 TakerControl Verification
- Validates the domain separator `{ name: 'Textile Taker Control', version: '1', chainId: 42220 }`.
- Validates struct fields `{ taker, chainId, nonce, issuedAt }`.
- Ensures nonce is a valid 32-byte hex string (`0x` + 64 hex characters).

### 3. Live RFQ Preview (USD₮ -> cNGN)
- Issues a live request to `https://api.textilecredit.com/v2/rfq/preview`.
- Validates that 1 USD₮ yields $> 1,000$ cNGN (reflecting current Nigerian exchange rates $\approx 1,445$ cNGN/USD₮).
- Confirms the order router is `LIMIT_ORDER_REACTOR`.

### 4. Live Reverse Preview (cNGN -> USD₮)
- Issues a live request for 1,500 cNGN.
- Confirms output is $\approx 1.037$ USD₮, proving bidirectional liquidity in the corridor.

### 5. Multi-Maker Bundled Swap Validation
- Simulates a firm quote response with multiple maker orders.
- Verifies `prepareSwapExecution` targets `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` and preserves all bundled maker payloads without stripping data.
