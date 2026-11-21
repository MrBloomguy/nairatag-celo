# Self Agent ID & x402 Security Architecture

## 1. Threat Modeling & Security Invariants

In agentic commerce systems, combining identity verification with financial transactions introduces unique attack surfaces. NairaTag enforces strict security boundaries across identity, authorization, and settlement.

| Threat Category | Potential Attack Vector | NairaTag Defense Mechanism |
|---|---|---|
| **Identity Theft / Replay** | Attacker uses a valid verification proof belonging to `0xAgentA` to access services as `0xAgentB`. | `validateEvidenceIdentityBinding` strictly enforces checksummed address matching between claimed agent identity and proof payload. |
| **Proof-of-Human Sybil Attack** | Single human registers multiple puppet agent accounts to dominate bounties or rate limits. | Self Protocol enforces uniqueness via human nullifier hashes (`getHumanNullifier`), generating a unique deterministic hash per passport chip without revealing passport details. |
| **Payment Replay Attack** | Attacker captures a valid payment transaction hash and re-submits it to invoke expensive agent compute multiple times. | Single-use `paymentDigest` is permanently added to `consumedPaymentDigests`. Replays are rejected before compute execution. |
| **Cross-Chain / Cross-Asset Spoofing** | Attacker submits a testnet or alternate chain tx hash (e.g. Arc, BSC) to claim payment. | Strict validation of `eip155:42220` network prefix and asset contract address matching. |
| **Agent Execution Failure after Payment** | User pays valid x402 invoice, but downstream agent node fails during compute. | The pipeline catches downstream failures, sets status `500`, and attaches the full `paymentReceipt` and digest to the audit record for dispute or automated refunding. |
| **Session Hijacking / Key Leakage** | Compromise of browser storage exposing agent private keys. | Zero private keys, API secrets, or passport attributes are ever written to browser `localStorage` or `sessionStorage`. |

---

## 2. Privacy Preservation (Zero-Knowledge Guarantees)

Self Protocol relies on Circom ZK-SNARK circuits to verify biometric passports. The following properties are strictly guaranteed:
- **No PII Stored**: Name, passport number, date of birth, and nationality are never published on-chain or transmitted to NairaTag servers.
- **Client-Side Proving**: The zero-knowledge proof is generated locally inside the operator's smartphone via the Self mobile app.
- **On-Chain Soulbound Registration**: The on-chain registry contract (`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`) records only the boolean verification flag, agent token ID, and nullifier hash.

---

## 3. Defense-in-Depth Layering

NairaTag enforces layered authorization so that no single layer's failure compromises security:

```
+-------------------------------------------------------+
| Layer 1: Identity & Sybil Gate (Self Agent ID)       |
| - Verifies human-backing on Celo Mainnet               |
| - Validates proof freshness & nullifier binding       |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
| Layer 2: Wallet Permission Gate (Altana / EIP-7702)   |
| - Spend caps per token (USD₮, cNGN, CELO)             |
| - Destination allowlisting & method restrictions      |
| - Recipient parameter-level binding                   |
| - Session expiry & on-chain revocation               |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
| Layer 3: Payment Settlement Gate (x402 Micropayments)  |
| - Nonce-bound payment requirements                     |
| - Single-use cryptographic payment digests            |
| - Mandatory ERC-8021 hackathon attribution suffix     |
+-------------------------------------------------------+
```

This multi-layer architecture guarantees that even if an agent key is leaked or compromised, its capabilities remain bounded by Altana spend caps, and it cannot impersonate other verified agents or drain operator liquidity.
