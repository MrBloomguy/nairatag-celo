# Textile FX Corridor: Security Analysis & Threat Model
## NairaTag on Celo Mainnet (`Chain ID 42220`)

---

## 1. Threat Modeling Overview

| Threat Vector | Mitigation Strategy | Status |
|---|---|---|
| **Front-Running / Sandwich Attacks** | Textile uses private RFQ off-chain signed limit orders routed through `LimitOrderReactor`. Swaps cannot be front-run on public mempools. | Verified |
| **Quote Expiration / Stale Pricing** | Firm quotes carry an explicit 75-second expiration timer (`expiresAt`). NairaTag blocks execution if the quote has lapsed. | Enforced in Client |
| **Unauthorized Swaps / Replay Attacks** | EIP-712 `TakerControl` proof includes 32-byte cryptographically secure random `nonce`, `chainId`, and `issuedAt`. Nonces are unique per request. | Cryptographically Verified |
| **Unlimited Token Approvals** | NairaTag approves exact amounts required for the swap rather than unlimited allowances (`type(uint256).max`). | Enforced in Client |
| **Attribution Stripping** | Suffix `celo_9f7deabd99a6` is appended to both the approval calldata and the reactor execution calldata. | Verified (ERC-8021) |
| **Recipient Tag Spoofing** | Tags are resolved on-chain via `NairaTagResolver` (`primaryTagOf` and `getRecord`) before executing the trade. | Enforced On-Chain |

---

## 2. EIP-712 Proof of Control Specification

To prevent quote harvesting and unauthorized quote requests, Textile FX requires firm quotes to prove taker wallet control:

```solidity
// EIP-712 Domain Separator
{
    name: "Textile Taker Control",
    version: "1",
    chainId: 42220
}

// Struct Definition
struct TakerControl {
    address taker;
    uint256 chainId;
    bytes32 nonce;
    uint256 issuedAt;
}
```

### Cryptographic Nonce Generation
The nonce is generated using cryptographically secure random bytes:
```javascript
const nonceBytes = new Uint8Array(32);
globalThis.crypto.getRandomValues(nonceBytes);
const nonce = '0x' + Array.from(nonceBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
```
This guarantees entropy $\ge 256$ bits, preventing replay attacks across different quote requests.

---

## 3. ERC-8021 Hackathon Attribution Integrity

The hackathon entry attribution tag `celo_9f7deabd99a6` is encoded according to the ERC-8021 specification:
- **ASCII String**: `celo_9f7deabd99a6` (17 bytes: `0x63656c6f5f396637646561626439396136`)
- **Protocol Suffix**: `110080218021802180218021802180218021` (18 bytes standard trailer)
- **Combined Bytecode (35 bytes)**:
  `0x63656c6f5f396637646561626439396136110080218021802180218021802180218021`

### Suffix Guarantee
Before broadcasting, `textileRfqService.js` and `celoPayment.js` inspect the calldata:
```javascript
if (!calldata.toLowerCase().endsWith(CELO_ATTRIBUTION_SUFFIX.slice(2).toLowerCase())) {
  calldata = concat([calldata, CELO_ATTRIBUTION_SUFFIX]);
}
```
This ensures 100% of corridor transactions and token approvals carry the hackathon entry tag.

---

## 4. Allowance & Settlement Safety

1. **Exact-Allowance Approvals**:
   Instead of requesting an infinite allowance, NairaTag checks:
   $$\text{allowance}(\text{taker}, \text{reactor}) \ge \text{requiredAmount}$$
   If insufficient, it prompts the user to approve only the exact amount needed for that swap.
2. **Atomic Execution**:
   The returned swap transaction interacts directly with `LimitOrderReactor` (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`), which executes maker limit orders via Permit2 in a single atomic transaction.
