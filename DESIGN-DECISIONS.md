# Design Decisions - Nucleus v0.1.0-beta

## Overview

This document records explicit design choices made for Nucleus v0.1.0-beta. These decisions prioritize simplicity, debuggability, and a clear path to production features in later versions.

---

## 1. Schema Version Constant

**Decision:** Use a single, immutable schema version across all records.

```typescript
export const NUCLEUS_SCHEMA_VERSION = "nucleus-core/v0.1.0-beta" as const;
```

**Rationale:**

- Clear versioning of record format
- Easy to identify beta vs stable records
- Simplifies validation logic
- Prepares for future schema migrations

**Future:** Schema migration strategies for v1.0.0+ transitions.

---

## 2. Proof Module: `kind` + `data` (not `claimType` + `claims`)

**Decision:** Use `kind` and `data` for proof record fields.

```typescript
interface ProofBody {
  subject: string;
  issuer: string;
  kind: string; // ✅ Not "claimType"
  data: Record<string, unknown>; // ✅ Not "claims"
  issuedAt: string;
  expiresAt?: string;
  issuerProof?: IssuerProof;
}
```

**Rationale:**

- **Consistency:** Aligns with OID Core's use of `kind` (e.g., "human", "org")
- **Brevity:** Shorter, more generic naming
- **Flexibility:** `data` is neutral and extensible for any proof type

**Examples:**

- `kind: "kyc"` with `data: { country: "NL", level: "basic" }`
- `kind: "certification"` with `data: { certId: "ISO27001", validUntil: "..." }`
- `kind: "membership"` with `data: { orgId: "...", role: "admin" }`

---

## 3. Proof Chain ID: Readable Format

**Decision:** Use human-readable chain IDs instead of hashes.

```typescript
generateProofChainId(issuer, subject, kind): string
// Format: "nucleus:proof:{issuer}:{subject}:{kind}"
// Example: "nucleus:proof:oid:onoal:org:verifier:oid:onoal:user:alice:kyc"
```

**Rationale:**

- **Debuggability:** Easy to inspect in logs, databases, and error messages
- **Discoverability:** Clear what the chain represents without lookups
- **Auditability:** One chain per unique (issuer, subject, kind) combination
- **Simplicity:** No hash collision concerns, no encoding overhead

**Trade-offs:**

- ❌ Slightly longer IDs (vs SHA-256 hash)
- ❌ Subject/issuer OIDs visible (privacy leak if chain IDs are shared)

**Future:** May offer hash-based alternative in v0.2.0+ for privacy-sensitive use cases.

---

## 4. OID Chain ID: `chainId === oid`

**Decision:** Use the OID itself as the chain ID, no transformation.

```typescript
generateOidChainId(oid: string): string
// Input:  "oid:onoal:user:alice"
// Output: "oid:onoal:user:alice" (identity function)
```

**Rationale:**

- **Simplicity:** No encoding, hashing, or transformation needed
- **Canonical:** OIDs are already unique and deterministic
- **Debuggability:** Chain ID is immediately human-readable
- **One-to-One Mapping:** One chain per OID, trivial to query

**No Need For:**

- ❌ Base64url encoding (OIDs are already safe strings)
- ❌ SHA-256 hashing (OIDs are already unique)
- ❌ Prefixing (OID format already unambiguous)

---

## 5. Security: OID Signatures YES, Proof Signatures Deferred

**Decision:** Full cryptographic verification for OID records, structural-only for Proof records in v0.1.0-beta.

### What IS Validated (v0.1.0-beta):

✅ **OID record signatures** (via `@onoal/oid-core.validateRecord()`)  
✅ OID record structure (schema, keys, proof format)  
✅ Proof record structure (subject, issuer, kind, timestamps)  
✅ Chain integrity (hash, prevHash, sequential index)  
✅ Timestamp consistency (issuedAt ≤ createdAt, expiresAt > issuedAt)  
✅ Caller authorization (callerOid === oid for OID records, callerOid === issuer for proofs)

### What is NOT Validated (deferred to v0.2.0):

⚠️ **Proof issuer signatures** (`issuerProof.signature` field validated structurally, not cryptographically)  
⚠️ Key resolution across chains (fetching issuer OID records for proof verification)  
⚠️ Revocation status (no on-chain revocation mechanism yet)

**Rationale:**

- **OID Records: Full Security**
  - OID records are self-contained: keys and signatures are in the same record
  - `@onoal/oid-core` provides complete signature verification out of the box
  - OID integrity is foundational — must be cryptographically sound from day 1
- **Proof Records: Deferred Verification**
  - Proof signatures reference keys in _other_ OID records (cross-chain resolution needed)
  - Requires fetching issuer's OID record from Nucleus to resolve `keyRef`
  - Key rotation edge cases (which key was valid at proof creation time?)
  - Doubles complexity for v0.1.0-beta

- **Pragmatic Trade-off:**
  - Applications can verify proof signatures externally if needed
  - Most use cases: structural validation sufficient for beta
  - Production apps will wait for v0.2.0 anyway

**Future (v0.2.0):**

- [ ] Add `NucleusContext` with OID record cache
- [ ] Implement `resolveKey(oid, keyRef, atTime?)` helper with time-based key resolution
- [ ] Add signature verification to Proof module
- [ ] Handle key rotation edge cases (proof signed with now-rotated key)
- [ ] Define revocation semantics (soft flag vs hard constraint)

**Migration Path:**
Existing v0.1.0-beta records will remain valid. v0.2.0 will add opt-in proof signature verification via:

```typescript
const nucleus = await createNucleus({
  store,
  verifyProofSignatures: true, // Opt-in for proof signature verification
});
```

OID signature verification is always enabled (non-negotiable for integrity).

---

## 6. Proof Revocation: Not Implemented

**Decision:** `issuerProof` field is optional but not enforced in v0.1.0-beta.

**Status:**

- Field is allowed in `ProofBody` interface
- No validation of signature correctness
- No revocation semantics (yet)

**Future Options:**

1. **Soft Revocation:** Issue new proof with `data.revoked = true`
2. **Hard Revocation:** Separate `revoke` module type with tombstone records
3. **Expiration-Only:** Rely on `expiresAt` and ignore revocation

**Deferred to v0.2.0** when key resolution and signature verification are implemented.

---

## 7. Invariants as Natural Laws

**Decision:** Enforce core invariants through combined engine + storage + WASM logic.

| Invariant                 | Description                               | Enforced By                             |
| ------------------------- | ----------------------------------------- | --------------------------------------- |
| **Append-only**           | No updates or deletes                     | API design + storage interface          |
| **Unique hash**           | Every `hash` is unique across all records | SQLite `UNIQUE(hash)`                   |
| **Unique (chain, index)** | Every `(chainId, index)` is unique        | SQLite `UNIQUE(chainId, index)`         |
| **Hash correctness**      | `hash = SHA-256(canonical(record))`       | Rust WASM + engine pre-check            |
| **Chain linkage**         | `prevHash` links to previous record       | Engine validation before insert         |
| **Sequential index**      | Index increments by 1 (0, 1, 2, ...)      | Engine auto-increments from `getHead()` |
| **Module validation**     | `body` passes module-specific rules       | Module runtime called before insert     |

**Philosophy:** These invariants are **non-negotiable** — they define the "physics" of Nucleus. Violating them should be impossible via the public API.

---

## 8. Test Coverage: Core vs Storage

**Decision:** Separate core tests (always runnable) from storage tests (require native builds).

### Core Tests (73 tests)

- **Location:** `src/modules/`, `src/core/`
- **Dependencies:** None (pure TypeScript)
- **Run:** `pnpm test src/modules src/core`

### Storage Tests (36 tests)

- **Location:** `src/storage-sqlite/`
- **Dependencies:** `better-sqlite3` (native Node.js addon)
- **Run:** `pnpm test` (if better-sqlite3 built successfully)

**Rationale:**

- **CI/CD Friendly:** Core tests run everywhere, even without C++ toolchain
- **Developer UX:** Can work on modules/engine without building SQLite
- **Realism:** Storage tests validate real DB constraints (not just mocks)

---

## 9. Module Registry: Singleton Pattern

**Decision:** Use a global singleton registry for module runtimes.

```typescript
registerModule("oid", oidModule);
registerModule("proof", proofModule);
```

**Rationale:**

- **Simplicity:** No dependency injection needed
- **Global State:** Modules are stateless validators, safe to share
- **Convention over Configuration:** One module per `moduleName` string

**Trade-offs:**

- ❌ Global state (harder to test isolation)
- ✅ Simple API (no module registry passed everywhere)
- ✅ Matches user mental model ("register once, use anywhere")

**Future:** May add scoped registries if needed for multi-tenant scenarios.

---

## 10. Storage Adapter: SQLite for Beta

**Decision:** Ship only SQLite adapter in v0.1.0-beta.

**Rationale:**

- **Proven:** battle-tested, zero-config database
- **Local-First:** No network dependencies
- **ACID Guarantees:** Transactions ensure chain integrity
- **Portable:** Works in Node.js, Bun, Deno (with adapters)

**Future Adapters (v0.2.0+):**

- PostgreSQL (distributed, replicated)
- IndexedDB (browser storage)
- Memory-only (ephemeral, testing)
- Custom (via `RecordStore` interface)

---

## Summary

| Decision             | v0.1.0-beta Choice                       | Future Evolution                |
| -------------------- | ---------------------------------------- | ------------------------------- |
| **Schema Version**   | `"nucleus-core/v0.1.0-beta"`             | Migration strategy in v1.0.0    |
| **Proof Naming**     | `kind` + `data`                          | Stable                          |
| **Proof Chain ID**   | Readable format                          | Hash-based option in v0.2.0     |
| **OID Chain ID**     | `chainId === oid`                        | Stable                          |
| **OID Signatures**   | ✅ Full verification via @onoal/oid-core | Always enabled (non-negotiable) |
| **Proof Signatures** | ⚠️ Structure only, not verified          | Opt-in verification in v0.2.0   |
| **Revocation**       | NOT implemented                          | Semantics TBD in v0.2.0         |
| **Invariants**       | 7 core invariants                        | Add integrity proofs in v1.0.0  |
| **Test Split**       | Core (73) + Storage (36)                 | Stable                          |
| **Module Registry**  | Singleton                                | Scoped registries if needed     |
| **Storage**          | SQLite only                              | PostgreSQL, IndexedDB in v0.2.0 |

---

## Versioning Philosophy

- **v0.1.0-beta:** Structural integrity, chain consistency (current)
- **v0.2.0:** Cryptographic integrity (signature verification)
- **v1.0.0:** Production-ready with security audit and semver guarantees

Each version builds on the previous one — existing records remain valid, new features are opt-in.
