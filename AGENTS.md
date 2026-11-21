# NairaTag on Celo · Agents Open for Business

> Autonomous Agent Commerce Protocol & Stablecoin Corridors on Celo Mainnet (`Chain ID 42220`).
> Submission for the Loops House **Agents Open for Business** Hackathon ($5,000 Prize Pool).

---

## 1. What This App Does

**NairaTag on Celo** is an autonomous agent commerce and sovereign identity protocol on Celo Mainnet. It links human-readable tags (`₦tag`) to ERC-8004 verified agent identities, establishes **Self Agent ID** proof-of-human backing for every agent owner, provisions **Altana** non-custodial smart wallets with delegated session keys, and provides cross-currency payment corridors between global dollar stablecoins (USD₮) and local emerging market currencies (cNGN) via Textile FX.

### Four Integrated Tracks:
1. **Track 1: Stablecoin Corridors (Textile FX)**
   - USD₮ ⇄ cNGN cross-currency swaps via Textile FX v2 RFQ (`POST /rfq/preview` & `POST /rfq/request` with EIP-712 `TakerControl`).
   - Multi-maker bundled transaction execution (`transactions.swap`).
   - Cross-currency agent payouts: user/agent pays USD₮, external Nigerian recipient receives native cNGN to their `₦tag`.
   - Guaranteed attribution suffix: `celo_9f7deabd99a6` (ERC-8021 compliant).
2. **Track 2: Agent Vault: Online & Onchain Checkouts**
   - Embedded Agent Vault checkout inside the native Booking Engine.
   - Autonomous spending up to authorized Altana session limits (e.g. 100,000 cNGN / 50 USD₮ daily).
   - Biometric WebAuthn passkey step-up authorization when an invoice or booking exceeds the autonomous limit.
   - On-chain x402 digital dollar settlement with atomic replay protection.
3. **Track 3: Self Agent ID: Verified Agent Payments**
   - Universal proof-of-human identity association for every NairaTag agent owner via `SelfAgentRegistry` (`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`).
   - Zero-knowledge nullifier verification without exposing sensitive passport credentials.
   - Gated execution boundaries: unverified agents cannot publish bookable services, accept task escrow bounties, or authorize agent-to-agent spend.
4. **Track 4: Altana Agent Wallets**
   - Non-custodial smart agent accounts derived on Celo Mainnet (keystore `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c`).
   - Scoped session keys with daily token spend caps, contract execution allowlists, and cryptographic validity windows.
   - 1-transaction monotonic on-chain revocation by the human owner.

---

## 2. Reusable Native Booking Engine Platform Primitive

Built as a native, shared platform primitive — not hardcoded into individual agents:
- **Service Discovery & Registry** (`bookingRegistryService.js`): Any verified NairaTag agent can publish bookable services with standardized fixed, hourly, or quote-based pricing in USD₮ or cNGN.
- **Availability & Double-Booking Prevention** (`availabilityService.js`): Range-aware temporal collision prevention mutex with automatic 15-minute reservation auto-expiry.
- **Provider Approval & Lifecycle** (`bookingService.js`): Supports both instant booking and provider-approval flows (`requested` $\rightarrow$ `provider_accepted` $\rightarrow$ `pending_payment` $\rightarrow$ `confirmed`).
- **Embedded Agent Vault Checkout**: Integrates Altana session key delegation directly into the booking review panel with interactive limit testing and passkey step-up.
- **7-View Panoramic Walkthrough**: Discover Services $\rightarrow$ Service Details $\rightarrow$ Choose Time $\rightarrow$ Review Booking with Embedded Vault $\rightarrow$ Request Created $\rightarrow$ Booking Agent Chat $\rightarrow$ Confirmed Details with Cryptographic Settlement Receipt.
- **Location**: Sub-tab inside `/tasks` (`Tasks & Bounties` vs `Services (Bookable)`).

---

## 3. Verified Contracts & Registries on Celo Mainnet (`Chain ID: 42220`)

| Component | Mainnet Address | Description |
|---|---|---|
| **ERC-8004 Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Standard Agent Identity Registry (Token ID: `10078`) |
| **ERC-8004 Reputation Registry** | `0x8004BAa17C555eb3C924Eb1bc4a41F830ceD9fB2` | Feedback & Scoring Registry |
| **Self Agent ID Registry** | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` | Proof-of-Human Identity & Nullifier Registry |
| **Self Proof Provider** | `0x4b036aFD959B457A208F676cf44Ea3ef73Ea3E3d` | Zero-knowledge identity validator |
| **Altana Smart Keystore** | `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c` | Smart agent account session keystore |
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | Settlement reactor for bundled RFQ swaps |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Token approval standard |
| **USD₮ (Tether USD)** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 decimals |
| **cNGN (Celo Naira)** | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | 6 decimals |
| **Official Platform Agent** | `0xc519729BF6D15e5984702BBa2C553f1c74A73C95` | Registered owner of ERC-8004 Token #10078 |
| **Attribution Tag (ERC-8021)** | `celo_9f7deabd99a6` | Suffix appended to all contract calls & payments |

---

## 4. Key Architecture & File Map

- `src/services/agentLifecycleService.js` — Master 8-state machine orchestrating draft, Self verification, Altana wallet provisioning, session delegation, ERC-8004 registry linking, and active commerce.
- `src/services/agentIdentityStore.js` — Multi-tier durable persistence for agent profiles and session bounds with zero-secret protection.
- `src/services/altanaWalletService.js` — Production Altana SDK integration for non-custodial smart accounts, passkeys, and scoped session keys.
- `src/services/selfAgentIdService.js` — Self Agent ID on-chain verification, nullifier verification, and gated access controls.
- `src/services/bookingService.js` — Booking reservation, double-booking prevention, provider acceptance, and settlement.
- `src/services/bookingRegistryService.js` — Common service schema validation and category directory.
- `src/services/bookingPaymentService.js` — Agent Vault authorization evaluation and x402 digital dollar settlement.
- `src/services/textileRfqService.js` — Textile FX API v2 client (`preview`, `request` with EIP-712 proof of control, cancel, swap execution, ERC-8021 attribution).
- `src/services/corridorPaymentFlow.js` — Cross-currency payment orchestrator (resolve `₦tag` -> Textile swap -> cNGN recipient settlement -> cryptographic receipt).
- `src/components/bookings/BookingMarketplace.jsx` — Comprehensive booking UI with step-by-step and 7-view panoramic walkthrough views.
- `src/components/bookings/PanoramicWalkthroughView.jsx` — Pixel-perfect 7-view grid display matching the master design.

---

## 5. Automated Test Suite (99 / 99 Tests Passing)

```bash
# Run all 99 automated tests across all 7 test suites
node --max-old-space-size=4096 --test test/*.test.js

# Build production bundle
npm run build
```

| Suite | Tests | Result | Focus |
|---|---|---|---|
| `test/agent-lifecycle.test.js` | **20** | `PASSED` | 8-state machine, Self proof gate, Altana wallet provisioning, session limits, revocation, booking E2E |
| `test/agent-vault.test.js` | **11** | `PASSED` | Autonomous checkout, passkey step-up, replay protection, ERC-8021 attribution |
| `test/altana-wallet.test.js` | **15** | `PASSED` | Session policy builder, contract allowlists, passkey signing, ERC-20 approve rejection |
| `test/booking.test.js` | **15** | `PASSED` | Range-aware slot collision, atomic double-booking mutex, 15m hold auto-expiry |
| `test/self-agent-id.test.js` | **25** | `PASSED` | On-chain registry verification, x402 HTTP 402 flow, replay protection, fail-closed boundaries |
| `test/agent-discovery.test.js` | **8** | `PASSED` | Capability discovery, voice alias matching, disambiguation |
| `test/textile-corridor.test.js` | **5** | `PASSED` | Live Textile FX v2 RFQ previews (USD₮ ⇄ cNGN), EIP-712 taker signatures |
| **Total** | **99** | `ALL PASS` | `duration: 7.96s` |

---

## 6. Live Links

- **Production App**: [https://celo.nairatag.ng](https://celo.nairatag.ng)
- **GitHub Monorepo**: [https://github.com/MrBloomguy/nairatag-celo](https://github.com/MrBloomguy/nairatag-celo)
- **CeloScan Explorer**: [https://celoscan.io](https://celoscan.io)
- **QuickNode 8004Scan**: [https://erc-8004.quicknode.com](https://erc-8004.quicknode.com)
