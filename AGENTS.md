# NairaTag on Celo · Agents Open for Business

> Autonomous Agent Commerce Protocol & Stablecoin Corridors on Celo Mainnet (`Chain ID 42220`).
> Submission for the Loops House **Agents Open for Business** Hackathon ($5,000 Prize Pool).

---

## 1. What This App Does

**NairaTag on Celo** is an autonomous agent commerce and sovereign identity protocol on Celo Mainnet. It links human-readable tags (`₦tag`) to ERC-8004 verified agent identities and provides cross-currency payment corridors between global dollar stablecoins (USD₮) and local emerging market currencies (cNGN) via Textile FX.

### Four Integrated Tracks:
1. **Track 1: Stablecoin Corridors (Textile FX)**
   - USD₮ ⇄ cNGN cross-currency swaps via Textile FX v2 RFQ (`POST /rfq/preview` & `POST /rfq/request` with EIP-712 `TakerControl`).
   - Multi-maker bundled transaction execution (`transactions.swap`).
   - Cross-currency agent payouts: user/agent pays USD₮, external Nigerian recipient receives native cNGN to their `₦tag`.
   - Guaranteed attribution suffix: `celo_9f7deabd99a6` (ERC-8021 compliant).
2. **Track 4: Altana Agent Wallets**
   - Non-custodial session key wallets with configurable spend caps, allowlisted contracts, and cryptographic expiration.
3. **Track 3: Self Agent ID: Verified Agent Payments**
   - Verification gating via Self Agent ID and ERC-8004 identity registry.
4. **Track 2: Agent Vault: Online & Onchain Checkouts**
   - Agent checkout execution without credential exposure.

---

## 2. Tech Stack & Environment

- **Frontend**: React 19, Vite, Tailwind CSS, Viem 2.x, Lucide Icons, Canvas Confetti
- **Settlement Chain**: Celo Mainnet (`Chain ID: 42220`)
- **RPC URL**: `https://forno.celo.org`
- **Block Explorer**: [CeloScan](https://celoscan.io)
- **Production URL**: [https://celo.nairatag.ng](https://celo.nairatag.ng)
- **Hackathon Attribution (ERC-8021)**: `celo_9f7deabd99a6` (`0x63656c6f5f396637646561626439396136110080218021802180218021802180218021`)

---

## 3. Verified Contracts & Registries on Celo Mainnet

| Component | Mainnet Address | Description |
|---|---|---|
| **ERC-8004 Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Standard Agent Identity Registry (Token ID: `10078`) |
| **ERC-8004 Reputation Registry** | `0x8004BAa17C555eb3C924Eb1bc4a41F830ceD9fB2` | Feedback & Scoring Registry |
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | Settlement reactor for bundled RFQ swaps |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Token approval standard |
| **USD₮ (Tether USD)** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 decimals |
| **cNGN (Celo Naira)** | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | 6 decimals |
| **Official Platform Agent** | `0xc519729BF6D15e5984702BBa2C553f1c74A73C95` | Registered owner of ERC-8004 Token #10078 |

---

## 4. Key Architecture & File Map

- `src/services/textileRfqService.js` — Textile FX API v2 client (`preview`, `request` with EIP-712 proof of control, cancel, swap execution, ERC-8021 attribution).
- `src/services/corridorPaymentFlow.js` — Cross-currency payment orchestrator (resolve `₦tag` -> Textile swap -> cNGN recipient settlement -> cryptographic receipt).
- `src/services/celoPayment.js` — Celo Viem clients, balance lookups, native & ERC-20 transfers with ERC-8021 attribution.
- `src/services/erc8004Service.js` — ERC-8004 Agent Identity, verification, and reputation logging.
- `src/components/CorridorSwapCard.jsx` — Production UI with live debounced RFQ preview, firm quote timer, external recipient input, and verifiable receipts.
- `src/config/celo.js` — Master Celo Mainnet chain, token, reactor, and attribution parameters.

---

## 5. Development & Testing Commands

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build

# Run test suite
npm run test
```

---

## 6. Live Deployments

- **Production App**: [https://celo.nairatag.ng](https://celo.nairatag.ng)
- **GitHub Monorepo**: [https://github.com/MrBloomguy/nairatag-celo](https://github.com/MrBloomguy/nairatag-celo)
- **Agent Card**: [https://celo.nairatag.ng/.well-known/agent-card.json](https://celo.nairatag.ng/.well-known/agent-card.json)
