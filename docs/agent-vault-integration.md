# Track 2: Agent Vault — Autonomous & Human-Authorized Web Checkout

**Project:** NairaTag on Celo Mainnet (`Chain ID: 42220`)  
**Hackathon Track:** Track 2 — Agent Vault (Agents Open for Business)  
**Production URL:** `https://celo.nairatag.ng`  
**ERC-8021 Attribution:** `celo_9f7deabd99a6` (`0x63656c6f5f396637646561626439396136110080218021802180218021802180218021`)

---

## 1. Executive Summary

Track 2 (**Agent Vault**) establishes an intelligent, non-custodial e-commerce checkout broker for autonomous AI agents on Celo Mainnet. Rather than giving agents unrestricted access to funding wallets or forcing humans into manual checkout for every micro-operation, Agent Vault introduces a **dual-authorization policy engine**:

1. **Autonomous Execution ($\le \$2.00$ USD₮ / $3,000$ cNGN)**: The agent validates merchant cart math, signs the x402 payment proof using its active **Altana Agent Session Key** (Track 4), and completes the checkout instantly without human interruption.
2. **Human Biometric Passkey Authorization ($> \$2.00$ USD₮ / $3,000$ cNGN)**: High-value purchases (e.g. servers, equipment, annual subscriptions) trigger a fail-closed lock. The agent prepares the order and prompts the human operator for 1-click WebAuthn biometric approval before payment execution.
3. **Self Agent ID Human-Proof Verification (Track 3)**: Gated merchant checkouts (e.g. eSIMs, domain purchases, KYC-regulated SaaS) require cryptographic zero-knowledge proof from Self Protocol (`@selfxyz/agent-sdk`) verifying the agent is backed by a legitimate human passport.
4. **Textile FX Cross-Currency Settlement (Track 1)**: When merchant invoice currency differs from vault assets, real-time conversion routes automatically between USD₮ and cNGN.
5. **Instant On-Chain x402 Settlement & Webhook Fulfillment**: Payments settle on Celo Mainnet (`USD₮ 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`, `cNGN 0xa085e46be2c244799ca9810a72ad41c30e38634f`), logs ERC-8021 attribution, and dispatches a signed order receipt.

---

## 2. System Architecture

```
                    ┌────────────────────────┐
                    │    Merchant Website    │
                    │   (Cart / Invoice)     │
                    └───────────┬────────────┘
                                │ Ingest Invoice
                                ▼
                    ┌────────────────────────┐
                    │      Agent Vault       │
                    │     Policy Engine      │
                    └─────┬────────────┬─────┘
                          │            │
            Amount <= $2  │            │ Amount > $2
                          ▼            ▼
               ┌───────────────┐  ┌───────────────────────┐
               │ Altana Active │  │ Human WebAuthn Passkey│
               │ Session Key   │  │ Biometric Approval    │
               │ (Track 4)     │  │ (Fail-Closed)         │
               └───────┬───────┘  └───────────┬───────────┘
                       │                      │
                       └──────────┬───────────┘
                                  │
                       Requires Self ID Check?
                       ┌──────────┴──────────┐
                       │ YES                 │ NO
                       ▼                     │
               ┌───────────────┐             │
               │ Self Protocol │             │
               │ ZK-Passport   │             │
               │ Verification  │             │
               │ (Track 3)     │             │
               └───────┬───────┘             │
                       │                     │
                       └──────────┬──────────┘
                                  │
                                  ▼
                    ┌────────────────────────┐
                    │   On-Chain Settlement  │
                    │   x402 Protocol &      │
                    │   ERC-8021 Attribution │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Merchant Webhook &     │
                    │ Order Receipt Dispatch │
                    └────────────────────────┘
```

---

## 3. Cart Invoice Ingestion & Verification

Agent Vault ingests structured merchant invoices conforming to standard e-commerce carts:

```json
{
  "invoiceId": "inv_compute_7f8a92b",
  "merchant": {
    "name": "CloudNode GPU Infrastructure",
    "recipientAddress": "0x4529bA2389d448D2A1C3C6fA43A70d4D29f87c92",
    "domain": "https://cloudnode.io"
  },
  "items": [
    {"description": "1x L4 GPU Instance (1 hr)", "quantity": 1, "unitPrice": 0.85},
    {"description": "Egress Bandwidth (10 GB)", "quantity": 1, "unitPrice": 0.15}
  ],
  "totalAmount": 1.00,
  "currency": "USDT",
  "expiresAt": 1732190400,
  "requiresSelfVerification": false
}
```

### Invariant Rules
- **Line-item math verification**: Ingestion calculates $\sum (\text{qty} \times \text{unitPrice})$ and rejects invoices where the claimed total deviates by more than $0.001$.
- **Strict expiry check**: Expired invoices (`Date.now() > expiresAt`) are rejected prior to any signing or settlement.
- **Recipient address validation**: Recipient must be a valid Celo checksummed address.

---

## 4. Policy Engine: Autonomous vs. Human Approval

```javascript
import { evaluateVaultCheckoutPolicy } from './services/agentVaultService';

const evaluation = evaluateVaultCheckoutPolicy({
  invoice,
  altanaSession,
  agentIdentity
});

// Returns:
// {
//   authorized: boolean,
//   requiresHumanApproval: boolean,
//   reason: string,
//   policyTier: 'autonomous' | 'human_approval_required',
//   selfVerificationStatus: { required: boolean, verified: boolean }
// }
```

### Thresholds
| Asset | Autonomous Max | Human Approval Trigger |
|---|---|---|
| **USD₮** | $\le 2.00$ USD₮ | $> 2.00$ USD₮ |
| **cNGN** | $\le 3,000$ cNGN | $> 3,000$ cNGN |

If `invoice.requiresSelfVerification === true`, autonomous approval is denied until `agentIdentity.selfVerified === true`.

---

## 5. WebAuthn Biometric Human Approval Flow

For purchases exceeding the autonomous threshold, the user initiates human passkey authorization:

```javascript
import { authorizeVaultCheckout } from './services/agentVaultService';

const authorization = await authorizeVaultCheckout({
  invoiceId: invoice.invoiceId,
  humanSignerAddress: walletAddress,
  reason: 'High-value dedicated server checkout'
});
```

The resulting authorization receipt binds the `invoiceId`, human signer address, timestamp, and challenge digest, unlocking execution for that exact cart.

---

## 6. On-Chain x402 Settlement & ERC-8021 Attribution

The settlement engine executes payment via Celo Mainnet x402 standard:

```javascript
import { settleVaultCheckout } from './services/agentVaultService';

const settlementReceipt = await settleVaultCheckout({
  invoice,
  payerAddress,
  paymentProof,
  humanAuthProof: authorizationReceipt
});
```

### ERC-8021 Attribution Tag
Every checkout includes the immutable Celo hackathon attribution code:
- **Code:** `celo_9f7deabd99a6`
- **Byte Hex:** `0x63656c6f5f396637646561626439396136110080218021802180218021802180218021`

### Settlement Invariants
1. **Challenge Replay Protection**: Single-use challenge digest recorded into durable store (`durablePaymentStore.js`) with atomic mutex locks and Supabase consensus support.
2. **On-Chain Settlement Verification**: Viem checks `publicClient.getTransactionReceipt` to confirm the transaction was included in a finalized Celo block with `status: 'success'`.
3. **Idempotent Webhook Dispatch**: Merchant webhook notification generates a cryptographically signed `orderReceipt` confirming goods/services delivery.

---

## 7. Interactive UI & User Experience

The **Agent Vault Terminal** (`AgentVaultCard.jsx`) is integrated under the **Pay** tab (`payMode === 'vault'`):
- **3 Interactive Presets**:
  1. *Autonomous Compute*: $1.00 USD₮ for 1hr GPU instance — auto-approves via Altana.
  2. *High-Value Dedicated Server*: $45.00 USD₮ server order — triggers 1-click WebAuthn passkey prompt.
  3. *Self ID-Gated eSIM*: $1.50 USD₮ global data eSIM — validates Self ZK-passport backing.
- **Real-Time Visual State**: Cart breakdown, policy evaluation badges, passkey biometric CTA, and on-chain CeloScan transaction explorer links.

---

## 8. Test Coverage

Comprehensive test suite in `test/agent-vault.test.js` covers 11 discrete test vectors:
- Line-item math validation and tamper detection.
- Autonomous approvals within spend limits.
- Bounded spend rejection without human approval.
- WebAuthn biometric passkey authorization binding.
- Self Agent ID human proof gating and rejection.
- Challenge replay prevention and double-spend rejection.
- Expired cart invoice rejection.
