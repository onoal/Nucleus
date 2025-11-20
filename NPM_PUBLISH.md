# NPM Publish Guide for @onoal/nucleus v0.1.0-beta

## 📦 Package Information

- **Name:** `@onoal/nucleus`
- **Version:** `0.1.0-beta`
- **Tag:** `beta`
- **Registry:** npmjs.com
- **License:** MIT
- **Author:** ONOAL

## ✅ Pre-Publish Checklist

- [x] Build successful (`pnpm run build`)
- [x] 73/73 core tests passing (`pnpm test src/modules src/core`)
- [x] Linting clean (`pnpm run lint`)
- [x] Version updated to `0.1.0-beta`
- [x] CHANGELOG.md updated
- [x] README.md complete
- [x] package.json metadata verified
- [x] All documentation files included

## 🚀 Publishing Steps

### 1. Verify Build Output

```bash
cd packages/nucleus
ls -la dist/
```

**Expected output:**

```
dist/
├── core/
├── modules/
├── storage-sqlite/
├── types/
├── index.js
└── index.d.ts
```

### 2. Dry Run (Test Package)

```bash
npm pack --dry-run
```

**Verify included files:**

- `dist/` (compiled JS + types)
- `README.md`
- `CHANGELOG.md`
- `package.json`

### 3. Login to npm

```bash
npm login
```

**Credentials:** Use ONOAL npm account

### 4. Publish to npm (Beta Tag)

```bash
npm publish --tag beta --access public
```

**Important:**

- `--tag beta`: Tags this release as `beta` (users must explicitly install with `@beta`)
- `--access public`: Makes the scoped package publicly accessible

### 5. Verify Publication

```bash
npm view @onoal/nucleus@beta
npm info @onoal/nucleus versions
```

### 6. Test Installation

```bash
# In a test directory
mkdir test-nucleus && cd test-nucleus
npm init -y
npm install @onoal/nucleus@beta
node -e "console.log(require('@onoal/nucleus'))"
```

## 📢 Announcement Message

### For GitHub Release

````markdown
# 🎉 Nucleus v0.1.0-beta.0 - Initial Beta Release

## What is Nucleus?

Nucleus is a minimal, TypeScript-first ledger system for OID-based verifiable records. It provides cryptographic integrity guarantees for append-only chains of identity and attestation records.

## Key Features

- ✅ **OID Signature Verification**: Full cryptographic validation via @onoal/oid-core
- ✅ **Append-Only Chains**: Sequential indices with deterministic hashing (Rust/WASM)
- ✅ **Module Architecture**: Pluggable validation for different record types (OID, Proof)
- ✅ **Type-Safe**: Strict TypeScript with comprehensive type definitions
- ✅ **Storage Adapters**: Pluggable backends (SQLite in beta)

## Installation

```bash
npm install @onoal/nucleus@beta
```
````

## Quick Start

```typescript
import { createNucleus, registerModule, oidModule, proofModule } from "@onoal/nucleus";

// Register modules
registerModule("oid", oidModule);
registerModule("proof", proofModule);

// Create nucleus instance
const nucleus = await createNucleus({ store });

// Append an OID record
await nucleus.append({
  module: "oid",
  chainId: "oid:onoal:user:alice",
  body: { oidRecord: /* OID Core Record */ }
});
```

## Documentation

- [README.md](./packages/nucleus/README.md)
- [CHANGELOG.md](./packages/nucleus/CHANGELOG.md)
- [CONTEXT.md](./CONTEXT.md) - Full architecture overview
- [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md) - Design rationales

## Limitations

**v0.1.0-beta is NOT production-ready:**

- ⚠️ Proof signature verification not implemented (deferred to v0.2.0)
- ⚠️ No access control (trust-on-first-use)
- ⚠️ No rate limiting
- ⚠️ SQLite only (no distributed storage)

See [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md) for complete scope and roadmap.

## What's Next?

- **v0.2.0**: Proof signature verification, access control
- **v1.0.0**: Production-ready with security audit

## Feedback

We'd love your feedback! Open issues or discussions at [github.com/onoal/nucleus](https://github.com/onoal/nucleus).

---

**License:** MIT  
**Author:** ONOAL  
**Package:** [@onoal/nucleus](https://www.npmjs.com/package/@onoal/nucleus)

```

### For npm README (already in package)

The `README.md` in `packages/nucleus/` will be automatically displayed on npmjs.com.

### For Social Media / Discord

```

🎉 We just released Nucleus v0.1.0-beta!

A minimal, TypeScript-first ledger system for OID-based verifiable records with cryptographic integrity guarantees.

✅ OID signature verification
✅ Append-only chains
✅ Pluggable modules
✅ Type-safe

Try it: npm install @onoal/nucleus@beta

Docs: https://github.com/onoal/nucleus

````

## 🔄 Post-Publish Tasks

1. **Create GitHub Release:**
   ```bash
   gh release create v0.1.0-beta --title "v0.1.0-beta: Initial Beta Release" --notes-file NPM_PUBLISH.md --prerelease
````

2. **Update Documentation Sites:**
   - Link to npmjs.com/@onoal/nucleus
   - Update getting-started guides

3. **Announce:**
   - ONOAL Discord
   - GitHub Discussions
   - Social media (Twitter/X, LinkedIn)

4. **Monitor:**
   - npm download stats
   - GitHub issues
   - Community feedback

## 📝 Notes

- **Beta Tag:** Users must explicitly install with `@beta` tag
- **Versioning:** Follows semver (0.x.x for beta, 1.x.x for stable)
- **Deprecation:** When v1.0.0 is released, consider deprecating beta versions

---

**Publication Date:** 2025-11-20  
**Published By:** ONOAL Team
