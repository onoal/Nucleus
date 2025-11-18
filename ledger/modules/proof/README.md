# @onoal/ledger-module-proof

**Proof module for Onoal Ledger**

Business logic module for proof management (Medusa.js pattern).

## 📦 Installation

```bash
pnpm add @onoal/ledger-module-proof
```

## 🚀 Usage

```typescript
import { proofModule } from "@onoal/ledger-module-proof";
import { createLedger } from "@onoal/ledger-core";

const ledger = createLedger({
  modules: [proofModule()],
  // ...
});

const proofService = ledger.getService<ProofService>("proofService");
```

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
