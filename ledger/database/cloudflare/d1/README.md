# @onoal/ledger-database-cloudflare-d1

**Cloudflare D1 database adapter for Onoal Ledger**

D1 adapter for Cloudflare Workers.

## 📦 Installation

```bash
pnpm add @onoal/ledger-database-cloudflare-d1
```

## 🚀 Usage

```typescript
import { d1Adapter } from "@onoal/ledger-database-cloudflare-d1";
import { createLedger } from "@onoal/ledger-core";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const ledger = createLedger({
      adapter: d1Adapter(env.DB),
      // ...
    });
    // ...
  },
};
```

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
