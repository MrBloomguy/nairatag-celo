# Altana Agent Wallets — Phase 2.5 Security & SDK Implementation Audit

> **Protocol**: NairaTag on Celo (`Chain ID: 42220`)  
> **Track**: Track 4 — Altana Agent Wallets (Agents Open for Business Hackathon)  
> **Phase**: Phase 2.5 — Security, SDK Verification & Architecture Audit  
> **Date**: November 21, 2026  
> **Status**: **PASSED (24/24 Tests Passing, Ready for Phase 3 UI Gate Check)**  
> **Security Boundary**: **NO UNAUTHORIZED MAINNET TRANSACTIONS BROADCAST**

---

## Executive Summary

Phase 2.5 establishes a rigorous, mathematically verified, and non-custodial security audit of the **Altana Smart Agentic Wallet Service Layer** integrated into **NairaTag on Celo Mainnet (`Chain ID: 42220`)**. 

Altana provides programmable agent rails through **EIP-7702 account delegation** and on-chain session keys anchored to Celo's KeyStore. This audit confirms that:
1. **The Human User Retains 100% Custody**: Root administration is held via WebAuthn Passkeys (biometric P256) or dedicated hardware signers, while injected browser wallets (MetaMask/Rabby) serve strictly as external funding sources.
2. **Autonomous Execution is Strictly Sandboxed**: Agents cannot execute arbitrary calldata or drain accounts. Sessions enforce contract destination allowlists, function selector whitelisting, periodic spend caps with exact decimal precision, and cryptographic expirations.
3. **Revocation is Immediate and Monotonic**: Session keys can be terminated on-chain in a single multi-leg transaction across Celo's KeyStore (`0x83b3...27c`), immediately invalidating any subsequent execution attempts.
4. **Attribution is Enforced On-Chain**: All autonomous agent interactions append the hackathon ERC-8021 suffix (`celo_9f7deabd99a6`).

---

## 1. SDK Version & Dependency Integrity

The integration relies on the official, production-grade `@altananetwork/sdk` package and its core crypto dependency `porto`:

| Dependency | Installed Version | Verification Status | Source |
|---|---|---|---|
| `@altananetwork/sdk` | `1.1.0` | Verified Clean ESM | npm registry (`registry.npmjs.org/@altananetwork/sdk/-/sdk-1.1.0.tgz`) |
| `porto` | `0.2.37` | Verified Clean ESM | npm registry (`registry.npmjs.org/porto/-/porto-0.2.37.tgz`) |
| `viem` | `^2.57.7` | Verified Compatible | npm registry |

All package artifacts have been unpacked and verified locally within `node_modules/@altananetwork/sdk`. Zero mocked wrappers or monkey-patched binaries are present. The client connects directly to Celo Mainnet RPCs (`https://forno.celo.org`) and the Altana Relay network.

---

## 2. Signer Model & EIP-7702 Architectural Separation

A critical finding from our architecture review is the strict separation between **external funding wallets**, **root administrator signers**, and **delegated agent session keys**:

```
+-----------------------------------------------------------------------------------+
|                            HUMAN USER (Root Sovereign)                            |
|                                                                                   |
|   +------------------------------------+    +---------------------------------+   |
|   |   Injected Extension Wallet        |    |   WebAuthn Biometric Passkey    |   |
|   |   (MetaMask / Rabby / MiniPay)     |    |   (P256 on iOS / Android / Mac) |   |
|   |                                    |    |                                 |   |
|   |   Role: FUNDING ONLY               |    |   Role: ROOT ADMIN SIGNER       |   |
|   |   - Sends CELO gas                 |    |   - Signs EIP-7702 Delegation   |   |
|   |   - Sends USD₮ / cNGN              |    |   - Authorizes Session Policies |   |
|   |   - NO EIP-7702 / digest signing   |    |   - Triggers 1-Tx Revocation    |   |
|   +-----------------+------------------+    +----------------+----------------+   |
+---------------------|----------------------------------------|--------------------+
                      | Funds (CELO / USD₮ / cNGN)             | Authorizes Session Key
                      v                                        v
+-----------------------------------------------------------------------------------+
|               ALTANA SMART AGENTIC WALLET (EIP-7702 on Celo Mainnet)              |
|               Address: 0x... (Deterministic across all EVM chains)                |
|               KeyStore: 0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c                 |
+-----------------------------------------------------------------------------------+
                                       |
                                       | Executes actions under bounded policy
                                       v
+-----------------------------------------------------------------------------------+
|                      NAIRATAG AUTONOMOUS AGENT (₦nairatag)                        |
|                                                                                   |
|   Scoped Session Key (Ephemeral ECDSA Keypair)                                    |
|   - Destination Whitelist: Textile Reactor, ERC-20 cNGN/USD₮, ERC-8004 Registry    |
|   - Method Selector Restrictions: executeBatch, transfer, approve, register       |
|   - Daily Spend Caps: USD₮ (6 dec), cNGN (6 dec), CELO (18 dec)                   |
|   - Expiration: Strict Unix timestamp on-chain                                    |
+-----------------------------------------------------------------------------------+
```

### Why Injected Wallets Cannot Act as Root Admin
Standard injected browser wallets (MetaMask, Rabby) implement generic `personal_sign` and `eth_sendTransaction`. They **cannot** construct or sign the raw EIP-7702 authorization tuple `[chainId, address, nonce, yParity, r, s]` or the raw Keystore digest signatures required by Altana's protocol.

### The Solution: WebAuthn Passkeys (`createAltanaPasskeyWallet`)
1. **Creation Flow**:
   - `createAltanaPasskeyWallet({ name: 'NairaTag Agent' })` generates a throwaway EOA address first so the wallet address is known in advance.
   - The address is written into the WebAuthn credential's `userHandle`.
   - The user authorizes via biometric prompt (FaceID, TouchID, Windows Hello, YubiKey).
   - The P256 public key is registered into Celo KeyStore (`0x83b3...27c`).
2. **Recovery Flow**:
   - `recoverAltanaPasskeyWallet()` prompts the OS passkey picker.
   - The smart account address is retrieved from the assertion's `userHandle`.
   - The public key is verified against Celo KeyStore (`0x83b3...27c`) using two lightweight `eth_call` queries.
   - The admin signer is completely restored with zero seeds or stored private keys.
3. **Headless & Automated Testing**:
   - `createHeadlessPasskeySigner()` is provided via `createHeadlessPasskey()` from `@altananetwork/sdk` for Node.js test suites and headless CI/CD.

---

## 3. Verified Contract & Function Selector Policy Matrix

Allowing an agent unrestricted execution on a contract address (`{ to: contract }`) is a dangerous security anti-pattern. For example, granting `{ to: ERC8004Registry }` allows the agent to call `transferFrom` (stealing the agent identity NFT) or `setApprovalForAll` (granting an operator approval that survives session revocation).

NairaTag enforces **AND-semantics (`{ to, signature }`)** down to the exact function selector.

### Selector Verification Table

| Contract Target | Verified Mainnet Address | Function Signature | Selector | Mathematical Verification |
|---|---|---|---|---|
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | `executeBatch((bytes,bytes)[])` | `0x0d7a16c3` | `keccak256("executeBatch((bytes,bytes)[])")[0..4]` |
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | `execute((bytes,bytes))` | `0x3f62192e` | `keccak256("execute((bytes,bytes))")[0..4]` |
| **USD₮ (Tether)** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | `transfer(address,uint256)` | `0xa9059cbb` | `keccak256("transfer(address,uint256)")[0..4]` |
| **USD₮ (Tether)** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | `approve(address,uint256)` | `0x095ea7b3` | `keccak256("approve(address,uint256)")[0..4]` |
| **cNGN (Conergent)** | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | `transfer(address,uint256)` | `0xa9059cbb` | `keccak256("transfer(address,uint256)")[0..4]` |
| **cNGN (Conergent)** | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | `approve(address,uint256)` | `0x095ea7b3` | `keccak256("approve(address,uint256)")[0..4]` |
| **ERC-8004 Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `register(string,(string,bytes)[])` | `0x8ea42286` | `keccak256("register(string,(string,bytes)[])")[0..4]` |
| **ERC-8004 Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `setAgentURI(uint256,string)` | `0x0af28bd3` | `keccak256("setAgentURI(uint256,string)")[0..4]` |

> [!IMPORTANT]
> **Bytecode Verification Note**: The Textile LimitOrderReactor on Celo Mainnet (`0xa9AA...35b3`) is a UniswapX LimitOrderReactor. It does NOT expose `executeBatch(bytes)`. Attempting to authorize `executeBatch(bytes)` creates an uncallable dead policy. NairaTag enforces the exact verified signature `executeBatch((bytes,bytes)[])` (`0x0d7a16c3`).

---

## 4. Deployed Celo Infrastructure Validation

All smart contract endpoints and network configurations have been verified against Celo Mainnet:

- **Celo Mainnet RPC**: `https://forno.celo.org` (Chain ID: `42220`)
- **Altana KeyStore Contract**: `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c`
- **Textile LimitOrderReactor**: `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`
- **ERC-8004 Canonical Identity Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Canonical NairaTag Registry**: `0xb34518cC33314ee63841120bDd3Baa3BD1baf9e0`
- **Official NairaTag Agent**: `0xc519729BF6D15e5984702BBa2C553f1c74A73C95` (ERC-8004 Token ID: `10078`)

---

## 5. Spend Limits & Decimal Precision Enforcement

Token value scaling errors in smart contract agents can result in 1,000,000x overspending or instant transaction failure. Altana enforces spend limits on-chain at the atomic unit level.

### Scaling Rules & Precision Table

| Asset | Contract Address | Decimals | Human Input | Atomic Limit | Altana Schema Field |
|---|---|---|---|---|---|
| **USD₮** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | **6** | `10.0` USD₮ | `10000000n` | `token: "0x4806...3D5e"` |
| **cNGN** | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | **6** | `15000.0` cNGN | `15000000000n` | `token: "0xF682...1a4f"` |
| **CELO (Native)** | N/A (Native Gas) | **18** | `0.5` CELO | `500000000000000000n` | `token: undefined` (omitted per schema) |

### Enforced Constraints in `buildSessionPolicy`
- **Zero / Negative Amounts**: Throws immediately if `amount <= 0` or NaN.
- **Invalid Tokens**: Validates token address format via `isAddress` and checksums via `getAddress`.
- **Supported Periods**: Strictly restricted to `['minute', 'hour', 'day', 'week', 'month', 'year']`.
- **Unrestricted Spend**: A session with no spend rules is permitted only if no value transfers occur; otherwise, explicit limits are enforced.

---

## 6. Session Key Lifecycle & Safe Storage Boundary

To ensure non-custodial safety and eliminate key leakage vectors:

```
[ Active Session Initialization ]
               |
               v
+------------------------------------+
|  Agent Session Private Key         |  ---> In-Memory Only (Ephemeral)
|  (_privateKey, 32 bytes)           |  ---> Dropped upon tab close / logout
+------------------------------------+
               |
      serializeSession()
               |
               v
+------------------------------------+
|  JSON-Safe Serialized Metadata     |  ---> Saved to localStorage:
|  - walletAddress                   |       "nairatag_altana_sessions_v1"
|  - publicKey                       |  ---> ZERO private keys
|  - permissions (calls, spend)      |  ---> ZERO sensitive credentials
|  - expiry timestamp                |
|  - keyId                           |
+------------------------------------+
```

### Security Guarantees:
1. `serializeAgentSession(session)` explicitly strips `session._privateKey` and `session.signer`.
2. `restoreAgentSession(metadata, sessionPrivateKey)` rebuilds the executable session handle only when provided the session private key.
3. Persistent browser storage (`localStorage`) never holds private keys. Even in the event of an XSS inspection of `localStorage`, an attacker cannot execute transactions.
4. When `revokeAgentSession` is called, the public metadata is purged from storage and the session is invalidated on-chain.

---

## 7. Autonomous Execution & ERC-8021 Hackathon Attribution

When the agent executes an action via `executeAgentAction`:
1. **Pre-Flight Client Verification**:
   - Checks expiry (`now < session.expiry`). Rejects expired sessions locally.
   - Checks target address against `session.permissions.calls`.
   - Checks function selector against `session.permissions.calls[].signature`.
2. **ERC-8021 Attribution Suffix**:
   - Appends the verified hackathon attribution suffix to calldata:
     ```
     Tag: celo_9f7deabd99a6
     Suffix: 0x63656c6f5f396637646561626439396136110080218021802180218021802180218021
     ```
3. **Relay Dispatch**:
   - Dispatches via `client.execute({ session, chainId: 42220, calls: [...] })`.
   - The session key signs the intent. The Altana relay submits it to Celo Mainnet.
   - The smart account self-executes the call under EIP-7702 delegation.

---

## 8. Revocation Mechanics & Multi-Leg On-Chain Verification

Revocation is an administrative action signed by the **Root Admin Signer** (Passkey or ECDSA key), not the agent:

```
Admin Signer (Passkey / Biometric)
               |
               v
   client.revokeSession({ wallet, signer, session })
               |
               +--------------------------------------------+
               |                                            |
               v                                            v
         [ Account Leg ]                             [ Registry Leg ]
   Local smart account cancels                Celo KeyStore (0x83b3...27c)
   session authorization.                     invalidates key cache proof.
               |                                            |
               +--------------------+-----------------------+
                                    |
                                    v
               Status: "revoked" (Both legs CONFIRMED)
```

### Verification Rules:
- The service monitors both legs: `account` and `registry`.
- The revocation is considered complete **only if both legs report `CONFIRMED`**.
- If any leg fails (e.g. relay timeout), the service returns `status: 'failed'` and identifies the specific failed leg and reason.
- Once confirmed revoked, Celo's KeyStore permanently rejects any signature signed by that session key.

---

## 9. Comprehensive Test Suite Coverage & Verification Results

All tests have been run locally using Node.js v24.14.1 test runner (`node --test test/*.test.js`). **100% of tests pass (24/24)**:

```
> celo-nairatag@1.0.0 test
> node --test test/*.test.js

✔ resolves a canonical NairaTag and registered voice aliases (10.7963ms)
✔ does not route a missing or retired identity to another integration (2.4636ms)
✔ asks for clarification when an alias is shared by published agents (0.5975ms)
✔ does not confuse a currency amount with a NairaTag mention (3.7899ms)
✔ discovers only declared callable capabilities on available integrations (1.2172ms)
✔ does not infer a capability from marketing text or a disabled tool (0.3724ms)
✔ recognizes explicit capability-discovery requests (0.9909ms)
✔ maps public registry identity, aliases, capability and lifecycle fields without exposing runtime config (1.1455ms)
✔ Altana Client Configuration & Celo Constants (1.6588ms)
✔ Supported Admin Signer Generation & Address Validation (46.768ms)
✔ Session Policy Builder: Contract & Method-Signature Enforcement (3.353ms)
✔ Session Policy Builder: Rejection of Unrestricted Sessions (0.8246ms)
✔ Session Serialization & Restoration (Zero Secret Leaks) (2.6772ms)
✔ Unauthorized Execution Pre-Flight Rejection (2.4011ms)
✔ Revocation Result & Partial Failure Inspection (0.3089ms)
✔ Passkey Signer Model: Headless & Biometric P256 Validation (122.9287ms)
✔ Celo Deployed Contracts & Function Selector Mathematical Verification (1.7139ms)
✔ buildStandardAgentPolicy: Full Suite Composition & Bounds Enforcement (1.3272ms)
✔ Textile FX Configuration & Corridor Constants (1.5893ms)
✔ ERC-8021 Attribution Suffix Integrity (0.6635ms)
✔ TakerControl EIP-7702 Typed Signature Generation (3.3774ms)
✔ Live Textile FX v2 RFQ Preview for USD₮ -> cNGN Corridor (881.6692ms)
✔ Live Textile FX v2 RFQ Preview for Reverse cNGN -> USD₮ Corridor (866.0779ms)
✔ Bundled Multi-Maker Swap Execution Validation (1.7127ms)

ℹ tests 24
ℹ suites 0
ℹ pass 24
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3771.3868
```

---

## 10. Phase 3 UI Readiness & Strict Gate Check

### Gate Check Status: **CLEARED FOR PHASE 3 UI DEVELOPMENT**

| Audit Criterion | Status | Evidence / Verification |
|---|---|---|
| SDK v1.1.0 and Porto v0.2.37 verified | **PASSED** | Clean ESM resolution in `node_modules/@altananetwork/sdk` |
| Injected vs Passkey signer separation | **PASSED** | `createAltanaPasskeyWallet` & `createHeadlessPasskeySigner` |
| Deployed contract allowlists verified | **PASSED** | Textile (`0xa9AA...`), KeyStore (`0x83b3...`), Registry (`0x8004...`) |
| Function selectors mathematically exact | **PASSED** | `0x0d7a16c3` (batch), `0x3f62192e` (single), `0xa9059cbb` (transfer) |
| Token decimal scaling exact | **PASSED** | USD₮ (6), cNGN (6), CELO (18) atomic scaling verified |
| Zero secrets in localStorage | **PASSED** | Serialized sessions store only public metadata & bounds |
| Attribution suffix appended | **PASSED** | `celo_9f7deabd99a6` suffix tested and verified |
| On-chain revocation multi-leg check | **PASSED** | Validates account + registry confirmation |
| 100% test suite passing | **PASSED** | 24/24 passing unit & integration tests |
| Mainnet funds untouched | **PASSED** | Zero unauthorized transactions broadcast |

### Next Step: Phase 3 — User Interface & Interactive Session Manager
With Phase 2.5 complete, the service layer is fully validated and ready for frontend integration in Phase 3:
1. `AltanaSessionCard.jsx`: Interactive UI allowing the human user to create a passkey wallet, view balances, configure allowlists & spend caps, grant an on-chain session key to `₦nairatag`, and revoke with 1-click.
2. Injected wallet funding widget: Seamless QR code and copy-to-clipboard for funding the Altana Smart Wallet with CELO gas and stablecoins.
3. Live status and countdown badge: Visual indicators of session active/expired/revoked state and remaining spend allowance.
