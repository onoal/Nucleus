# @onoal/ledger-module-connect

**Connect grant module for Onoal Ledger**

Business logic module for connect grant management (Medusa.js pattern).

## 📦 Installation

```bash
pnpm add @onoal/ledger-module-connect
```

## 🚀 Usage

```typescript
import { connectModule } from "@onoal/ledger-module-connect";
import { createLedger } from "@onoal/ledger-core";

const ledger = createLedger({
  modules: [connectModule()],
  // ...
});

const connectService = ledger.getService<ConnectService>("connectService");
```

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
