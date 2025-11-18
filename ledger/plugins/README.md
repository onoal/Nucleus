# @onoal/ledger-plugins

**Plugins for Onoal Ledger**

Extensible plugins for ZK proofs, webhooks, and analytics (BetterAuth pattern).

## 📦 Installation

```bash
pnpm add @onoal/ledger-plugins
```

## 🚀 Usage

```typescript
import {
  zkPlugin,
  createWebhookPlugin,
  createAnalyticsPlugin,
} from "@onoal/ledger-plugins";
import { createLedger } from "@onoal/ledger-core";

const ledger = createLedger({
  plugins: [
    zkPlugin({ circuit: "ticket_validity.circom" }),
    createWebhookPlugin({ url: "https://..." }),
    createAnalyticsPlugin({ provider: "posthog" }),
  ],
  // ...
});
```

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
