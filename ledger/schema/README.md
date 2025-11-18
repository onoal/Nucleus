# @onoal/ledger-schema

**JSON Schema validation and TypeScript type inference**

Type-safe schema validation and inference for Onoal Ledger entries.

## 📦 Installation

```bash
pnpm add @onoal/ledger-schema
```

## 🚀 Usage

```typescript
import {
  defineSchema,
  InferSchemaType,
  validateSchema,
} from "@onoal/ledger-schema";

const schema = defineSchema({
  ticket: {
    type: "object",
    required: ["event", "seat"],
    properties: {
      event: { type: "string" },
      seat: { type: "string" },
    },
  },
});

type TicketPayload = InferSchemaType<typeof schema.ticket>;

const result = validateSchema(payload, schema.ticket);
```

---

**Status**: 🚧 In Development  
**Version**: 0.1.0
