# Nucleus v0.1.0-beta - Production Readiness Plan

## Status: 95% Complete ✅

**Wat werkt:**
- ✅ Alle core functionaliteit (FASE 1, 2, 3)
- ✅ 131+ tests
- ✅ Type-safe TypeScript
- ✅ SQLite storage
- ✅ proof & oid modules

**Wat ontbreekt voor productie:**
- ⏳ WASM build & integratie
- ⏳ @onoal/oid dependency integratie
- ⏳ Package.json updates
- ⏳ Build & publish setup

---

## Stappenplan naar v0.1.0-beta Release

### **STAP 1: Dependencies & Package Setup** (30 min)

#### 1.1 Update package.json dependencies

**packages/nucleus/package.json:**
```json
{
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "@onoal/oid-core": "^0.1.0"  // ← ADD
  },
  "peerDependencies": {
    "@onoal/oid-core": "^0.1.0"   // ← UPDATE (was @onoal/oid)
  }
}
```

**Root package.json:**
```json
{
  "devDependencies": {
    "@onoal/oid-core": "^0.1.0"  // ← ADD voor development
  }
}
```

#### 1.2 Install dependencies
```bash
cd /Users/thiemodewolf/Development/onoal-os/nucleus
pnpm install
```

**Deliverables:**
- ✅ @onoal/oid-core installed
- ✅ All dependencies up to date
- ✅ No npm/pnpm errors

---

### **STAP 2: OID Library Integration** (1-2 hours)

#### 2.1 Replace custom OID parsing met @onoal/oid-core

**packages/nucleus/src/modules/oid/types.ts:**
```typescript
// REMOVE our custom types:
// - OidRecord
// - PublicKey
// - OidRecordProof
// - parseOid()

// REPLACE with:
import type { 
  OidRecord, 
  PublicKey, 
  OidRecordProof 
} from '@onoal/oid-core';

export type { OidRecord, PublicKey, OidRecordProof };

// Keep our custom types:
export interface OidBody {
  oidRecord: OidRecord;
}

export interface ParsedOid {
  namespace: string;
  type: string;
  identifier: string;
}

// Import parseOid from @onoal/oid-core if available
// Otherwise keep our basic implementation as fallback
```

#### 2.2 Update proof module OID validation

**packages/nucleus/src/modules/proof/validator.ts:**
```typescript
// ADD at top:
import { parseOid, isValidOid } from '@onoal/oid-core';

// UPDATE validation (replace basic "oid:" check):
// BEFORE:
if (!body.subject.startsWith("oid:")) { ... }

// AFTER:
if (!isValidOid(body.subject)) {
  return {
    ok: false,
    errorCode: "INVALID_SUBJECT_OID",
    errorMessage: `Invalid subject OID: ${body.subject}`
  };
}

try {
  parseOid(body.subject);
} catch (error) {
  return {
    ok: false,
    errorCode: "INVALID_SUBJECT_OID",
    errorMessage: `Cannot parse subject OID: ${error.message}`
  };
}

// Same for issuer validation
```

#### 2.3 Update oid module validation

**packages/nucleus/src/modules/oid/validator.ts:**
```typescript
// ADD at top:
import { parseOid, validateOidRecord } from '@onoal/oid-core';
import type { OidRecord } from '@onoal/oid-core';

// UPDATE parseOid calls to use @onoal/oid-core version

// ADD comprehensive OID record validation:
const oidValidation = validateOidRecord(oidRecord);
if (!oidValidation.valid) {
  return {
    ok: false,
    errorCode: "INVALID_OID_RECORD",
    errorMessage: oidValidation.error || "OID record validation failed"
  };
}
```

**Deliverables:**
- ✅ All imports use @onoal/oid-core
- ✅ Proper OID validation
- ✅ Types aligned with official library
- ✅ All tests still pass

---

### **STAP 3: WASM Build & Integration** (1 hour)

#### 3.1 Install Rust toolchain (if not present)
```bash
# Check if Rust is installed
rustc --version

# If not, install:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### 3.2 Install wasm-pack
```bash
cargo install wasm-pack
```

#### 3.3 Build WASM module
```bash
cd packages/nucleus-core-rs
./build.sh
```

Expected output:
```
Building Rust WASM module...
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
✅ WASM build complete!
Output: packages/nucleus/src/wasm/
```

#### 3.4 Verify WASM output
```bash
ls -la packages/nucleus/src/wasm/
# Should contain:
# - nucleus_core_rs.js
# - nucleus_core_rs_bg.wasm
# - nucleus_core_rs.d.ts
# - package.json
```

#### 3.5 Test WASM integration
```bash
cd packages/nucleus
pnpm test src/core/nucleus.test.ts
```

**Deliverables:**
- ✅ WASM module built
- ✅ TypeScript bindings generated
- ✅ Integration tests pass with real WASM
- ✅ Hash computation is deterministic

---

### **STAP 4: Signature Verification (Optional maar aanbevolen)** (2-3 hours)

#### 4.1 Add crypto dependency
```bash
cd packages/nucleus
pnpm add @noble/ed25519
```

#### 4.2 Implement signature verification voor proof module

**packages/nucleus/src/modules/proof/crypto.ts:** (NEW)
```typescript
import { verify } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import type { ProofBody, IssuerProof } from './types.js';

// Setup ed25519 with SHA-512
ed25519.utils.sha512Sync = (...m) => sha512(ed25519.utils.concatBytes(...m));

/**
 * Verify issuerProof signature
 * 
 * TODO: This requires fetching the issuer's OID record to get public key
 * For v0.1.0-beta, we can skip this or implement basic verification
 */
export async function verifyIssuerProof(
  body: ProofBody,
  issuerProof: IssuerProof,
  issuerPublicKey: Uint8Array
): Promise<boolean> {
  try {
    // Create canonical representation (without issuerProof)
    const bodyWithoutProof = { ...body };
    delete bodyWithoutProof.issuerProof;
    
    const message = JSON.stringify(bodyWithoutProof); // TODO: use canonical JSON
    const messageBytes = new TextEncoder().encode(message);
    
    const signatureBytes = base64urlDecode(issuerProof.signature);
    
    return await verify(signatureBytes, messageBytes, issuerPublicKey);
  } catch {
    return false;
  }
}

function base64urlDecode(str: string): Uint8Array {
  // Convert base64url to base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded = atob(base64 + padding);
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}
```

**UPDATE proof validator:**
```typescript
// In validateRecord(), uncomment signature verification:
if (body.issuerProof) {
  // ... existing structure validation ...
  
  // TODO: Fetch issuer's OID record to get public key
  // For now, signature verification is optional
  // const issuerOidRecord = await fetchIssuerOid(body.issuer);
  // const publicKey = extractPublicKey(issuerOidRecord, body.issuerProof.keyRef);
  // const valid = await verifyIssuerProof(body, body.issuerProof, publicKey);
  // if (!valid) {
  //   return { ok: false, errorCode: "INVALID_SIGNATURE", ... };
  // }
}
```

#### 4.3 Implement signature verification voor oid module

Similar approach for `OidRecordProof`.

**Decision:** For v0.1.0-beta, signature verification can be:
- **Option A**: Fully implemented (best, maar meer werk)
- **Option B**: Structure validation only, mark TODO (sneller naar release)
- **Option C**: Optional flag `verifySignatures: boolean` in config

**Aanbeveling:** Start met Option B, add Option C later.

**Deliverables (Option B):**
- ✅ Crypto library installed
- ✅ Helper functions ready (maar commented out)
- ✅ Clear TODO comments voor signature verification
- 📋 Document in README: "Signature verification coming in v0.2.0"

---

### **STAP 5: Build & Bundle Setup** (30 min)

#### 5.1 Add build scripts to package.json
```json
{
  "scripts": {
    "prebuild": "pnpm run clean",
    "build:wasm": "cd ../nucleus-core-rs && ./build.sh",
    "build:ts": "tsc",
    "build": "pnpm run build:wasm && pnpm run build:ts",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist src/wasm"
  }
}
```

#### 5.2 Test full build
```bash
cd packages/nucleus
pnpm build
```

Expected:
- ✅ WASM built to `src/wasm/`
- ✅ TypeScript compiled to `dist/`
- ✅ Type definitions (`.d.ts`) generated
- ✅ No build errors

#### 5.3 Verify package exports
```bash
# Check what will be published
ls -la dist/
# Should mirror src/ structure
```

**Deliverables:**
- ✅ Clean build process
- ✅ All files in correct locations
- ✅ Package ready for npm publish

---

### **STAP 6: Testing & Validation** (1 hour)

#### 6.1 Run all tests
```bash
cd packages/nucleus
pnpm test
```

Expected: **All 131+ tests pass**

#### 6.2 Run integration test with WASM
```bash
# Create test file
cat > test-wasm-integration.ts << 'EOF'
import { createNucleus, registerModule, oidModule, proofModule } from './src/index.js';
import { SQLiteRecordStore } from './src/storage-sqlite/index.js';
import { generateOidChainId } from './src/modules/oid/index.js';

async function test() {
  registerModule('oid', oidModule);
  
  const nucleus = await createNucleus({
    storage: new SQLiteRecordStore(':memory:')
  });
  
  const record = await nucleus.append({
    module: 'oid',
    chainId: generateOidChainId('oid:onoal:user:test'),
    body: {
      oidRecord: {
        oid: 'oid:onoal:user:test',
        schema: 'oid-core/v0.1.1',
        kind: 'human',
        keys: [{ id: '#main', type: 'Ed25519', publicKeyMultibase: 'z6Mk...' }],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        proof: { type: 'ed25519-jcs-2025', createdAt: new Date().toISOString(), keyRef: '#main', signature: 'sig' }
      }
    }
  });
  
  console.log('✅ WASM integration test passed:', record.hash);
}

test().catch(console.error);
EOF

node test-wasm-integration.ts
```

#### 6.3 Type checking
```bash
pnpm typecheck
```

Expected: **No type errors**

#### 6.4 Linting
```bash
pnpm lint
```

Fix any linting issues.

**Deliverables:**
- ✅ All tests green
- ✅ WASM integration verified
- ✅ No type errors
- ✅ Clean lint output

---

### **STAP 7: Documentation Polish** (1 hour)

#### 7.1 Update README.md

Add **Installation** section:
```markdown
## Installation

```bash
npm install @onoal/nucleus @onoal/oid-core
# or
pnpm add @onoal/nucleus @onoal/oid-core
```

## Quick Start

```typescript
import { createNucleus, registerModule, oidModule, proofModule } from '@onoal/nucleus';
import { SQLiteRecordStore } from '@onoal/nucleus/storage-sqlite';

// 1. Register modules
registerModule('oid', oidModule);
registerModule('proof', proofModule);

// 2. Create instance
const nucleus = await createNucleus({
  storage: new SQLiteRecordStore('./nucleus.db')
});

// 3. Use it
const record = await nucleus.append({
  module: 'oid',
  chainId: 'oid:onoal:...',
  body: { oidRecord: {...} }
});
```
```

#### 7.2 Create CHANGELOG.md
```markdown
# Changelog

## [0.1.0-beta] - 2025-11-20

### Added
- 🚀 Initial beta release
- ✅ Core ledger engine with append-only chains
- ✅ Module system (proof & oid modules)
- ✅ SQLite storage adapter
- ✅ WASM-based canonical hashing (Rust)
- ✅ TypeScript SDK with strict types
- ✅ 131+ tests with comprehensive coverage

### Features
- Append-only records with chain consistency
- OID-native proof attestations
- OID record anchoring with history
- Deterministic hash computation
- Module validation framework
- Storage constraints (unique hash, chain index)

### Known Limitations
- Signature verification structure-only (verification TODO)
- SQLite adapter only (Postgres/S3 in future)
- No network replication (local-only)
- No query DSL (basic get/list only)

### Dependencies
- @onoal/oid-core ^0.1.0
- better-sqlite3 ^9.2.2
```

#### 7.3 Add LICENSE
```bash
# Choose license (MIT recommended)
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 ONOAL

Permission is hereby granted, free of charge, to any person obtaining a copy...
EOF
```

#### 7.4 Update package.json metadata
```json
{
  "name": "@onoal/nucleus",
  "version": "0.1.0-beta",
  "description": "Minimal ledger system for OID-based verifiable records",
  "keywords": [
    "ledger",
    "oid",
    "verifiable",
    "append-only",
    "identity",
    "proofs",
    "attestations"
  ],
  "homepage": "https://github.com/onoal-os/nucleus#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/onoal-os/nucleus.git"
  },
  "bugs": {
    "url": "https://github.com/onoal-os/nucleus/issues"
  },
  "author": "ONOAL Team",
  "license": "MIT"
}
```

**Deliverables:**
- ✅ Complete README with examples
- ✅ CHANGELOG documenting v0.1.0-beta
- ✅ LICENSE file
- ✅ Package.json metadata complete

---

### **STAP 8: Pre-publish Checklist** (30 min)

#### 8.1 Version check
```bash
cat packages/nucleus/package.json | grep version
# Should be: "0.1.0-beta"
```

#### 8.2 Files check
```bash
cd packages/nucleus
npm pack --dry-run
```

Review what will be published. Should include:
- `dist/` (compiled JS + types)
- `src/wasm/` (WASM module)
- `README.md`
- `LICENSE`
- `package.json`

#### 8.3 Test installation locally
```bash
# In packages/nucleus
npm pack
# Creates: onoal-nucleus-0.1.0-beta.tgz

# Test in another directory
cd /tmp
npm install /path/to/nucleus/packages/nucleus/onoal-nucleus-0.1.0-beta.tgz
node -e "const n = require('@onoal/nucleus'); console.log(n.NUCLEUS_SCHEMA_VERSION);"
```

#### 8.4 Check npm account & access
```bash
npm whoami
# Make sure you're logged in to correct npm account with @onoal org access
```

**Deliverables:**
- ✅ Version correct
- ✅ Package contents verified
- ✅ Local installation test passed
- ✅ npm account ready

---

### **STAP 9: Publish to npm** (15 min)

#### 9.1 Publish package
```bash
cd packages/nucleus
npm publish --tag beta --access public
```

Expected output:
```
+ @onoal/nucleus@0.1.0-beta
```

#### 9.2 Verify on npm
```bash
npm view @onoal/nucleus
```

#### 9.3 Test installation from npm
```bash
cd /tmp/test-install
npm install @onoal/nucleus@beta @onoal/oid-core
node -e "console.log(require('@onoal/nucleus'))"
```

**Deliverables:**
- ✅ Package published to npm
- ✅ Version tagged as beta
- ✅ Public access confirmed
- ✅ Installation from npm works

---

### **STAP 10: Post-publish** (30 min)

#### 10.1 Create Git tag
```bash
git tag v0.1.0-beta
git push origin v0.1.0-beta
```

#### 10.2 Create GitHub release
- Go to GitHub releases
- Create new release from tag `v0.1.0-beta`
- Title: "Nucleus v0.1.0-beta - Initial Release"
- Copy CHANGELOG.md content
- Mark as "pre-release"

#### 10.3 Update documentation
- Link to npm package
- Add installation badge
- Update status from "in development" to "beta"

#### 10.4 Announce (optional)
- Internal team notification
- Update ONOAL documentation
- Social media (if applicable)

**Deliverables:**
- ✅ Git tagged
- ✅ GitHub release created
- ✅ Documentation updated
- ✅ Team notified

---

## Timeline Estimate

| Stap | Taak | Tijd | Totaal |
|------|------|------|--------|
| 1 | Dependencies setup | 30 min | 30 min |
| 2 | OID integration | 1-2 hrs | 2.5 hrs |
| 3 | WASM build | 1 hr | 3.5 hrs |
| 4 | Signature verification | 0-3 hrs | 3.5-6.5 hrs |
| 5 | Build setup | 30 min | 4-7 hrs |
| 6 | Testing | 1 hr | 5-8 hrs |
| 7 | Documentation | 1 hr | 6-9 hrs |
| 8 | Pre-publish | 30 min | 6.5-9.5 hrs |
| 9 | Publish | 15 min | 6.75-9.75 hrs |
| 10 | Post-publish | 30 min | 7.25-10.25 hrs |

**Total: 7-10 hours** (1-2 werkdagen)

**Minimaal pad (skip step 4):** ~7 hours
**Volledig pad (met signatures):** ~10 hours

---

## Critical Path (Must Do)

✅ **Minimaal voor v0.1.0-beta release:**
1. ✅ Install @onoal/oid-core
2. ✅ Update imports to use @onoal/oid-core types
3. ✅ Build WASM module
4. ✅ Run all tests (must pass)
5. ✅ Build package
6. ✅ Publish to npm

📋 **Can be deferred to v0.1.1 or v0.2.0:**
- Full signature verification implementation
- Additional storage adapters
- Query DSL
- Performance optimizations

---

## Risk Mitigation

**Risk 1: WASM build fails**
- Solution: Pre-built WASM binaries in repo
- Fallback: Pure TypeScript hash (slower but works)

**Risk 2: @onoal/oid-core types don't match**
- Solution: Keep custom types as wrappers
- Fallback: Use our own OID types with note in docs

**Risk 3: Tests fail with real WASM**
- Solution: Mock hash function for tests
- Fix: Update test fixtures for real hashes

---

## Success Criteria

✅ v0.1.0-beta is production-ready when:
- [ ] All 131+ tests pass with WASM
- [ ] Package installs from npm
- [ ] Example code runs successfully
- [ ] Documentation is complete
- [ ] No critical bugs
- [ ] @onoal/oid-core integrated
- [ ] WASM module built and working

---

## Next Steps

Start met: **STAP 1** - Dependencies setup

```bash
cd /Users/thiemodewolf/Development/onoal-os/nucleus
# Begin implementation...
```

