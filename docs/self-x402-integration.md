# x402 Micropayment & Settlement Integration on Celo

## 1. Overview & Protocol Specification

NairaTag implements the **x402 Protocol (HTTP 402 Payment Required)** for native on-chain agent monetization on **Celo Mainnet (`Chain ID 42220`)**.

x402 is an open standard allowing autonomous agents, APIs, and client frontends to request and settle programmatic payments for resource access using native stablecoins without credit card rails or API subscription overhead.

- **Facilitator Base URL**: `https://api.x402.celo.org`
- **Network Identifier**: `eip155:42220` (Celo Mainnet)
- **Settlement Scheme**: `exact`
- **Attribution Tag**: `celo_9f7deabd99a6` (ERC-8021)

---

## 2. Supported Settlement Assets on Celo Mainnet

| Token Symbol | Contract Address | Decimals | Standard |
|---|---|---|---|
| **USD₮ (Tether)** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 | ERC-20 / EIP-3009 |
| **cNGN (Naira)** | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | 18 | ERC-20 / Permit2 |
| **USDC (Circle)** | `0xcebA9300f2b948710d2653d4307a4b0d0239069d` | 6 | ERC-20 / EIP-3009 |

---

## 3. End-to-End Orchestrator Pipeline

```
Caller                   NairaTag Service                  Agent / Downstream
  |                             |                                  |
  |--- 1. Request Capability -->|                                  |
  |    (without payment proof)  |-- Check Self Verification        |
  |                             |   (Requires isVerifiedAgent)     |
  |<- 2. HTTP 402 Challenge --- |                                  |
  |    WWW-Authenticate: x402   |                                  |
  |    { amount, payTo, nonce } |                                  |
  |                             |                                  |
  |--- 3. Settle Payment on ----|                                  |
  |    Celo Mainnet (42220)     |                                  |
  |                             |                                  |
  |--- 4. Submit Request with ->|                                  |
  |    Payment Proof            |-- Cryptographically Verify Proof |
  |                             |   - Network: eip155:42220        |
  |                             |   - PayTo: Agent Owner           |
  |                             |   - Nonce & Timeout fresh        |
  |                             |   - Single-use replay protection |
  |                             |                                  |
  |                             |--- 5. Invoke Protected Work ---->|
  |                             |<-- 6. Return Computation --------|
  |<- 7. HTTP 200 OK ---------- |
  |    { deliverable, receipt } |
```

---

## 4. HTTP 402 Challenge Specification

When an unauthenticated or unpaid request arrives for a gated capability, `selfX402Service.js` returns `HTTP 402`:

```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: x402 token="0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", amount="50000", payTo="0xc519729BF6D15e5984702BBa2C553f1c74A73C95", network="eip155:42220", nonce="0x3f1a..."
Content-Type: application/json

{
  "status": 402,
  "error": "Payment Required",
  "paymentRequirement": {
    "scheme": "exact",
    "network": "eip155:42220",
    "asset": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    "amount": "50000",
    "payTo": "0xc519729BF6D15e5984702BBa2C553f1c74A73C95",
    "nonce": "0x3f1a41e9b28f74a0",
    "maxTimeoutSeconds": 300,
    "resourceId": "cngn_forex_intelligence"
  }
}
```

---

## 5. Verification & Replay Protection Algorithm

To prevent replay attacks across requests, each redeemed payment generates a unique cryptographic digest:

$$\text{paymentDigest} = \text{keccak256}(\text{txHash} \parallel \text{nonce} \parallel \text{amount} \parallel \text{payTo})$$

1. **Network Check**: Must strictly match `eip155:42220`.
2. **Asset Check**: Must match the token contract specified in the requirement.
3. **Recipient Check**: Must match the verified owner address of the target agent (`payTo`).
4. **Amount Check**: Paid token units must be $\ge$ required price.
5. **Freshness Check**: Timestamp must be within `maxTimeoutSeconds` (default: 300s).
6. **Replay Check**: Digest is checked against `consumedPaymentDigests`. If already seen, the request is immediately rejected.
7. **Attribution Tagging**: All executed receipts include the mandatory ERC-8021 suffix `celo_9f7deabd99a6`.
