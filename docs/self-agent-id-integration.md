# Self Agent ID Integration Guide

## 1. Overview & Architecture

**NairaTag Agent Commerce** integrates **Self Protocol** on **Celo Mainnet (`Chain ID 42220`)** to provide cryptographic, zero-knowledge human-backed identity verification for autonomous AI agents.

In sovereign agent commerce, an agent must be accountable to a verified human operator without exposing the operator's personal biometric or passport data. Self Protocol solves this through zero-knowledge proofs (ZKPs) generated from government-issued electronic passports (e-Passports with NFC chips), registered directly to the official `SelfAgentRegistry` on Celo Mainnet.

### Fundamental Principle
> **An agent's identity determines what it can access. Its permissions determine what it can do. Its payment authorization determines what it can charge for.**

- **ERC-8004**: Universal agent registry identifying sovereign NairaTag agents (`₦nairatag`, `₦bloom`, `₦defillama`, `₦meteo`, `₦coingecko`).
- **Self Agent ID**: Zero-knowledge proof-of-human backing registered on Celo Mainnet.
- **Altana**: Spend-capped, time-bounded session key execution (EIP-7702).
- **x402**: Pay-per-request monetization and settlement on Celo in USD₮ / cNGN.

---

## 2. Verified Celo Mainnet Smart Contracts

All contract bindings have been verified on-chain via Celo Mainnet RPC:

| Contract | Address | Network | Explorer Link |
|---|---|---|---|
| **SelfAgentRegistry (Mainnet)** | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` | Celo (`42220`) | [CeloScan](https://celoscan.io/address/0xaC3DF9ABf80d0F5c020C06B04Cced27763355944) |
| **Self Proof Provider** | `0x4b036aFD959B457A208F676cf44Ea3ef73Ea3E3d` | Celo (`42220`) | [CeloScan](https://celoscan.io/address/0x4b036aFD959B457A208F676cf44Ea3ef73Ea3E3d) |
| **Official NairaTag Agent** | `0xc519729BF6D15e5984702BBa2C553f1c74A73C95` | Celo (`42220`) | [CeloScan](https://celoscan.io/address/0xc519729BF6D15e5984702BBa2C553f1c74A73C95) |
| **SelfAgentRegistry (Testnet)** | `0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379` | Alfajores (`44787`) | [CeloScan Testnet](https://alfajores.celoscan.io/address/0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379) |

---

## 3. Core Verification Functions

`src/services/selfAgentIdService.js` reads directly from the on-chain registry contract:

```solidity
function isVerifiedAgent(bytes32 agentPubKey) view returns (bool)
function getAgentId(bytes32 agentPubKey) view returns (uint256)
function hasHumanProof(uint256 agentId) view returns (bool)
function getHumanNullifier(uint256 agentId) view returns (uint256)
function isProofFresh(uint256 agentId) view returns (bool)
function proofExpiresAt(uint256 agentId) view returns (uint256)
function selfProofProvider() view returns (address)
```

### Verification States:
1. `verified`: Agent holds an active, unexpired proof-of-human token in the Self Registry.
2. `unverified`: Agent has not yet minted or registered a proof.
3. `verification_pending`: Operator has initiated an NFC passport scan session via the Self mobile app.
4. `verification_expired`: Proof timestamp is older than 365 days; re-verification required.
5. `verification_revoked`: Proof was explicitly revoked on-chain by the operator.
6. `verification_failed`: Invalid evidence or nullifier mismatch.

---

## 4. Capability Authorization Policy Matrix

Capabilities registered under NairaTag agents are protected by three distinct policy tiers:

| Policy Level | Capabilities | Access Rule |
|---|---|---|
| **Public** (`public`) | `quote_rate`, `resolve_tag` | Open to all callers without verification. |
| **Verified Only** (`verified_only`) | `market_depth`, `submit_task_deliverable` | Requires active, fresh on-chain Self verification (`isVerifiedAgent == true`). Unverified callers receive `HTTP 403 Forbidden`. |
| **x402 Paid** (`paid_x402`) | `cngn_forex_intelligence`, `arbitrage_signal_feed` | Requires active Self verification **plus** qualifying x402 micropayment settlement in USD₮ or cNGN. |

---

## 5. Agent Registration Flow

1. **Initiate Session**: Call `initiateAgentRegistrationSession({ agentAddress, agentTag })`.
2. **Scan Passport**: Operator opens the Self Mobile App (iOS / Android), taps "Scan ID", and holds their biometric passport against the phone NFC reader.
3. **ZK Proof Mint**: The app verifies the passport chip cryptographic signatures, computes a unique human nullifier hash, and mints an on-chain soulbound verification NFT to `SelfAgentRegistry` on Celo Mainnet.
4. **Resolution**: NairaTag's `checkAgentVerificationOnChain` detects the fresh verification and automatically elevates the agent's capability level.
