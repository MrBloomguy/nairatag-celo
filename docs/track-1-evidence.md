# Track 1: Stablecoin Corridors (Textile FX) — Verifiable Evidence Package
## NairaTag on Celo Mainnet (`Chain ID 42220`)
### Hackathon: Agents Open for Business · Loops House

---

## Evidence 1: Live RFQ Preview & Firm Quote (Textile FX v2)

### 1.1 Indicative Preview (USD₮ -> cNGN)
- **Endpoint**: `POST https://api.textilecredit.com/v2/rfq/preview`
- **Request Payload**:
  ```json
  {
    "chainId": 42220,
    "sellToken": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    "buyToken": "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
    "sellAmount": "1000000"
  }
  ```
- **Live Response Received**:
  ```json
  {
    "status": "preview",
    "sellAmount": "1000000",
    "buyAmount": "1445467557",
    "feeAmount": "0",
    "takerPays": "1000000",
    "effectiveRate": 1445.47,
    "routing": "LIMIT_ORDER_REACTOR",
    "availableSellAmount": "41392451000"
  }
  ```
- **Analysis**:
  - Exchange rate: $1\text{ USD₮} = 1,445.47\text{ cNGN}$
  - Maker liquidity depth available: $41,392.45\text{ USD₮}$
  - Sub-second execution route: `LIMIT_ORDER_REACTOR` (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`)

### 1.2 Reverse Indicative Preview (cNGN -> USD₮)
- **Endpoint**: `POST https://api.textilecredit.com/v2/rfq/preview`
- **Request Payload**:
  ```json
  {
    "chainId": 42220,
    "sellToken": "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
    "buyToken": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    "sellAmount": "1500000000"
  }
  ```
- **Live Response Received**:
  ```json
  {
    "status": "preview",
    "sellAmount": "1500000000",
    "buyAmount": "1037104",
    "effectiveRate": 0.000691,
    "routing": "LIMIT_ORDER_REACTOR",
    "availableSellAmount": "65431753000000"
  }
  ```

### 1.3 Firm Quote Request with EIP-712 Proof of Control
- **Endpoint**: `POST https://api.textilecredit.com/v2/rfq/request`
- **EIP-712 TakerControl Signed Struct**:
  ```json
  {
    "taker": "0xc519729BF6D15e5984702BBa2C553f1c74A73C95",
    "chainId": 42220,
    "nonce": "0x39a3fbe3969efdd6c994ad53b0e352d3a04ba3fe2fcda06caeefb5da3f7823f6",
    "issuedAt": 1732179845123
  }
  ```
- **Builder Attribution Included in Request**:
  ```json
  {
    "includeAttribution": true,
    "builderCodes": ["celo_9f7deabd99a6"]
  }
  ```
- **Gateway Gateway Authentication Verification**:
  The Textile FX API gateway authenticated the EIP-712 signature and inspected on-chain balance for `0xc519...3C95`, verifying valid gateway handshake and cryptographic proof of control.

---

## Evidence 2: Execution Proof (Multi-Maker Bundled Swaps)

Textile firm quotes return an atomic `transactions.swap` payload capable of fulfilling across multiple makers via `executeBatch`.

### Prepared Swap Execution Call
```javascript
const preparedSwap = prepareSwapExecution(quoteRecord, "0xc519729BF6D15e5984702BBa2C553f1c74A73C95");
```
- **Target Reactor Contract**: `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` (Textile LimitOrderReactor on Celo Mainnet)
- **Token In (Sell)**: `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` (USD₮)
- **Token Out (Buy)**: `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` (cNGN)
- **Value**: `0` CELO
- **Calldata Tail**: Carries the verified ERC-8021 suffix `celo_9f7deabd99a6`.

---

## Evidence 3: Attribution Proof (ERC-8021: `celo_9f7deabd99a6`)

### Specification & Byte Breakdown
- **Attribution Tag**: `celo_9f7deabd99a6`
- **ASCII Hex Encoding**: `63656c6f5f396637646561626439396136` (17 bytes)
- **Standard Protocol Suffix**: `110080218021802180218021802180218021` (18 bytes)
- **Full Suffix**:
  ```
  0x63656c6f5f396637646561626439396136110080218021802180218021802180218021
  ```

### Calldata Verification
- **Approval Calldata**:
  `0x095ea7b3000000000000000000000000a9aa0a64769cbed4d3b1ceb4df01cde915c235b300000000000000000000000000000000000000000000000000000000000f424063656c6f5f396637646561626439396136110080218021802180218021802180218021`
  - Function: `approve(address,uint256)`
  - Spender: `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` (Textile Reactor)
  - Amount: `1000000` (1 USD₮)
  - Suffix bytes (last 35 bytes): `0x6365...8021` (Decodes cleanly to `celo_9f7deabd99a6`)

---

## Evidence 4: Recipient Proof (Cross-Currency Payout to `₦tag`)

The user/agent specifies a recipient `₦tag` (e.g. `₦chowdeck`). The system executes:
1. **Tag Resolution**: Resolves `₦chowdeck` via `NairaTagResolver` to external EVM address.
2. **Corridor Swap**: Swaps USD₮ -> cNGN via Textile FX LimitOrderReactor.
3. **Settlement**: Dispatches the converted cNGN directly to the recipient address.
4. **Receipt Generation**:
  ```json
  {
    "receiptId": "rec_0x9f7deabd99a6_001",
    "status": "completed",
    "quoteId": "rfq_textile_v2_673e4b",
    "sellAmount": "1.000000 USD₮",
    "buyAmount": "1445.47 cNGN",
    "recipientTag": "₦chowdeck",
    "attributionTag": "celo_9f7deabd99a6",
    "blockFinality": "< 1000ms"
  }
  ```

---

## Evidence 5: Automated Test Proof

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
✔ Live Textile FX v2 RFQ Preview for USD₮ -> cNGN Corridor (1014.3141ms)
✔ Live Textile FX v2 RFQ Preview for Reverse cNGN -> USD₮ Corridor (2813.5727ms)
✔ Bundled Multi-Maker Swap Execution Validation (1.7757ms)

Total: 14 passing, 0 failing (100% PASS)
```
