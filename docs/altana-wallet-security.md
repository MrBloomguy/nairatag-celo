# Altana Agent Wallets: Security Architecture & Threat Model
## NairaTag on Celo Mainnet (`Chain ID 42220`)

---

## 1. Threat Modeling & Security Boundaries

| Threat Vector | Mitigation Strategy | Enforcement Layer |
|---|---|---|
| **Private Key Theft / Compromise** | The human administrator holds a passkey or ECDSA key in their secure device. The agent holds only a scoped session key. | Cryptographic Signer Isolation |
| **Rogue Agent Overspending** | Daily / rolling spend caps are defined in raw atomic units and enforced on-chain by Altana's smart account contract. | On-Chain Smart Account |
| **Arbitrary Contract Interaction** | Sessions enforce `{ to, signature }` tuples. The agent cannot call unauthorized contracts or unapproved method selectors. | On-Chain Validator |
| **Session Hijacking / Stale Key Replay** | Sessions carry an explicit unix timestamp expiry (`expiry`). Keys cannot be used once expired. | On-Chain KeyStore |
| **Revocation Delay / Bypass** | Revocation is atomic and monotonic. Once revoked, the Keystore strips the key ID; subsequent calls revert at validation. | On-Chain Keystore Registry |
| **Storage Leakage of Secret Material** | `serializeSession` strips all private keys, storing only `{ walletAddress, publicKey, permissions, expiry }`. | Client Persistence Model |

---

## 2. Signer Isolation & Non-Custodial Boundaries

1. **Administrator Key Protection**:
   - The root administrator signer is strictly segregated from the agent runtime.
   - For passkey users, the key never leaves the device's Secure Enclave / WebAuthn hardware.
   - For private key users, the key is used only to authorize `createWallet`, `grantSession`, or `revokeSession`.
2. **Session Key Protection**:
   - The agent session signer (`createPrivateKeySigner()`) is generated dynamically for each authorized delegation.
   - It is never exposed in URL parameters, query strings, error messages, or telemetry.

---

## 3. Session Persistence & Storage Safety

- **Safe Serialized State**:
  ```json
  {
    "walletAddress": "0xc519729BF6D15e5984702BBa2C553f1c74A73C95",
    "publicKey": "0x04...",
    "permissions": {
      "calls": [{ "to": "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3", "signature": "executeBatch(bytes)" }],
      "spend": [{ "limit": "5000000", "period": "day", "token": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" }]
    },
    "expiry": 1732266000
  }
  ```
  Notice that `_privateKey` is completely absent.
- **Executable Restoration**:
  When an autonomous agent needs to execute an action, it reconstructs the session using `deserializeSession(safeSerialized, sessionSigner)`.
  If the public key of the signer does not match the stored `publicKey`, restoration fails immediately with an invariant error.

---

## 4. Multi-Leg Revocation Verification

Altana's multi-chain architecture coordinates revocation across three distinct layers:
1. **Account Leg**: Authorizes the removal of the session key from the smart account validator on Celo (`42220`).
2. **Registry Leg**: Updates the central KeyStore contract (`0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c`) marking the key ID as revoked.
3. **Cache Leg**: Updates L2 Keystore caches where applicable.

NairaTag enforces that `status === "revoked"` is returned **only** when all confirmation legs succeed. If any leg fails, the operation is flagged as `failed` with detailed diagnostic telemetry.
