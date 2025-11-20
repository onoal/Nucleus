# Publishing Guide - Nucleus v0.1.0-beta

## Pre-Publishing Checklist

### ✅ Code Quality

- [x] TypeScript compiles without errors
- [x] All core tests passing (73/73)
- [x] OID-core integration complete
- [x] ESLint configured
- [x] Code reviewed and cleaned

### ✅ Documentation

- [x] README.md with installation and usage
- [x] CHANGELOG.md with v0.1.0-beta details
- [x] Examples (basic-usage.ts)
- [x] Inline code documentation

### ✅ Package Configuration

- [x] package.json metadata complete
  - name: `@onoal/nucleus`
  - version: `0.1.0-beta`
  - description, keywords, author, license
  - repository, bugs, homepage URLs
  - engines requirement (Node >=18)
- [x] Dual exports configured (main + storage-sqlite)
- [x] Files list includes: dist, README.md, CHANGELOG.md
- [x] peerDependencies: @onoal/oid-core
- [x] Dependencies verified

### ✅ Build

- [x] WASM core builds successfully
- [x] TypeScript compiles to dist/
- [x] Source maps generated
- [x] All exports present (index, storage-sqlite)

## Publishing Commands

### 1. Dry Run (Verify Package Contents)

```bash
cd packages/nucleus
npm pack --dry-run
# or
pnpm pack
```

### 2. Build for Production

```bash
cd packages/nucleus
pnpm run clean
pnpm run build
```

### 3. Test Before Publishing

```bash
# Test core functionality
pnpm test src/modules src/core

# Verify import paths
node -e "import('@onoal/nucleus').then(console.log)"
```

### 4. Publish to npm

```bash
cd packages/nucleus

# If not logged in to npm
npm login

# Publish beta version
npm publish --access public --tag beta

# or with pnpm
pnpm publish --access public --tag beta
```

### 5. Verify Published Package

```bash
# Check on npm
npm view @onoal/nucleus

# Test installation in a new project
mkdir test-nucleus && cd test-nucleus
npm init -y
npm install @onoal/nucleus
```

## Post-Publishing

### 1. Create GitHub Release

- Tag: `v0.1.0-beta`
- Title: "Nucleus v0.1.0-beta - Initial Beta Release"
- Description: Copy from CHANGELOG.md

### 2. Update Documentation

- Add installation badge to README
- Update project website (if applicable)
- Share announcement

### 3. Monitor

- Watch for issues
- Monitor download stats
- Gather user feedback

## Known Issues for Users

### better-sqlite3 Native Dependencies

Some users may encounter better-sqlite3 build errors. Solutions documented in README:

1. Use pre-built binaries
2. Install build tools (Python setuptools, node-gyp)
3. Skip SQLite tests (core works without it)

### Breaking Changes in Future Versions

Document in CHANGELOG.md when shipping v0.2.0:

- Error code changes (generic INVALID_OID_RECORD)
- OID key structure (old: publicKeyMultibase → new: publicKey)
- Module registry pattern changes

## Support Channels

- GitHub Issues: https://github.com/onoal/nucleus/issues
- Documentation: https://github.com/onoal/nucleus#readme

## Version Strategy

- **Beta (0.x.x-beta)**: Current state, API may change
- **RC (0.x.x-rc)**: Feature-complete, API stable, testing phase
- **Stable (1.0.0)**: Production-ready, semver guarantees

---

**Ready to Publish:** YES ✅

**Recommended npm tag:** `beta`

**Estimated package size:** ~50KB (without node_modules)
