# Altana Agent Wallets — Phase 2.6 Security Remediation & Phase 3 UI Report

> **Protocol**: NairaTag on Celo (`Chain ID: 42220`)  
> **Track**: Track 4 — Altana Agent Wallets (Agents Open for Business Hackathon)  
> **Phase**: Phase 2.6 Security Remediation & Phase 3 UI Implementation  
> **Date**: November 21, 2026  
> **Status**: **PASSED (28/28 Tests Passing, Production UI Built & Integrated)**  
> **Security Boundary**: **NO UNAUTHORIZED MAINNET TRANSACTIONS BROADCAST**

---

## Executive Summary

Phase 2.6 resolves three critical security boundary issues identified during the Phase 2.5 audit and delivers the **Phase 3 User Interface: Altana Session Manager (`AltanaSessionCard.jsx`)**. 

1. **ERC-20 Approvals Removed from Default Agent Policies**: Generic unconstrained `approve(address,uint256)` calls are strictly prohibited from agent sessions. Unconstrained approvals represented an allowance bypass vector where an agent could authorize third-party spenders to drain the smart account via `transferFrom`.
2. **Recipient Restrictions Enforced for Token Transfers**: Direct `transfer(address,uint256)` permissions now bind the recipient argument at the parameter level. For human-approved tasks and bookings, payouts can only target the verified worker or creator address via `buildTaskPaymentPolicy`.
3. **WebAuthn Biometric Passkey Browser Verification**: Verified the dual-mode signer architecture: native WebAuthn (P256) via OS keychains in real browsers, and `createHeadlessPasskeySigner()` for automated CI/CD testing.
4. **Session Key In-Memory Security Boundary**: Documented the ephemeral in-memory lifecycle of session private keys. The application refuses to dump raw private keys into insecure persistent browser storage (`localStorage`), preserving non-custodial integrity.
5. **Phase 3 UI Delivered**: Built and integrated `AltanaSessionCard.jsx` into both the `Pay` tab (Track 4 pill) and `Agents` tab in `App.jsx`.

---

## Part A: Security Remediation Analysis

### 1. ERC-20 Approval Restrictions (Resolving the Spending Bypass)

#### The Vulnerability
In a standard smart account delegation, an agent granted `{ to: tokenAddress, signature: "approve(address,uint256)" }` could execute:
```solidity
token.approve(attackerAddress, type(uint256).max);
```
Although Altana enforces a spend limit on direct token transfers initiated by the agent, `approve` creates an external allowance for a third party. The third party could then call `transferFrom` directly on the token contract to drain the wallet, completely bypassing the agent's spend limits.

#### The Remediation
1. **Removed from Defaults**: `approve` has been removed from `CELO_VERIFIED_PERMISSIONS.tokens` and `buildStandardAgentPolicy`.
2. **Generic Approvals Prohibited**: `buildSessionPolicy` now inspects all call rules. If a rule specifies `approve(address,uint256)`, it MUST include an explicit `spender` address and a positive `maxAllowance` (bigint). Generic unconstrained approvals throw:
   ```
   "Unrestricted ERC-20 approve permission is prohibited. Approvals can bypass spending allowances; approvals must be explicitly bounded to a verified spender address."
   ```
3. **Execution-Time Verification**: In `executeAgentAction`, if an agent attempts to execute an `approve` call (`0x095ea7b3`), the calldata is decoded. If the attempted spender is not authorized or the attempted allowance exceeds `maxAllowance`, the call is rejected before relay dispatch.
4. **Automated Test Evidence**: `test/altana-wallet.test.js` includes a dedicated test verifying that unconstrained approval attempts revert immediately.

---

### 2. Recipient Restrictions (Binding Task and Booking Payouts)

#### The Vulnerability
A call rule permitting `{ to: tokenAddress, signature: "transfer(address,uint256)" }` restricts the destination contract (e.g. USD₮ or cNGN) and the function selector (`0xa9059cbb`), but the EVM arguments (`recipient`, `amount`) are dynamic. Without parameter-level validation, an agent could transfer tokens to an arbitrary unverified address up to its spend allowance.

#### The Remediation
1. **Recipient-Bound Rule Schema**: `buildSessionPolicy` supports `{ to: token, signature: 'transfer(address,uint256)', recipient: getAddress(authorizedRecipient) }`.
2. **Calldata Parameter Decoding**: In `executeAgentAction`, calldata starting with `0xa9059cbb` decodes the recipient parameter:
   ```javascript
   const attemptedRecipient = getAddress('0x' + calldata.slice(34, 74));
   ```
   If the matching rule defines `recipient`, it verifies:
   ```javascript
   if (matchedRule.recipient.toLowerCase() !== attemptedRecipient.toLowerCase()) {
     throw new Error(`Transfer recipient is not authorized by the Altana session policy. Expected: ${matchedRule.recipient}, Attempted: ${attemptedRecipient}`);
   }
   ```
3. **Task & Booking Policy Builder**: Added `buildTaskPaymentPolicy({ recipientAddress, tokenAddress, amount, expiryDurationSeconds })`. When a human approves a task or booking deliverable, the session policy binds:
   - Destination: USD₮ or cNGN token contract
   - Selector: `transfer(address,uint256)`
   - Recipient: Exact verified worker NairaTag address
   - Spend Cap: Exact reward amount
   - Expiration: Short duration (default 2 hours)
4. **Automated Test Evidence**: `test/altana-wallet.test.js` validates that transfers to unauthorized recipients are rejected with strict pre-flight errors.

---

### 3. WebAuthn Biometric Passkeys vs Headless Signers

The system cleanly distinguishes between real browser passkeys and automated testing signers:

| Environment | Signer Implementation | Key Storage | User Interaction |
|---|---|---|---|
| **Real Browser** (iOS, Android, macOS, Windows) | `createAltanaPasskeyWallet` / `recoverAltanaPasskeyWallet` | OS Secure Enclave / TPM (P256) | Biometric prompt (TouchID, FaceID, Windows Hello) |
| **Node.js / CI / Scripts** | `createHeadlessPasskeySigner` | In-Memory Porto P256 Keypair | Zero prompt (Automated) |
| **Funding Source** (MetaMask, Rabby, MiniPay) | EOA Extension Wallet | Browser Extension | Standard Web3 Send (Deposit to Smart Account) |

- Added `isWebAuthnSupported()` helper to check native `PublicKeyCredential` support.
- In `AltanaSessionCard.jsx`, if WebAuthn is supported, the user gets native biometric onboarding; if in a headless or testing environment, the UI gracefully defaults to the hardware-derived admin signer.

---

### 4. Session Recovery & Safe Storage Boundaries

- **Why Private Keys Must Not Be Stored in `localStorage`**:
  `localStorage` is accessible to any script running in the browser origin. Storing raw session private keys in `localStorage` creates an XSS vulnerability where malicious code could steal the key and exhaust the agent's spend allowance.
- **The Implemented Boundary**:
  - `serializeAgentSession` preserves ONLY public metadata: `{ walletAddress, publicKey, permissions, expiry, keyId }`.
  - The session private key (`sessionSigner._privateKey`) is held **strictly in-memory** during the active browser session.
  - Upon page reload, the active session in-memory handle resets. The UI detects the public metadata and provides a 1-click "Re-Authorize Session" prompt using the biometric passkey.
  - This eliminates secret leakage without compromising non-custodial ownership.

---

## Part B: Phase 3 UI Architecture (`AltanaSessionCard.jsx`)

The interactive session manager has been created at `src/components/AltanaSessionCard.jsx` and styled using the NairaTag terminal design system:

```
+-----------------------------------------------------------------------------------+
|  [KEY] Agent Smart Wallet (Altana)                         [Track 4] [EIP-7702]   |
+-----------------------------------------------------------------------------------+
|  1. WALLET ONBOARDING / ACCOUNT CARD                                              |
|     - Passkey Creation ("Create with Passkey") / Recovery ("Recover Wallet")      |
|     - Smart Account Address: 0x... (Copyable, CeloScan link)                      |
|     - Live Balances: Gas (CELO), USD₮ ($), cNGN (₦) with live refresh spinner     |
|     - "How to Fund" advisory explaining MetaMask/MiniPay as funding source        |
+-----------------------------------------------------------------------------------+
|  2. ACTIVE SESSION BADGE & AUDIT STATUS (When active)                             |
|     - Status: Active (Green) / Expired / Revoking / Revoked                       |
|     - Delegated Agent: ₦nairatag (0xc519...3C95)                                 |
|     - Key ID, Expiry Countdown, Grant Tx Link                                     |
|     - [REVOKE SESSION] Button (Biometric authorization, multi-leg verification)   |
+-----------------------------------------------------------------------------------+
|  3. AGENT DELEGATION BUILDER (When granting new session)                          |
|     - Target Agent Input: default ₦nairatag (ERC-8004)                            |
|     - Capabilities: [x] Textile RFQ  [x] ERC-8004 Identity  [ ] Task Payout      |
|     - Security Callout: Generic approvals prohibited; transfers bound             |
|     - Daily Spend Caps: USD₮, cNGN, CELO gas inputs                               |
|     - Expiry Duration: 1h, 6h, 24h, 7d selector                                   |
|     - [AUTHORIZE & GRANT SESSION KEY] Button                                      |
+-----------------------------------------------------------------------------------+
|  4. SESSION AUDIT TRAIL                                                           |
|     - Real-time log of GRANT and REVOKE actions with CeloScan links               |
+-----------------------------------------------------------------------------------+
```

### Integration Points in `src/App.jsx`
1. **Pay Tab Sub-Navigation**: Added the `Agent Wallets (Track 4)` tab pill alongside `USD₮ ⇄ cNGN (Track 1)` and `Send to ₦Tag`.
2. **Agents Tab Banner**: Added a top banner in the `Agents` directory pointing directly to the Altana Session Manager.
3. **Celo Chain Separation**: Ensured all registry strings reference Celo and never Arc.

---

## Part C: Test Results (28/28 Passing)

```
> celo-nairatag@1.0.0 test
> node --test test/*.test.js

✔ resolves a canonical NairaTag and registered voice aliases (10.96ms)
✔ does not route a missing or retired identity to another integration (2.85ms)
✔ asks for clarification when an alias is shared by published agents (0.67ms)
✔ does not confuse a currency amount with a NairaTag mention (4.02ms)
✔ discovers only declared callable capabilities on available integrations (1.39ms)
✔ does not infer a capability from marketing text or a disabled tool (0.42ms)
✔ recognizes explicit capability-discovery requests (1.10ms)
✔ maps public registry identity, aliases, capability and lifecycle fields without exposing runtime config (1.54ms)
✔ Altana Client Configuration & Celo Constants (1.66ms)
✔ Supported Admin Signer Generation & Address Validation (47.34ms)
✔ Session Policy Builder: Contract & Method-Signature Enforcement (2.55ms)
✔ Session Policy Builder: Rejection of Unrestricted Sessions (0.78ms)
✔ Session Serialization & Restoration (Zero Secret Leaks) (2.51ms)
✔ Unauthorized Execution Pre-Flight Rejection (2.10ms)
✔ Revocation Result & Partial Failure Inspection (0.30ms)
✔ Passkey Signer Model: Headless & Biometric P256 Validation (105.46ms)
✔ Celo Deployed Contracts & Function Selector Mathematical Verification (0.79ms)
✔ buildStandardAgentPolicy: Full Suite Composition & Bounds Enforcement (0.80ms)
✔ Security Remediation: Rejection of Unrestricted ERC-20 Approve Bypass Attempts (1.71ms)
✔ Security Remediation: Recipient Restriction Enforcement for Token Transfers (2.45ms)
✔ Security Remediation: buildTaskPaymentPolicy Bound Workflow (0.79ms)
✔ WebAuthn Browser Support Check (0.24ms)
✔ Textile FX Configuration & Corridor Constants (1.83ms)
✔ ERC-8021 Attribution Suffix Integrity (0.54ms)
✔ TakerControl EIP-712 Typed Signature Generation (3.29ms)
✔ Live Textile FX v2 RFQ Preview for USD₮ -> cNGN Corridor (845.30ms)
✔ Live Textile FX v2 RFQ Preview for Reverse cNGN -> USD₮ Corridor (917.99ms)
✔ Bundled Multi-Maker Swap Execution Validation (1.81ms)

ℹ tests 28 | pass 28 | fail 0 | cancelled 0 | duration_ms 3823.84
```

---

## Part D: Readiness & Next Integration Step

| Track | Integration Status | Next Action |
|---|---|---|
| **Track 1: Textile FX Corridors** | Implemented & Preview Verified | Awaiting funded 1.00 USD₮ conversion to external cNGN recipient |
| **Track 4: Altana Agent Wallets** | **Phase 2.6 Remediation + Phase 3 UI Complete** | Ready for live user testing |
| **Track 3: Self Agent ID** | Ready to Start | Implement Self verification gating for agent actions & x402 requests |
| **Track 2: Agent Vault** | Next after Self | Implement web2 checkout and x402 agent settlement |
