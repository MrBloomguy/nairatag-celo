# NairaTag on Celo 🌿
> **Sovereign Agent Rails, ERC-8004 Agentic Trust & Stablecoin Corridors on Celo Mainnet**

[![Celo Mainnet](https://img.shields.io/badge/Network-Celo%20Mainnet%20(42220)-35D07F?style=for-the-badge&logo=celo&logoColor=black)](https://celoscan.io)
[![Attribution Tag](https://img.shields.io/badge/ERC--8021%20Tag-celo__9f7deabd99a6-10b981?style=for-the-badge)](https://celo.nairatag.ng)
[![ERC-8004](https://img.shields.io/badge/Identity-ERC--8004%20Registered-6366f1?style=for-the-badge)](https://celo.nairatag.ng/.well-known/agent-card.json)
[![Live dApp](https://img.shields.io/badge/Production-celo.nairatag.ng-blue?style=for-the-badge)](https://celo.nairatag.ng)

---

## 🏆 Celo Hackathon: "Agents Open for Business"
Built specifically for the **Celo "Agents Open for Business" Hackathon (Nov 20 – Dec 7, 2026)**.

- **Track 1**: Stablecoin Corridors (USD₮ ⇄ cNGN via Textile FX)
- **Live Production dApp**: [https://celo.nairatag.ng](https://celo.nairatag.ng)
- **Agent Card RFC Manifest**: [https://celo.nairatag.ng/.well-known/agent-card.json](https://celo.nairatag.ng/.well-known/agent-card.json)
- **Official Agent Wallet**: `0xc519729BF6D15e5984702BBa2C553f1c74A73C95`
- **Mandatory Attribution Tag**: `celo_9f7deabd99a6`
- **Registered Agent Token ID**: `10078` (ERC-8004 NFT on Celo Mainnet)
- **Confirmed Registration Tx**: [`0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7`](https://celoscan.io/tx/0x5dea3fcc2e575a5a90c7812e36152eaa0d412367d49f67f9e3bb5b2cec0044d7)

---

## 🌟 What NairaTag Does on Celo

NairaTag replaces complex 42-character hexadecimal addresses (`0x71C...b1D`) with human- and agent-readable sovereign identifiers (`₦TAG` / `@name`) backed by **Celo Mainnet** sub-cent transaction finality and native stablecoin settlement (`cNGN`, `USD₮`, `cUSD`, `CELO`).

### Core Features:
1. **Sovereign ₦Tags**: Claim a human-readable tag bound to your permanent Celo address with instant QR codes and CeloScan verification.
2. **Track 1 Stablecoin Corridors (USD₮ ⇄ cNGN)**: Native FX routing between global dollar liquidity (USD₮) and local African purchasing power (cNGN) via Textile FX router (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`).
3. **ERC-8004 Trust & Identity Layer**: Sovereign AI agents register verifiable identities on-chain at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, discoverable by other agents across the network.
4. **Autonomous Escrow & Micropayments (`CeloTagsEscrow`)**: Non-custodial escrow contracts enabling autonomous agents to lock bounties, submit cryptographically verifiable deliverables, and release instant payouts.
5. **Universal ERC-8021 Transaction Attribution**: Every transaction sent from the client or agent automatically appends the 35-byte attribution suffix (`celo_9f7deabd99a6`) ensuring 100% on-chain compliance.

---

## 📑 Verified Smart Contracts & Addresses (Celo Mainnet `Chain ID: 42220`)

| Contract / Asset | Address | Explorer Link |
|---|---|---|
| **NairaTagRegistry (Canonical)** | `0x6D3950a390c7F60287d545cC5785c594e07439F9` | [CeloScan](https://celoscan.io/address/0x6D3950a390c7F60287d545cC5785c594e07439F9) |
| **NairaTagResolver (Canonical)** | `0xa3760573DE321DA2955573c69a4f497d57C769A2` | [CeloScan](https://celoscan.io/address/0xa3760573DE321DA2955573c69a4f497d57C769A2) |
| **ERC-8004 Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | [CeloScan](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| **ERC-8004 Reputation Registry** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | [CeloScan](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |
| **Textile FX Router (Corridor)** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | [CeloScan](https://celoscan.io/address/0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3) |
| **cNGN Stablecoin** | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | [CeloScan](https://celoscan.io/address/0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f) |
| **USD₮ Stablecoin** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | [CeloScan](https://celoscan.io/address/0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e) |
| **cUSD Stablecoin** | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | [CeloScan](https://celoscan.io/address/0x765DE816845861e75A25fCA122bb6898B8B1282a) |

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Viem 2.x, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Smart Contracts**: Solidity `^0.8.20`, Foundry (`forge build`, `forge test`)
- **Agent Frameworks**: ElizaOS Plugin, LangChain Tools (`packages/celotags-protocol`)
- **Attribution Standard**: ERC-8021 Calldata Suffix Standard
- **Identity Standard**: ERC-8004 Sovereign AI Agent Trust
- **Hosting**: Vercel Edge Network (`https://celo.nairatag.ng`)

---

## 💻 Local Development & Setup

### Prerequisites
- Node.js `20.x` or `24.x`
- Foundry (`forge`, `cast`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

### 4. Run Smart Contract Tests
```bash
forge test -vvv
```

---

## ⚡ 1-Click ERC-8004 Identity Registration & Tagging

To register your agent and satisfy the hackathon checks in a single transaction:

1. Open **[https://celo.nairatag.ng](https://celo.nairatag.ng)**.
2. Connect your agent wallet (`0xc519729BF6D15e5984702BBa2C553f1c74A73C95`) using MetaMask, Rabby, or Opera MiniPay.
3. Click the **`1-Click Register Identity & Broadcast Tag`** button.
4. Copy the confirmed transaction hash and submit it to the hackathon portal.

Alternatively via **Foundry `cast`**:
```bash
cast send 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "0xf2c298be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003468747470733a2f2f63656c6f2e6e616972617461672e6e672f2e77656c6c2d6b6e6f776e2f6167656e742d636172642e6a736f6e00000000000000000000000063656c6f5f396637646561626439396136110080218021802180218021802180218021" --value 0 --rpc-url "https://forno.celo.org" --interactive
```

---

## 📄 License
MIT © NairaTag Protocol
