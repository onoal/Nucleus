# Release Notes: v0.1.1-beta

## 🐛 Bug Fix Release

**Date:** 2025-11-20  
**Version:** v0.1.1-beta  
**Previous:** v0.1.0-beta

---

## 📦 What's Changed

### Fixed

- **CommonJS Support:** Added `require` and `default` exports to `package.json`
  - Previously: Only ESM (`import`) was supported
  - Now: Both CommonJS (`require`) and ESM (`import`) work
  - Fixes: `ERR_PACKAGE_PATH_NOT_EXPORTED` error

### Technical Details

**Before (v0.1.0-beta):**

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```

**After (v0.1.1-beta):**

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.js",    // ✅ Added
    "default": "./dist/index.js"     // ✅ Added
  }
}
```

---

## ✅ Verification

Both import styles now work:

```javascript
// CommonJS ✅
const nucleus = require("@onoal/nucleus");

// ESM ✅
import * as nucleus from "@onoal/nucleus";
```

---

## 📦 Installation

```bash
npm install @onoal/nucleus@beta
```

---

## 🔄 Migration from v0.1.0-beta

No code changes needed! This is a pure compatibility fix.

Simply update to v0.1.1-beta:

```bash
npm update @onoal/nucleus
```

---

## 📋 Commits

- `728d9d7` - fix: add CommonJS support to package.json exports
- `[new]` - chore: bump version to 0.1.1-beta

---

## 🔗 Links

- **npm:** https://www.npmjs.com/package/@onoal/nucleus
- **GitHub:** https://github.com/onoal/Nucleus/tree/release/v0.1.0-beta
- **Tag:** v0.1.1-beta

---

**Ready to publish:** ✅

```bash
cd packages/nucleus
npm publish --tag beta --access public
```
