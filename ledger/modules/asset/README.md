# @onoal/ledger-module-asset

**Asset module for Onoal Ledger**

Business logic module for asset management (Medusa.js pattern).

## 📦 Installation

```bash
pnpm add @onoal/ledger-module-asset
```

## 🚀 Usage

```typescript
import { assetModule } from "@onoal/ledger-module-asset";
import { createLedger } from "@onoal/ledger-core";

const ledger = createLedger({
  modules: [assetModule()],
  // ...
});

const assetService = ledger.getService<AssetService>("assetService");
```

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
