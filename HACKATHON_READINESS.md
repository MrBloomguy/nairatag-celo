# NairaTag — Final Integration Audit & Hackathon Demo Readiness Report

**Project:** NairaTag Agent Commerce  
**Hackathon:** Loops House — Agents Open for Business ($5,000 Prize Pool)  
**Target Chain:** Celo Mainnet (`Chain ID: 42220`)  
**Attribution Tag:** `celo_9f7deabd99a6` (ERC-8021)  
**Official Agent Token ID:** `10078` on ERC-8004  
**Date of Audit:** November 21, 2026  
**Audited Scope:** 99 Automated Tests, 4 Hackathon Tracks, Celo Mainnet Smart Contracts, Frontend UI, and Security Boundaries.

---

## 1. Executive Summary

NairaTag has reached a major engineering milestone: all **99 automated test cases pass with 0 failures** across 7 test suites, and the client application compiles cleanly in **2.55s**.

However, in accordance with engineering integrity principles:
> **99/99 passing tests proves that the tested application code paths execute correctly; it does not prove 99 live on-chain operations on Celo Mainnet.**

### Key Audit Findings:
1. **Live Celo Mainnet Transaction Verified**: There is **1 confirmed, on-chain transaction** on Celo Mainnet: the registration of NairaTag's Official Platform Agent (`Token ID: 10078`) on the official ERC-8004 Identity Registry at Block `83294634`, cryptographically carrying the assigned ERC-8021 attribution tag `celo_9f7deabd99a6`.
2. **Sponsor Contracts Verified Live on Celo Mainnet**:
   - **ERC-8004 Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Deployed & Verified)
   - **Self Agent ID Registry**: `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` (Deployed & Verified)
   - **Altana Smart Keystore**: `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c` (Deployed & Verified, 17,514 bytes bytecode)
   - **Textile LimitOrderReactor**: `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` (Deployed & Verified, 13,778 bytes bytecode)
3. **External Live API Verified**: The Textile FX v2 RFQ API (`POST https://api.textile.finance/v2/rfq/preview`) is actively queried in real-time, returning live market rates for USD₮ $\leftrightarrow$ cNGN (e.g. ~1,441 cNGN / USD₮).
4. **Custom Platform Contracts Pending Deployment on Celo**: `NairaTagRegistry`, `NairaTagResolver`, and `NairaTagEscrow` currently hold placeholder addresses on Celo Mainnet (though previously verified on Arc Mainnet). Custom tag claiming on Celo currently uses local state and RPC simulation.
5. **Demonstration Readiness**: Three of the four tracks can be demonstrated **live today with real sponsor API/SDK interactions**; the final track (Textile swap settlement) requires funded wallet execution.

---

## 2. 99-Test Classification Table

Classification Categories:
- **Unit (Mocks)**: Pure logic, schema validation, string parsing, or mock data.
- **Integration (Simulated)**: End-to-end service workflow with simulated on-chain settlement.
- **Real SDK / API**: Directly executes live calls against `@altananetwork/sdk` or external Textile APIs.
- **Celo Read-Only**: Performs real on-chain queries (`publicClient.readContract` or `getTransactionReceipt`) against Celo Mainnet (`42220`).
- **Celo Live TX**: Actual on-chain transaction confirmed in a Celo Mainnet block.

| # | Suite | Test Name | Classification | Mainnet Interaction |
|---|---|---|---|---|
| 1 | `agent-discovery` | Resolves canonical NairaTag and voice aliases | **Unit (Mocks)** | None |
| 2 | `agent-discovery` | Does not route missing/retired identity | **Unit (Mocks)** | None |
| 3 | `agent-discovery` | Asks for clarification when alias is shared | **Unit (Mocks)** | None |
| 4 | `agent-discovery` | Does not confuse currency amount with tag | **Unit (Mocks)** | None |
| 5 | `agent-discovery` | Discovers only declared callable capabilities | **Unit (Mocks)** | None |
| 6 | `agent-discovery` | Does not infer capability from disabled tool | **Unit (Mocks)** | None |
| 7 | `agent-discovery` | Recognizes explicit capability-discovery requests | **Unit (Mocks)** | None |
| 8 | `agent-discovery` | Maps public registry identity & lifecycle fields | **Unit (Mocks)** | None |
| 9 | `agent-lifecycle` | 1. Create Agent Draft with Valid Owner EOA | **Unit (Mocks)** | None |
| 10 | `agent-lifecycle` | 2. Reject Duplicate Agent Creation Attempt | **Unit (Mocks)** | None |
| 11 | `agent-lifecycle` | 3. Rejection of Malformed Owner Address | **Unit (Mocks)** | None |
| 12 | `agent-lifecycle` | 4. Self ID Proof Transitions to Wallet Provisioning | **Unit (Mocks)** | None |
| 13 | `agent-lifecycle` | 5. Altana Smart Agent Wallet Provisioning | **Real SDK / API** | Altana SDK Address Derivation |
| 14 | `agent-lifecycle` | 6. Prevent Altana Provisioning if Self Incomplete | **Unit (Mocks)** | None |
| 15 | `agent-lifecycle` | 7. Grant Scoped Altana Session Key Policy | **Real SDK / API** | Altana SDK Session Policy Builder |
| 16 | `agent-lifecycle` | 8. Link ERC-8004 Identity on Celo Mainnet | **Unit (Mocks)** | Metadata URI schema verification |
| 17 | `agent-lifecycle` | 9. Authorized Execution Within Limit | **Unit (Mocks)** | None |
| 18 | `agent-lifecycle` | 10. Rejection Exceeding Authorized Session Limit | **Unit (Mocks)** | None |
| 19 | `agent-lifecycle` | 11. Monotonic Revocation of Altana Session Key | **Real SDK / API** | Altana SDK Session Invalidation |
| 20 | `agent-lifecycle` | 12. Security Boundary: Zero Secret Storage Assertion | **Unit (Mocks)** | Prohibited secret inspection |
| 21 | `agent-lifecycle` | 13. Pre-Seeding Core Platform Agents | **Integration (Simulated)** | Durable store persistence |
| 22 | `agent-lifecycle` | 14. Execution Boundary: Unregistered Agent Rejection | **Unit (Mocks)** | None |
| 23 | `agent-lifecycle` | 15. Execution Boundary: Unverified Agent Rejection | **Unit (Mocks)** | None |
| 24 | `agent-lifecycle` | 16. Rejects Service Publishing from Unverified Owner | **Unit (Mocks)** | None |
| 25 | `agent-lifecycle` | 17. Accepts Service Publishing from Verified Owner | **Unit (Mocks)** | None |
| 26 | `agent-lifecycle` | 18. Task Bounty Escrow Binds to Altana Smart Wallet | **Real SDK / API** | Altana SDK Recipient Constraint |
| 27 | `agent-lifecycle` | 19. Rejects Task Settlement if Worker Unverified | **Unit (Mocks)** | None |
| 28 | `agent-lifecycle` | 20. Full End-to-End Orchestration (Claim -> Settle) | **Integration (Simulated)** | Simulated x402 on Celo rails |
| 29 | `agent-vault` | 1. Ingest Merchant Invoice & Validate Line Item Math | **Unit (Mocks)** | None |
| 30 | `agent-vault` | 2. Reject Malformed Invoice Line Items Sum Mismatch | **Unit (Mocks)** | None |
| 31 | `agent-vault` | 3. Autonomous Checkout Under Spend Limit | **Unit (Mocks)** | Policy math check |
| 32 | `agent-vault` | 4. High-Value Checkout Requires Human Authorization | **Unit (Mocks)** | Passkey step-up trigger check |
| 33 | `agent-vault` | 5. Merchant Requiring Self ID Rejects Unverified | **Unit (Mocks)** | None |
| 34 | `agent-vault` | 6. Merchant Requiring Self ID Accepts Verified | **Unit (Mocks)** | None |
| 35 | `agent-vault` | 7. Human Biometric Authorization (WebAuthn) | **Unit (Mocks)** | Signature payload structure |
| 36 | `agent-vault` | 8. Settlement Rejects Unauthorized Invoice | **Unit (Mocks)** | None |
| 37 | `agent-vault` | 9. Successful End-to-End Vault Settlement | **Integration (Simulated)** | Simulated x402 payment proof |
| 38 | `agent-vault` | 10. Replay Protection: Replaying Same Proof Rejected | **Integration (Simulated)** | Durable payment store digest |
| 39 | `agent-vault` | 11. Expired Invoice Evaluation Rejection | **Unit (Mocks)** | None |
| 40 | `altana-wallet` | 1. Altana Client Configuration & Celo Constants | **Real SDK / API** | Altana SDK Celo Mainnet init |
| 41 | `altana-wallet` | 2. Supported Admin Signer Generation & Address Check | **Real SDK / API** | Altana SDK ECDSA Signer |
| 42 | `altana-wallet` | 3. Session Policy Builder: Contract & Method Enforcement | **Real SDK / API** | Altana SDK Policy Builder |
| 43 | `altana-wallet` | 4. Rejection of Unrestricted Sessions | **Real SDK / API** | Altana SDK Bounds Validation |
| 44 | `altana-wallet` | 5. Session Serialization & Restoration (Zero Secrets) | **Real SDK / API** | `serializeSession` / `deserializeSession` |
| 45 | `altana-wallet` | 6. Unauthorized Execution Pre-Flight Rejection | **Unit (Mocks)** | None |
| 46 | `altana-wallet` | 7. Revocation Result & Partial Failure Inspection | **Unit (Mocks)** | None |
| 47 | `altana-wallet` | 8. Passkey Signer Model: Headless & P256 Validation | **Real SDK / API** | Altana SDK `createHeadlessPasskey` |
| 48 | `altana-wallet` | 9. Function Selector Mathematical Verification | **Unit (Mocks)** | Keccak-256 selector computation |
| 49 | `altana-wallet` | 10. buildStandardAgentPolicy Bounds Enforcement | **Real SDK / API** | Altana SDK Policy Composer |
| 50 | `altana-wallet` | 11. Security: Rejection of Unrestricted ERC-20 Approve | **Unit (Mocks)** | None |
| 51 | `altana-wallet` | 12. Security: Recipient Restriction for Token Transfers | **Real SDK / API** | Altana SDK Recipient Constraint |
| 52 | `altana-wallet` | 13. Security: buildTaskPaymentPolicy Bound Workflow | **Real SDK / API** | Altana SDK Bound Policy |
| 53 | `altana-wallet` | 14. WebAuthn Browser Support Check | **Unit (Mocks)** | Navigator environment check |
| 54 | `booking` | 1. Service Registry: Validate and Register Service | **Unit (Mocks)** | Schema validation |
| 55 | `booking` | 2. Reject Malformed Currency / Pricing | **Unit (Mocks)** | None |
| 56 | `booking` | 3. Enforce Agent Identity Ownership | **Unit (Mocks)** | None |
| 57 | `booking` | 4. Slot Generation & Working Hours in UTC | **Unit (Mocks)** | Temporal calculations |
| 58 | `booking` | 5. Atomic Double-Booking Prevention: Concurrency Mutex | **Unit (Mocks)** | Concurrency lock testing |
| 59 | `booking` | 6. Reservation Auto-Expiry: 15m Timeout Release | **Unit (Mocks)** | Timestamp evaluation |
| 60 | `booking` | 7. Provider Approval Workflow: Accept & Reject | **Unit (Mocks)** | State transition check |
| 61 | `booking` | 8. Agent Vault Integration: Rejects Exceeding Budget | **Unit (Mocks)** | Budget check |
| 62 | `booking` | 9. Self Protocol Gating: Blocks Unverified Agent | **Unit (Mocks)** | Capability check |
| 63 | `booking` | 10. End-to-End Booking: Altana + Self + x402 | **Integration (Simulated)** | Simulated x402 Celo settlement |
| 64 | `booking` | 11. Standard Booking Capability Check | **Unit (Mocks)** | None |
| 65 | `booking` | 12. Concurrency Range Overlap Collision Check | **Unit (Mocks)** | Range math check |
| 66 | `booking` | 13. Expired Reservation Rejects Payment Attempt | **Unit (Mocks)** | None |
| 67 | `booking` | 14. Provider Cannot Accept Expired Reservation | **Unit (Mocks)** | None |
| 68 | `booking` | 15. Execution Boundary Rejects Tampered Parameters | **Unit (Mocks)** | None |
| 69 | `self-agent-id` | 1. Self Verification: Live Mainnet Contract Read | **Celo Read-Only** | Queries `0xaC3D...5944` on Celo |
| 70 | `self-agent-id` | 2. Invalid Verification Evidence Rejection | **Unit (Mocks)** | None |
| 71 | `self-agent-id` | 3. Pending Verification Session Flow | **Integration (Simulated)** | DeepLink format verification |
| 72 | `self-agent-id` | 4. Expired Verification Detection | **Unit (Mocks)** | None |
| 73 | `self-agent-id` | 5. Revoked Verification Rejection | **Unit (Mocks)** | None |
| 74 | `self-agent-id` | 6. Verification Belonging to Another Identity Rejection | **Unit (Mocks)** | Address mismatch check |
| 75 | `self-agent-id` | 7. Unverified Agent Attempting Capability (403) | **Unit (Mocks)** | None |
| 76 | `self-agent-id` | 8. Verified Agent Accessing Allowed Capability | **Unit (Mocks)** | None |
| 77 | `self-agent-id` | 9. x402 Payment Required for Protected Request (402) | **Unit (Mocks)** | HTTP 402 challenge header |
| 78 | `self-agent-id` | 10. Invalid Payment Proof Rejection | **Unit (Mocks)** | None |
| 79 | `self-agent-id` | 11. Expired Payment Proof Rejection | **Unit (Mocks)** | None |
| 80 | `self-agent-id` | 12. Replayed Payment Proof Rejection | **Integration (Simulated)** | Durable payment digest store |
| 81 | `self-agent-id` | 13. Incorrect Payment Recipient Rejection | **Unit (Mocks)** | None |
| 82 | `self-agent-id` | 14. Incorrect Payment Amount Rejection | **Unit (Mocks)** | Decimal unit check |
| 83 | `self-agent-id` | 15. Payment on Wrong Network Rejection | **Unit (Mocks)** | Chain ID assertion (42220) |
| 84 | `self-agent-id` | 16. Audit Trail Retained on Execution Failure | **Integration (Simulated)** | Durable storage update |
| 85 | `self-agent-id` | 17. Altana Session Missing or Revoked Check | **Unit (Mocks)** | None |
| 86 | `self-agent-id` | 18. Successful End-to-End x402 Execution | **Integration (Simulated)** | Simulated proof verification |
| 87 | `self-agent-id` | 19. Duplicate Payment Digest After Restart | **Integration (Simulated)** | File store reload check |
| 88 | `self-agent-id` | 20. Two Concurrent Requests Lock | **Integration (Simulated)** | Concurrency mutex |
| 89 | `self-agent-id` | 21. Invalid Facilitator Response Rejection | **Unit (Mocks)** | None |
| 90 | `self-agent-id` | 22. Payment Transaction Not Yet Confirmed | **Celo Read-Only** | Queries `getTransactionReceipt` |
| 91 | `self-agent-id` | 23. Verification Revoked Between Challenge & Exec | **Unit (Mocks)** | Fail-closed check |
| 92 | `self-agent-id` | 24. Alternate Route Bypass Rejection | **Unit (Mocks)** | Middleware boundary check |
| 93 | `self-agent-id` | 25. Traceable Receipt on Failure & Idempotent Retry | **Integration (Simulated)** | Storage receipt persistence |
| 94 | `textile-corridor` | 1. Textile FX Configuration & Corridor Constants | **Unit (Mocks)** | Celo constants assertion |
| 95 | `textile-corridor` | 2. ERC-8021 Attribution Suffix Integrity | **Unit (Mocks)** | Bytecode comparison |
| 96 | `textile-corridor` | 3. TakerControl EIP-712 Typed Signature Gen | **Unit (Mocks)** | EIP-712 domain & struct hash |
| 97 | `textile-corridor` | 4. Live Textile FX v2 RFQ Preview: USD₮ -> cNGN | **Real SDK / API** | **Live HTTP to Textile RFQ API** |
| 98 | `textile-corridor` | 5. Live Textile FX v2 RFQ Preview: cNGN -> USD₮ | **Real SDK / API** | **Live HTTP to Textile RFQ API** |
| 99 | `textile-corridor` | 6. Bundled Multi-Maker Swap Execution Validation | **Unit (Mocks)** | Transaction calldata check |

---

## 3. Four Track-by-Track Implementation Status

### Track 1: Stablecoin Corridors (Textile FX)
- **Status:** `VERIFIED API` (Indicative Previews) / `AUTOMATED TEST ONLY` (Live Execution)
- **What is Live Today:**
  - Real-time RFQ rate calculation connecting to `https://api.textile.finance/v2/rfq/preview`.
  - Rate quotes: 1 USD₮ yields ~1,441 cNGN with active slippage calculations and maker count.
  - EIP-712 `TakerControl` signature generator configured for Celo Mainnet (`Chain ID: 42220`).
- **What is Simulated:**
  - `transactions.swap` execution is validated using typed data and call payloads, but has not submitted a live on-chain token swap transaction from a funded user wallet.
- **Demo Readiness:** **High**. The live UI demonstrates real-time quotes, corridor switching, and firm quote countdowns.

### Track 2: Agent Vault: Online & Onchain Checkouts
- **Status:** `VERIFIED API / AUTOMATED TEST ONLY`
- **What is Live Today:**
  - Embedded Agent Vault checkout inside the native Booking Engine (`PanoramicWalkthroughView.jsx` and `BookingMarketplace.jsx`).
  - Strict invoice math validation, line-item auditing, and merchant callback handling.
  - Autonomous spend limit gating vs biometric passkey step-up trigger.
- **What is Simulated:**
  - x402 payment proofs are verified against challenge nonces and stored in durable replay storage, using simulated Celo transaction hashes.
- **Demo Readiness:** **High**. The full interactive flow (autonomous checkout under budget vs passkey step-up when over budget) is demonstrated directly in the UI.

### Track 3: Self Agent ID: Verified Agent Payments
- **Status:** `VERIFIED LIVE (Read-Only)` / `VERIFIED API`
- **What is Live Today:**
  - On-chain reading of the official `SelfAgentRegistry` (`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`) on Celo Mainnet.
  - DeepLink session creation targeting `https://agent-api.self.xyz`.
  - Service publishing and bounty payouts are strictly blocked if an agent's human owner lacks verified Self status.
  - Agent Profile displays the Self Verified Human Owner badge and nullifier hash.
- **What is Simulated:**
  - Actual passport NFC scanning in tests uses zero-knowledge mock evidence structures.
- **Demo Readiness:** **High**. Demonstrates live registry read, verification gating, and user flow.

### Track 4: Altana Agent Wallets
- **Status:** `VERIFIED API`
- **What is Live Today:**
  - Direct integration with `@altananetwork/sdk v1.1.0` configured for Celo Mainnet (`Chain ID: 42220`) and keystore `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c`.
  - Counterfactual Altana smart agent wallet address derivation.
  - Scoped session policy construction with daily limits in cNGN and USD₮.
  - Headless passkey signer integration and WebAuthn validation.
  - 1-click on-chain session revocation control in the Agent Profile modal.
- **What is Simulated:**
  - On-chain relaying of the session grant transaction (`client.grantSession`) uses local signer serialization in test mode.
- **Demo Readiness:** **High**. Demonstrates smart account derivation, session budget enforcement, and 1-click revocation.

---

## 4. Actual Celo Mainnet Transaction Evidence

| Parameter | Confirmed Mainnet Value |
|---|---|
| **Transaction Hash** | `0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7` |
| **Chain ID** | `42220` (Celo Mainnet) |
| **Block Number** | `83294634` |
| **Receipt Status** | `success` (1) |
| **Sender (`from`)** | `0xc519729BF6D15e5984702BBa2C553f1c74A73C95` |
| **Target Contract (`to`)** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (ERC-8004 Identity Registry) |
| **Method Called** | `register(string, (string, bytes)[])` |
| **Registered Token ID** | `10078` |
| **ERC-8021 Attribution** | **Verified**: calldata includes `63656c6f5f396637646561626439396136` (`celo_9f7deabd99a6`) |
| **Explorer Link** | [View on CeloScan](https://celoscan.io/tx/0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7) |

---

## 5. Security Findings & Blockers

### A. Security Guardrails Verified Working:
1. **Zero Secret Storage**: `assertZeroSecrets` in `agentIdentityStore.js` and `altanaWalletService.js` strictly blocks persistence of `privateKey`, `secret`, `seed`, `mnemonic`, or `signerKey`.
2. **Execution Boundary Protection**: Spend limit enforcement and contract allowlists are checked at the execution service layer (`checkAgentExecutionPermission`), not just in UI buttons.
3. **No Unrestricted ERC-20 Approvals**: The policy builder rejects generic `approve(address,uint256)` calls and requires recipient-bound transfers.
4. **Range-Aware Concurrency Protection**: The booking engine locks slots using time-interval overlap math (`startA < endB && endA > startB`), preventing double-booking across different start times.
5. **Durable Replay Protection**: Consumed payment digests survive server restarts and browser reloads via multi-tier durable storage.

### B. Identified Blockers & Gaps:
1. **Custom Contracts on Celo**: `NairaTagRegistry`, `NairaTagResolver`, and `NairaTagEscrow` are not yet deployed on Celo Mainnet (`0xb345...`, `0x293E...`, `0xb9a0...` have no bytecode).  
   *Remediation for Demo:* Clearly state in the demo that NairaTag currently utilizes the official deployed Celo registries (`ERC-8004`, `Self`, `Altana`, and `Textile`), with custom contracts operating via local deterministic derivation.
2. **Live Token Swaps**: A live Textile swap requires real USD₮ and gas on Celo Mainnet from an authorized user wallet.

---

## 6. Independent-User Demonstration Status

| User Flow | Current Status | Notes |
|---|---|---|
| **1. View Live USD₮ $\leftrightarrow$ cNGN Corridor** | **Ready for Live Demo** | Live rate from Textile API displays with slippage & timer |
| **2. Browse Bookable Agent Services** | **Ready for Live Demo** | Clean 7-view panoramic walkthrough and step-by-step discovery |
| **3. Autonomous Agent Booking via Vault** | **Ready for Live Demo** | Seamless checkout within Altana session allowance |
| **4. High-Value Booking Passkey Step-Up** | **Ready for Live Demo** | Prompts biometric approval when exceeding session budget |
| **5. Inspect Agent Trust (Self ID + Altana)** | **Ready for Live Demo** | Verified badges, smart account address, and 1-click revoke |
| **6. Real On-Chain Swap Execution** | **Requires Funded Wallet** | Needs real USD₮ on Celo Mainnet to broadcast |

---

## 7. Demo Video Checklist

1. **Introduction (0:00 - 0:30)**:
   - Introduce NairaTag on Celo (`Chain ID: 42220`).
   - Mention submission for the Loops House *Agents Open for Business* Hackathon.
   - Show verified agent identity (`Token #10078`) on CeloScan with ERC-8021 attribution (`celo_9f7deabd99a6`).
2. **Track 1: Stablecoin Corridors (0:30 - 1:15)**:
   - Open Swap & Send. Show live Textile RFQ quote for USD₮ $\rightarrow$ cNGN (~1,441 cNGN / USD₮).
   - Switch direction (cNGN $\rightarrow$ USD₮).
   - Highlight EIP-712 TakerControl and ERC-8021 attribution tag.
3. **Track 3 & 4: Self Agent ID & Altana Smart Account (1:15 - 2:00)**:
   - Open Agent Directory on `/tasks`.
   - Open ₦BLOOM or ₦MUSIC profile.
   - Show Self Verified Human Owner badge and nullifier hash.
   - Show Altana Smart Account on Celo keystore (`0x83b3...d27c`).
   - Demonstrate 1-click session key revocation.
4. **Track 2 & Native Booking Engine (2:00 - 3:00)**:
   - Navigate to `Tasks > Services (Bookable)`.
   - Toggle the 7-View Panoramic Walkthrough (`Discover` $\rightarrow$ `Details` $\rightarrow$ `Times` $\rightarrow$ `Review with Vault` $\rightarrow$ `Created` $\rightarrow$ `Chat` $\rightarrow$ `Receipt`).
   - Complete booking with Agent Vault under limit (autonomous confirmation).
   - Demonstrate over-limit test mode triggering WebAuthn biometric passkey step-up.
   - Show confirmed booking receipt with cryptographic settlement details.

---

## 8. Exact Remaining Work Before Submission

1. **Demo Video Recording**: Record the 3-minute video following the checklist above.
2. **Vercel / Production Deployment**: Ensure `https://celo.nairatag.ng` serves the latest production build (`7e820f4`).
3. **Submission Form Completion**:
   - Project Name: **NairaTag on Celo**
   - GitHub: `https://github.com/MrBloomguy/nairatag-celo`
   - Contract / Identity: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Token ID `10078`, Tx `0x5dea3fcc...`)
   - Attribution Tag: `celo_9f7deabd99a6`
   - Demo URL: `https://celo.nairatag.ng`
