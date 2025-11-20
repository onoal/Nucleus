# 🐛 Nucleus v0.1.1-beta - CommonJS Compatibility Fix

**Bug fix release: Adds CommonJS support for better ecosystem compatibility**

---

## 🔧 What's Fixed

### CommonJS Support

Fixed `ERR_PACKAGE_PATH_NOT_EXPORTED` error when using `require()` to import the package.

**Before (v0.1.0-beta):**

- ❌ Only ESM (`import`) was supported
- ❌ `require('@onoal/nucleus')` threw error

**After (v0.1.1-beta):**

- ✅ ESM (`import`) works
- ✅ CommonJS (`require`) works
- ✅ Both module systems fully supported

---

## 📦 Installation

```bash
# New installation
npm install @onoal/nucleus@beta

# Update from v0.1.0-beta
npm update @onoal/nucleus
```

---

## 🔄 Migration from v0.1.0-beta

**No code changes needed!** This is a pure compatibility fix.

Your existing code will continue to work exactly the same way:

```typescript
// ESM - still works ✅
import { createNucleus } from "@onoal/nucleus";

// CommonJS - now works too! ✅
const { createNucleus } = require("@onoal/nucleus");
```

---

## 🛠️ Technical Details

### Changed Files

- `packages/nucleus/package.json` - Updated `exports` field

### Diff

```diff
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
+   "require": "./dist/index.js",
+   "default": "./dist/index.js"
  },
  "./storage-sqlite": {
    "types": "./dist/storage-sqlite/index.d.ts",
    "import": "./dist/storage-sqlite/index.js",
+   "require": "./dist/storage-sqlite/index.js",
+   "default": "./dist/storage-sqlite/index.js"
  }
}
```

---

## ✅ Verification

Both import styles tested and verified:

```javascript
// CommonJS ✅
const nucleus = require("@onoal/nucleus");
console.log(Object.keys(nucleus));
// ['NUCLEUS_SCHEMA_VERSION', 'Nucleus', 'OidModuleRuntime', ...]

// ESM ✅
import * as nucleus from "@onoal/nucleus";
console.log(Object.keys(nucleus));
// ['NUCLEUS_SCHEMA_VERSION', 'Nucleus', 'OidModuleRuntime', ...]
```

---

## 📋 Commits

- `728d9d7` - fix: add CommonJS support to package.json exports
- `3cee5ef` - chore: bump version to 0.1.1-beta

---

## 📚 Documentation

All documentation from v0.1.0-beta remains valid:

- [README.md](./packages/nucleus/README.md)
- [CHANGELOG.md](./packages/nucleus/CHANGELOG.md)
- [CONTEXT.md](./CONTEXT.md)
- [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)

---

## 🐛 Known Issues

Same as v0.1.0-beta:

1. **better-sqlite3**: Native binding issues on some platforms (optional dependency)
2. **Security**: Proof signature verification not implemented (planned for v0.2.0)

---

## 🛣️ What's Next?

### v0.2.0 (Coming Soon)

- Proof signature verification
- Access control policies
- PostgreSQL storage adapter
- Rate limiting

---

## 📦 Package Details

- **Package:** [@onoal/nucleus](https://www.npmjs.com/package/@onoal/nucleus)
- **Version:** 0.1.1-beta
- **Previous:** 0.1.0-beta
- **License:** MIT
- **Author:** ONOAL

---

## 🙏 Thanks

Thanks to early adopters who reported the CommonJS compatibility issue!

---

**Installation:**

```bash
npm install @onoal/nucleus@beta
```

**Quick Links:**

- [npm Package](https://www.npmjs.com/package/@onoal/nucleus)
- [Report Issues](https://github.com/onoal/nucleus/issues)
- [Discussions](https://github.com/onoal/nucleus/discussions)
