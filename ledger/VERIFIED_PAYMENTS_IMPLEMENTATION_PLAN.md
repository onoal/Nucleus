# Verified Payments Module - Implementatie Stappenplan

**Laatste update**: 2025-01-27  
**Doel**: Gedetailleerd stappenplan voor implementatie van Verified Payments Module

---

## 📋 Overzicht

Dit stappenplan beschrijft de implementatie van de **Payment Module** voor het Ledger Framework. Elke stap bevat:

- **Wat**: Wat wordt geïmplementeerd
- **Waar**: Exacte locatie in de codebase
- **Waarom**: Motivatie en context
- **Hoe**: Concrete implementatie details

---

## 🎯 Fase 1: Foundation & Core Module Structure

### Stap 1.1: Project Setup & Package Configuration

**Wat**: Aanmaken van de payment module package structuur

**Waar**: `ledger/modules/payment/`

**Waarom**:

- Consistente structuur met andere modules (token, asset, proof)
- Package.json voor dependencies en exports
- TypeScript configuratie voor type safety

**Hoe**:

1. **Maak folder structuur**:

```bash
ledger/modules/payment/
├── src/
│   ├── index.ts
│   ├── models/
│   │   └── payment.ts
│   ├── schema/
│   │   ├── index.ts
│   │   ├── payments.ts
│   │   └── payments-sqlite.ts
│   ├── services/
│   │   └── payment-service.ts
│   ├── connectors/
│   │   ├── base.ts
│   │   ├── stripe.ts
│   │   ├── mollie.ts
│   │   └── ledger-token.ts
│   └── routes/
│       └── payment-routes.ts
├── package.json
├── tsconfig.json
└── README.md
```

2. **Package.json** (gebaseerd op `ledger/modules/token/package.json`):

```json
{
  "name": "@onoal/ledger-module-payment",
  "version": "0.1.0",
  "description": "Payment module for Onoal Ledger Framework - verified payments with Stripe, Mollie, and ledger tokens",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./schema": {
      "import": "./dist/schema/index.js",
      "types": "./dist/schema/index.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["onoal", "ledger", "payment", "stripe", "mollie", "verified"],
  "author": "Onoal",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/onoal/onoal-os.git",
    "directory": "ledger/modules/payment"
  },
  "dependencies": {
    "@onoal/ledger-core": "workspace:*",
    "drizzle-orm": "^0.29.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.9.2",
    "vitest": "^1.0.0"
  }
}
```

3. **tsconfig.json** (gebaseerd op `ledger/modules/token/tsconfig.json`):

```json
{
  "extends": "../../../packages/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Codebase Analyse**:

- **Token Module**: `ledger/modules/token/package.json` - Referentie voor package structuur
- **Module Pattern**: Alle modules volgen dezelfde structuur voor consistentie

---

### Stap 1.2: Type Definitions & Models

**Wat**: TypeScript type definitions voor payments

**Waar**: `ledger/modules/payment/src/models/payment.ts`

**Waarom**:

- Type safety voor payment entities
- Consistente data structuren
- Documentatie via types

**Hoe**:

```typescript
/**
 * Payment model types
 *
 * Type definitions for payment entities and operations.
 *
 * @module models/payment
 */

/**
 * Payment provider type
 */
export type PaymentProvider = "stripe" | "mollie" | "ledger_token";

/**
 * Payment status
 */
export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

/**
 * Payment account status
 */
export type PaymentAccountStatus = "active" | "inactive" | "suspended";

/**
 * Payment account
 */
export interface PaymentAccount {
  id: string; // pay_acc_<uuidv7>
  account_oid: string; // oid:onoal:org:... | oid:onoal:user:...
  provider: PaymentProvider;
  provider_account_id: string; // Stripe customer ID, Mollie customer ID, etc.
  status: PaymentAccountStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}

/**
 * Payment
 */
export interface Payment {
  id: string; // pay_<uuidv7>
  account_oid: string;
  provider: PaymentProvider;
  provider_payment_id: string; // Stripe payment intent ID, Mollie payment ID, etc.
  amount: bigint; // In smallest unit (cents)
  currency: string; // "EUR", "USD", etc.
  status: PaymentStatus;
  ledger_entry_id?: string | null; // Reference to ledger entry
  token_id?: string | null; // For ledger token payments
  metadata?: Record<string, unknown> | null;
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}

/**
 * Refund
 */
export interface Refund {
  id: string; // ref_<uuidv7>
  payment_id: string; // Reference to payment
  provider_refund_id: string; // Stripe refund ID, etc.
  amount: bigint; // Refund amount in smallest unit
  status: "pending" | "succeeded" | "failed";
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
}

/**
 * Create payment account options
 */
export interface CreatePaymentAccountOptions {
  account_oid: string;
  provider: PaymentProvider;
  metadata?: Record<string, unknown>;
}

/**
 * Create payment options
 */
export interface CreatePaymentOptions {
  account_oid: string;
  provider: PaymentProvider;
  amount: bigint; // In smallest unit
  currency: string;
  token_id?: string; // For ledger token payments
  payee_oid?: string; // For ledger token payments (who receives)
  metadata?: Record<string, unknown>;
  description?: string;
}

/**
 * Refund payment options
 */
export interface RefundPaymentOptions {
  payment_id: string;
  amount?: bigint; // Partial refund (if not provided, full refund)
  reason?: string;
}
```

**Codebase Analyse**:

- **Token Models**: `ledger/modules/token/src/models/token.ts` - Referentie voor model structuur
- **BigInt Handling**: Tokens gebruiken BigInt voor amounts, zelfde patroon voor payments

---

### Stap 1.3: Database Schema (PostgreSQL)

**Wat**: Drizzle schema definitie voor PostgreSQL

**Waar**: `ledger/modules/payment/src/schema/payments.ts`

**Waarom**:

- Type-safe database queries
- Automatische migraties
- Consistente schema definitie

**Hoe**:

```typescript
/**
 * Payment schema for PostgreSQL
 *
 * Database schema for payment accounts and payments.
 *
 * @module schema/payments
 */

import {
  pgTable,
  text,
  bigint,
  pgEnum,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Payment provider enum
 */
export const paymentProviderEnum = pgEnum("payment_provider", [
  "stripe",
  "mollie",
  "ledger_token",
]);

/**
 * Payment status enum
 */
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);

/**
 * Payment account status enum
 */
export const paymentAccountStatusEnum = pgEnum("payment_account_status", [
  "active",
  "inactive",
  "suspended",
]);

/**
 * Payment accounts table
 */
export const paymentAccountsPg = pgTable(
  "payment_accounts",
  {
    id: text("id").primaryKey(), // pay_acc_<uuidv7>
    accountOid: text("account_oid").notNull(), // oid:onoal:org:... | oid:onoal:user:...
    provider: paymentProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    status: paymentAccountStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Unique: one account per provider per OID
    accountProviderUnique: unique("uq_payment_accounts_account_provider").on(
      table.accountOid,
      table.provider
    ),
    // Indexes
    accountOidIdx: index("idx_payment_accounts_account_oid").on(
      table.accountOid
    ),
    providerIdx: index("idx_payment_accounts_provider").on(table.provider),
    statusIdx: index("idx_payment_accounts_status").on(table.status),
  })
);

/**
 * Payments table
 */
export const paymentsPg = pgTable(
  "payments",
  {
    id: text("id").primaryKey(), // pay_<uuidv7>
    accountOid: text("account_oid").notNull(),
    provider: paymentProviderEnum("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(), // In smallest unit
    currency: text("currency").notNull(), // "EUR", "USD", etc.
    status: paymentStatusEnum("status").notNull().default("pending"),
    ledgerEntryId: text("ledger_entry_id"), // Reference to ledger entry
    tokenId: text("token_id"), // For ledger token payments
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Unique: prevent duplicate provider payments
    providerPaymentUnique: unique("uq_payments_provider_payment").on(
      table.provider,
      table.providerPaymentId
    ),
    // Indexes
    accountOidIdx: index("idx_payments_account_oid").on(table.accountOid),
    providerIdx: index("idx_payments_provider").on(table.provider),
    statusIdx: index("idx_payments_status").on(table.status),
    ledgerEntryIdx: index("idx_payments_ledger_entry").on(table.ledgerEntryId),
    tokenIdIdx: index("idx_payments_token_id").on(table.tokenId),
  })
);

/**
 * Refunds table
 */
export const refundsPg = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(), // ref_<uuidv7>
    paymentId: text("payment_id")
      .notNull()
      .references(() => paymentsPg.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "succeeded" | "failed"
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    // Indexes
    paymentIdIdx: index("idx_refunds_payment_id").on(table.paymentId),
    statusIdx: index("idx_refunds_status").on(table.status),
  })
);

/**
 * Export schema
 */
export const paymentSchema = {
  paymentAccounts: paymentAccountsPg,
  payments: paymentsPg,
  refunds: refundsPg,
};
```

**Codebase Analyse**:

- **Token Schema**: `ledger/modules/token/src/schema/tokens.ts` - Referentie voor schema structuur
- **Enum Pattern**: Gebruik `pgEnum` voor type-safe enums
- **BigInt Handling**: PostgreSQL gebruikt `bigint` mode voor BigInt values
- **Indexes**: Strategische indexes voor query performance

---

### Stap 1.4: Database Schema (SQLite)

**Wat**: Drizzle schema definitie voor SQLite

**Waar**: `ledger/modules/payment/src/schema/payments-sqlite.ts`

**Waarom**:

- SQLite heeft andere type handling (text voor BigInt)
- Consistente API tussen PostgreSQL en SQLite
- Development/testing support

**Hoe**:

```typescript
/**
 * Payment schema for SQLite
 *
 * Database schema for payment accounts and payments (SQLite version).
 *
 * @module schema/payments-sqlite
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Payment accounts table (SQLite)
 */
export const paymentAccountsSqlite = sqliteTable(
  "payment_accounts",
  {
    id: text("id").primaryKey(), // pay_acc_<uuidv7>
    accountOid: text("account_oid").notNull(),
    provider: text("provider").notNull(), // "stripe" | "mollie" | "ledger_token"
    providerAccountId: text("provider_account_id").notNull(),
    status: text("status").notNull().default("active"), // "active" | "inactive" | "suspended"
    metadata: text("metadata").$type<Record<string, unknown> | null>(), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    accountProviderUnique: unique("uq_payment_accounts_account_provider").on(
      table.accountOid,
      table.provider
    ),
    accountOidIdx: index("idx_payment_accounts_account_oid").on(
      table.accountOid
    ),
    providerIdx: index("idx_payment_accounts_provider").on(table.provider),
    statusIdx: index("idx_payment_accounts_status").on(table.status),
  })
);

/**
 * Payments table (SQLite)
 */
export const paymentsSqlite = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(), // pay_<uuidv7>
    accountOid: text("account_oid").notNull(),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    amount: text("amount").notNull(), // BigInt as string
    currency: text("currency").notNull(),
    status: text("status").notNull().default("pending"),
    ledgerEntryId: text("ledger_entry_id"),
    tokenId: text("token_id"),
    metadata: text("metadata").$type<Record<string, unknown> | null>(), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    providerPaymentUnique: unique("uq_payments_provider_payment").on(
      table.provider,
      table.providerPaymentId
    ),
    accountOidIdx: index("idx_payments_account_oid").on(table.accountOid),
    providerIdx: index("idx_payments_provider").on(table.provider),
    statusIdx: index("idx_payments_status").on(table.status),
    ledgerEntryIdx: index("idx_payments_ledger_entry").on(table.ledgerEntryId),
    tokenIdIdx: index("idx_payments_token_id").on(table.tokenId),
  })
);

/**
 * Refunds table (SQLite)
 */
export const refundsSqlite = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(), // ref_<uuidv7>
    paymentId: text("payment_id")
      .notNull()
      .references(() => paymentsSqlite.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id").notNull(),
    amount: text("amount").notNull(), // BigInt as string
    status: text("status").notNull().default("pending"),
    reason: text("reason"),
    metadata: text("metadata").$type<Record<string, unknown> | null>(), // JSON string
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => ({
    paymentIdIdx: index("idx_refunds_payment_id").on(table.paymentId),
    statusIdx: index("idx_refunds_status").on(table.status),
  })
);

/**
 * Export schema
 */
export const paymentSchemaSqlite = {
  paymentAccounts: paymentAccountsSqlite,
  payments: paymentsSqlite,
  refunds: refundsSqlite,
};
```

**Codebase Analyse**:

- **Token Schema SQLite**: `ledger/modules/token/src/schema/tokens-sqlite.ts` - Referentie voor SQLite schema
- **BigInt Serialization**: SQLite gebruikt `text` voor BigInt (serialized as string)
- **Timestamps**: SQLite gebruikt `integer` met `$defaultFn(() => Date.now())`

---

### Stap 1.5: Schema Index Export

**Wat**: Unified schema export voor module registratie

**Waar**: `ledger/modules/payment/src/schema/index.ts`

**Waarom**:

- Eén export point voor schema's
- Automatische provider detection
- Consistente API

**Hoe**:

```typescript
/**
 * Payment schema exports
 *
 * Unified schema export for module registration.
 *
 * @module schema/index
 */

import { paymentSchema } from "./payments.js";
import { paymentSchemaSqlite } from "./payments-sqlite.js";

/**
 * Export both schemas for reference
 */
export { paymentSchema, paymentSchemaSqlite };

/**
 * Drizzle schema for module registration
 *
 * Database adapter will automatically select the correct schema
 * based on provider (postgres vs sqlite/d1)
 */
export const paymentDrizzleSchema = {
  paymentAccounts: paymentSchema.paymentAccounts, // Will be adapted by database adapter
  payments: paymentSchema.payments,
  refunds: paymentSchema.refunds,
};
```

**Codebase Analyse**:

- **Token Schema Index**: `ledger/modules/token/src/schema/index.ts` - Referentie voor schema export
- **Mesh Schema**: `ledger/modules/mesh/src/schema/index.ts` - Toont hoe schemas worden geëxporteerd
- **Adapter Selection**: Database adapter selecteert automatisch de juiste schema (zie `ledger/framework/src/core/ledger.ts` regel 59-68)

---

## 🎯 Fase 2: Payment Connector Interface

### Stap 2.1: Base Payment Connector Interface

**Wat**: Abstracte interface voor payment providers (Connector pattern)

**Waar**: `ledger/modules/payment/src/connectors/base.ts`

**Waarom**:

- **Connector Pattern**: Nieuw framework concept voor external service integratie
- **Sync Capability**: Connectors kunnen external services synchroniseren met ledger
- **Unified Interface**: Eén interface voor alle payment providers
- **Type Safety**: Volledige TypeScript support
- **Uitbreidbaarheid**: Nieuwe providers toevoegen zonder core te wijzigen
- **Testbaarheid**: Mock connectors voor testing

**Hoe**:

```typescript
/**
 * Base Payment Connector Interface
 *
 * Defines the contract for payment provider connectors.
 * Connectors synchronize external payment services with the ledger.
 * All payment providers (Stripe, Mollie, Ledger Tokens) must implement this interface.
 *
 * **Connector Pattern**: Connectors zijn een nieuw framework concept voor
 * het synchroniseren van external services met het ledger framework.
 * Gelijk aan database adapters, maar voor external services.
 *
 * @module connectors/base
 */

import type {
  PaymentAccount,
  Payment,
  Refund,
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
} from "../models/payment.js";

/**
 * Webhook event from payment provider
 */
export interface WebhookEvent {
  type: string; // "payment.succeeded", "payment.failed", etc.
  paymentId: string; // Provider payment ID
  accountOid: string; // Account OID
  status: Payment["status"];
  metadata?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Payment Connector Interface
 *
 * Connectors synchronize external payment services with the ledger.
 * All payment provider connectors must implement this interface.
 *
 * **Sync Capability**: Connectors kunnen:
 * - External service state synchroniseren met ledger
 * - Webhook events verwerken en ledger updaten
 * - Bidirectional sync (ledger -> external service, external service -> ledger)
 *
 * **Framework Integration**: PaymentConnector extends LedgerConnector,
 * which provides automatic registration, lifecycle hooks, and declarative schema support.
 */
export interface PaymentConnector extends import("@onoal/ledger-core").LedgerConnector {
  /**
   * Connector identifier (required by LedgerConnector)
   */
  id: string; // "stripe", "mollie", "ledger_token"

  /**
   * Human-readable name (required by LedgerConnector)
   */
  name: string;

  /**
   * Connector type (required by LedgerConnector)
   */
  type: "payment";

  /**
   * Create payment account in provider
   *
   * @param options - Account creation options
   * @returns Payment account with provider account ID
   */
  createAccount(
    options: CreatePaymentAccountOptions
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt">>;

  /**
   * Get payment account from provider
   *
   * @param accountId - Provider account ID
   * @returns Payment account or null if not found
   */
  getAccount(
    accountId: string
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt"> | null>;

  /**
   * Create payment in provider
   *
   * @param options - Payment creation options
   * @returns Payment with provider payment ID
   */
  createPayment(
    options: CreatePaymentOptions
  ): Promise<Omit<Payment, "id" | "ledgerEntryId" | "createdAt" | "updatedAt">>;

  /**
   * Get payment from provider
   *
   * @param paymentId - Provider payment ID
   * @returns Payment or null if not found
   */
  getPayment(
    paymentId: string
  ): Promise<Omit<
    Payment,
    "id" | "ledgerEntryId" | "createdAt" | "updatedAt"
  > | null>;

  /**
   * Refund payment
   *
   * @param options - Refund options
   * @returns Refund with provider refund ID
   */
  refundPayment(
    options: RefundPaymentOptions
  ): Promise<Omit<Refund, "id" | "createdAt">>;

  /**
   * Verify webhook signature
   *
   * @param request - Webhook request
   * @param secret - Webhook secret
   * @returns Webhook event if valid, throws if invalid
   */
  verifyWebhook(request: Request, secret: string): Promise<WebhookEvent>;

  /**
   * Parse webhook event from request body
   *
   * @param body - Request body (parsed JSON)
   * @returns Webhook event
   */
  parseWebhookEvent(body: unknown): WebhookEvent;
}
```

**Codebase Analyse**:

- **LedgerConnector Interface**: `ledger/framework/src/core/types.ts` (regel 54-124) - Basis connector interface
- **Connector Registration**: `ledger/framework/src/core/ledger.ts` (regel 363-380) - Automatische registratie
- **Declarative Schema**: Connectors kunnen declarative schema gebruiken voor database tabellen
- **Lifecycle Hooks**: `connect()` en `disconnect()` worden automatisch aangeroepen
- **Database Adapters**: `ledger/database/postgres/src/index.ts` - Referentie voor adapter pattern
- **Interface Pattern**: Abstracte interface voor uitbreidbaarheid
- **Error Handling**: Connectors gooien errors die door PaymentService worden afgehandeld

---

## 🎯 Fase 3: Payment Service

### Stap 3.1: Payment Service Core

**Wat**: Core PaymentService class met account en payment management

**Waar**: `ledger/modules/payment/src/services/payment-service.ts`

**Waarom**:

- Centralized business logic
- Service container integratie
- Database abstraction
- Ledger logging

**Hoe**:

```typescript
/**
 * Payment Service for Ledger Framework
 *
 * Provides payment account and payment management functionality.
 * Integrates with payment provider connectors (Stripe, Mollie, Ledger Tokens).
 * Connectors synchronize external payment services with the ledger.
 *
 * @module services/payment-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type { LedgerDatabase } from "@onoal/ledger-core";
import type {
  PaymentAccount,
  Payment,
  Refund,
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
  PaymentProvider,
} from "../models/payment.js";
import type { PaymentConnector } from "../connectors/base.js";
import { paymentSchema } from "../schema/payments.js";
import { paymentSchemaSqlite } from "../schema/payments-sqlite.js";
import { eq, and } from "drizzle-orm";
import { ensureOid } from "@onoal/ledger-core";

/**
 * Payment Service
 *
 * Service-based architecture (Medusa.js pattern) for payment management.
 * Handles payment accounts, payments, refunds, and webhook processing.
 * Uses connectors to synchronize external payment services with the ledger.
 */
export class PaymentService {
  private connectors: Map<PaymentProvider, PaymentConnector> = new Map();

  constructor(
    private ledger: OnoalLedger,
    connectors: PaymentConnector[]
  ) {
    // Register connectors
    for (const connector of connectors) {
      this.connectors.set(connector.id as PaymentProvider, connector);
    }
  }

  /**
   * Get database adapter
   */
  private getAdapter(): LedgerDatabase {
    const database = this.ledger.getService<LedgerDatabase>("database");
    if (!database) {
      throw new Error("Database not available");
    }
    return database;
  }

  /**
   * Get database instance
   */
  private getDb() {
    return this.getAdapter().db;
  }

  /**
   * Get payment schema based on provider
   */
  private getPaymentSchema() {
    const adapter = this.getAdapter();

    if (adapter.provider === "postgres") {
      return paymentSchema;
    } else if (adapter.provider === "sqlite" || adapter.provider === "d1") {
      return paymentSchemaSqlite;
    } else {
      throw new Error(`Unsupported database provider: ${adapter.provider}`);
    }
  }

  /**
   * Helper: Get schema tables
   */
  private getTables() {
    const schema = this.getPaymentSchema();
    return {
      paymentAccounts: schema.paymentAccounts,
      payments: schema.payments,
      refunds: schema.refunds,
    };
  }

  /**
   * Helper: Serialize BigInt for database
   */
  private serializeBigInt(value: bigint, provider: string): string | bigint {
    if (provider === "postgres") {
      return value;
    }
    return value.toString();
  }

  /**
   * Helper: Deserialize BigInt from database
   */
  private deserializeBigInt(value: string | number | bigint): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    return BigInt(value);
  }

  /**
   * Create payment account
   *
   * Creates a payment account in the provider and stores it in the database.
   * Logs account creation in the ledger.
   *
   * @param options - Account creation options
   * @returns Payment account
   */
  async createAccount(
    options: CreatePaymentAccountOptions
  ): Promise<PaymentAccount> {
    const db = this.getDb();
    const tables = this.getTables();
    const adapter = this.getAdapter();

    // 1. Validate OID
    const accountOid = ensureOid(options.account_oid, "account_oid", {
      allowHierarchical: true,
      allowExternalNamespaces: true,
    });

    // 2. Get provider connector
    const providerConnector = this.connectors.get(options.provider);
    if (!providerConnector) {
      throw new Error(`Provider ${options.provider} not available`);
    }

    // 3. Check idempotency (if account already exists)
    const existing = await db.query.paymentAccounts?.findFirst({
      where: and(
        eq(tables.paymentAccounts.accountOid, accountOid),
        eq(tables.paymentAccounts.provider, options.provider)
      ),
    });

    if (existing) {
      // Return existing account
      return {
        id: existing.id,
        account_oid: existing.accountOid,
        provider: existing.provider as PaymentProvider,
        provider_account_id: existing.providerAccountId,
        status: existing.status as PaymentAccount["status"],
        metadata: existing.metadata as Record<string, unknown> | null,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    // 4. Create account in provider (via connector)
    // Connector synchronizes external service state with ledger
    const providerAccount = await providerConnector.createAccount({
      account_oid: accountOid,
      provider: options.provider,
      metadata: options.metadata,
    });

    // 5. Store in database
    const accountId = `pay_acc_${crypto.randomUUID()}`;
    const now = Date.now();

    await db.insert(tables.paymentAccounts).values({
      id: accountId,
      accountOid: accountOid,
      provider: options.provider,
      providerAccountId: providerAccount.provider_account_id,
      status: "active",
      metadata: options.metadata || null,
      createdAt: now,
      updatedAt: now,
    });

    // 6. Log in ledger
    await this.ledger.append({
      type: "payment_account_created",
      issuer_oid: accountOid,
      payload: {
        account_id: accountId,
        provider: options.provider,
        provider_account_id: providerAccount.provider_account_id,
      },
    });

    return {
      id: accountId,
      account_oid: accountOid,
      provider: options.provider,
      provider_account_id: providerAccount.provider_account_id,
      status: "active",
      metadata: options.metadata || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Create payment
   *
   * Creates a payment in the provider and stores it in the database.
   * Logs payment creation in the ledger.
   *
   * @param options - Payment creation options
   * @returns Payment
   */
  async createPayment(options: CreatePaymentOptions): Promise<Payment> {
    const db = this.getDb();
    const tables = this.getTables();
    const adapter = this.getAdapter();

    // 1. Validate OID
    const accountOid = ensureOid(options.account_oid, "account_oid", {
      allowHierarchical: true,
      allowExternalNamespaces: true,
    });

    // 2. Get provider connector
    const providerConnector = this.connectors.get(options.provider);
    if (!providerConnector) {
      throw new Error(`Provider ${options.provider} not available`);
    }

    // 3. Create payment in provider (via connector)
    // Connector synchronizes external service state with ledger
    const providerPayment = await providerConnector.createPayment({
      account_oid: accountOid,
      provider: options.provider,
      amount: options.amount,
      currency: options.currency,
      token_id: options.token_id,
      payee_oid: options.payee_oid,
      metadata: options.metadata,
      description: options.description,
    });

    // 4. Store in database
    const paymentId = `pay_${crypto.randomUUID()}`;
    const now = Date.now();

    await db.insert(tables.payments).values({
      id: paymentId,
      accountOid: accountOid,
      provider: options.provider,
      providerPaymentId: providerPayment.provider_payment_id,
      amount: this.serializeBigInt(options.amount, adapter.provider),
      currency: options.currency,
      status: providerPayment.status,
      tokenId: options.token_id || null,
      metadata: options.metadata || null,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Log in ledger
    const ledgerEntry = await this.ledger.append({
      type: "payment_created",
      issuer_oid: accountOid,
      payload: {
        payment_id: paymentId,
        provider: options.provider,
        provider_payment_id: providerPayment.provider_payment_id,
        amount: options.amount.toString(),
        currency: options.currency,
        status: providerPayment.status,
        token_id: options.token_id,
      },
    });

    // 6. Update payment with ledger entry ID
    await db
      .update(tables.payments)
      .set({ ledgerEntryId: ledgerEntry.id })
      .where(eq(tables.payments.id, paymentId));

    return {
      id: paymentId,
      account_oid: accountOid,
      provider: options.provider,
      provider_payment_id: providerPayment.provider_payment_id,
      amount: options.amount,
      currency: options.currency,
      status: providerPayment.status,
      ledger_entry_id: ledgerEntry.id,
      token_id: options.token_id || null,
      metadata: options.metadata || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get payment by ID
   *
   * @param paymentId - Payment ID
   * @returns Payment or null if not found
   */
  async getPayment(paymentId: string): Promise<Payment | null> {
    const db = this.getDb();
    const tables = this.getTables();

    const payment = await db.query.payments?.findFirst({
      where: eq(tables.payments.id, paymentId),
    });

    if (!payment) {
      return null;
    }

    return {
      id: payment.id,
      account_oid: payment.accountOid,
      provider: payment.provider as PaymentProvider,
      provider_payment_id: payment.providerPaymentId,
      amount: this.deserializeBigInt(payment.amount),
      currency: payment.currency,
      status: payment.status as Payment["status"],
      ledger_entry_id: payment.ledgerEntryId || null,
      token_id: payment.tokenId || null,
      metadata: payment.metadata as Record<string, unknown> | null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Update payment status
   *
   * Updates payment status and logs in ledger.
   *
   * @param paymentId - Payment ID
   * @param status - New status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: Payment["status"]
  ): Promise<void> {
    const db = this.getDb();
    const tables = this.getTables();

    const payment = await this.getPayment(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // Update in database
    await db
      .update(tables.payments)
      .set({
        status: status,
        updatedAt: Date.now(),
      })
      .where(eq(tables.payments.id, paymentId));

    // Log in ledger
    await this.ledger.append({
      type: "payment_status_updated",
      issuer_oid: payment.account_oid,
      payload: {
        payment_id: paymentId,
        provider: payment.provider,
        old_status: payment.status,
        new_status: status,
      },
    });
  }

  /**
   * Handle webhook
   *
   * Verifies webhook signature and updates payment status.
   *
   * @param provider - Payment provider
   * @param request - Webhook request
   * @param secret - Webhook secret
   */
  async handleWebhook(
    provider: PaymentProvider,
    request: Request,
    secret: string
  ): Promise<void> {
    // 1. Get provider connector
    const providerConnector = this.connectors.get(provider);
    if (!providerConnector) {
      throw new Error(`Provider ${provider} not available`);
    }

    // 2. Verify webhook (via connector)
    // Connector verifies webhook signature and parses event
    const event = await providerConnector.verifyWebhook(request, secret);

    // 3. Update payment status
    if (event.type === "payment.succeeded" || event.type === "payment.failed") {
      // Find payment by provider payment ID
      const db = this.getDb();
      const tables = this.getTables();

      const payment = await db.query.payments?.findFirst({
        where: and(
          eq(tables.payments.provider, provider),
          eq(tables.payments.providerPaymentId, event.paymentId)
        ),
      });

      if (payment) {
        await this.updatePaymentStatus(payment.id, event.status);
      }
    }
  }
}
```

**Codebase Analyse**:

- **Token Service**: `ledger/modules/token/src/services/token-service.ts` - Referentie voor service structuur
- **Service Pattern**: Services krijgen `ledger` in constructor voor service container access
- **Connector Pattern**: Gelijk aan database adapters, maar voor external services
- **Sync Integration**: Connectors synchroniseren external service state met ledger
- **Database Access**: Via `ledger.getService<LedgerDatabase>("database")`
- **BigInt Handling**: Serialize/deserialize helpers voor database compatibility
- **Ledger Logging**: Alle belangrijke events worden gelogd via `ledger.append()`

---

## 🎯 Fase 4: Payment Connectors

### Stap 4.1: Ledger Token Connector

**Wat**: Connector voor ledger token payments (gebruikt Token Module)

**Waar**: `ledger/modules/payment/src/connectors/ledger-token.ts`

**Waarom**:

- Integratie met Token Module voor token transfers
- Instant payments (geen externe provider nodig)
- Gebruikt bestaande token infrastructure

**Hoe**:

```typescript
/**
 * Ledger Token Payment Connector
 *
 * Connector for payments using ledger tokens (via Token Module).
 * Transfers tokens from payer to payee.
 *
 * **Sync**: Deze connector synchroniseert token transfers direct met de ledger
 * (geen external service nodig, maar volgt hetzelfde connector pattern).
 *
 * @module connectors/ledger-token
 */

import type { PaymentConnector, WebhookEvent } from "./base.js";
import type {
  PaymentAccount,
  Payment,
  Refund,
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
} from "../models/payment.js";
import type { TokenService } from "@onoal/ledger-module-token";
import type { OnoalLedger } from "@onoal/ledger-core";

/**
 * Ledger Token Payment Connector
 *
 * Connector for ledger token payments.
 * Uses Token Module to transfer tokens as payments.
 * Synchronizes token transfers directly with the ledger.
 */
export class LedgerTokenConnector implements PaymentConnector {
  id = "ledger_token" as const;
  name = "Ledger Token";

  constructor(private ledger: OnoalLedger) {}

  /**
   * Get Token Service
   */
  private getTokenService(): TokenService {
    const tokenService = this.ledger.getService<TokenService>("tokenService");
    if (!tokenService) {
      throw new Error(
        "Token Module not available. Please add tokenModule() to your ledger."
      );
    }
    return tokenService;
  }

  /**
   * Create account (no-op for ledger tokens)
   *
   * Ledger tokens don't require account creation in provider.
   * We just return the account OID as provider account ID.
   */
  async createAccount(
    options: CreatePaymentAccountOptions
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt">> {
    // For ledger tokens, the account OID is the provider account ID
    return {
      account_oid: options.account_oid,
      provider: "ledger_token",
      provider_account_id: options.account_oid, // Use OID as account ID
      status: "active",
      metadata: options.metadata || null,
    };
  }

  /**
   * Get account (no-op for ledger tokens)
   */
  async getAccount(
    accountId: string
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt"> | null> {
    // For ledger tokens, account ID is the OID
    return {
      account_oid: accountId,
      provider: "ledger_token",
      provider_account_id: accountId,
      status: "active",
      metadata: null,
    };
  }

  /**
   * Create payment (transfer tokens)
   *
   * Transfers tokens from payer to payee using Token Module.
   */
  async createPayment(
    options: CreatePaymentOptions
  ): Promise<
    Omit<Payment, "id" | "ledgerEntryId" | "createdAt" | "updatedAt">
  > {
    if (!options.token_id) {
      throw new Error("token_id is required for ledger token payments");
    }
    if (!options.payee_oid) {
      throw new Error("payee_oid is required for ledger token payments");
    }

    const tokenService = this.getTokenService();

    // Get current nonce for payer account
    const payerBalance = await tokenService.getBalance(
      options.token_id,
      options.account_oid,
      options.account_oid
    );

    if (!payerBalance) {
      throw new Error(`Token account not found for ${options.account_oid}`);
    }

    // Transfer tokens from payer to payee
    const transfer = await tokenService.transferToken({
      tokenId: options.token_id,
      from: options.account_oid, // Payer
      to: options.payee_oid, // Payee
      amount: options.amount,
      nonce: payerBalance.nonce,
      txId: crypto.randomUUID(),
      actorOid: options.account_oid,
      ctx: {
        payment_currency: options.currency,
        payment_description: options.description,
        ...options.metadata,
      },
    });

    // Token transfers are instant (succeeded immediately)
    return {
      account_oid: options.account_oid,
      provider: "ledger_token",
      provider_payment_id: transfer.tx_id, // Use transaction ID as payment ID
      amount: options.amount,
      currency: options.currency,
      status: "succeeded", // Token transfers are instant
      token_id: options.token_id,
      metadata: options.metadata || null,
    };
  }

  /**
   * Get payment (query token ledger)
   */
  async getPayment(
    paymentId: string
  ): Promise<Omit<
    Payment,
    "id" | "ledgerEntryId" | "createdAt" | "updatedAt"
  > | null> {
    // For ledger tokens, payment ID is the transaction ID
    // We would need to query the token ledger, but for now return null
    // This could be enhanced to query token ledger by tx_id
    return null;
  }

  /**
   * Refund payment (reverse transfer)
   *
   * Creates a reverse transfer from payee back to payer.
   */
  async refundPayment(
    options: RefundPaymentOptions
  ): Promise<Omit<Refund, "id" | "createdAt">> {
    // Get payment to find payee and token
    // This would require storing payee_oid in payment metadata
    // For now, throw error (to be implemented)
    throw new Error("Refunds for ledger token payments not yet implemented");
  }

  /**
   * Verify webhook (not applicable for ledger tokens)
   */
  async verifyWebhook(request: Request, secret: string): Promise<WebhookEvent> {
    throw new Error("Webhooks not supported for ledger token payments");
  }

  /**
   * Parse webhook event (not applicable)
   */
  parseWebhookEvent(body: unknown): WebhookEvent {
    throw new Error("Webhooks not supported for ledger token payments");
  }
}
```

**Codebase Analyse**:

- **Token Service**: `ledger/modules/token/src/services/token-service.ts` - Referentie voor token operations
- **Service Access**: Via `ledger.getService<TokenService>("tokenService")`
- **Transfer Pattern**: Gebruikt `transferToken` voor payments
- **Instant Payments**: Token transfers zijn instant (geen async status updates)
- **Connector Pattern**: Deze connector synchroniseert direct met ledger (geen external service)

---

### Stap 4.2: Stripe Connector (Stub)

**Wat**: Stripe payment connector (basis structuur)

**Waar**: `ledger/modules/payment/src/connectors/stripe.ts`

**Waarom**:

- **External Service Sync**: Synchroniseert Stripe payment state met ledger
- **Webhook Sync**: Verwerkt Stripe webhooks en update ledger status
- Stripe is populaire payment provider
- Credit cards, ACH, SEPA support
- Webhook support voor status updates

**Hoe**:

```typescript
/**
 * Stripe Payment Connector
 *
 * Connector for Stripe payments (credit cards, ACH, SEPA).
 * Synchronizes Stripe payment state with the ledger.
 *
 * **Sync Features**:
 * - Payment status sync (Stripe -> Ledger)
 * - Webhook event processing
 * - Bidirectional sync (create in Stripe, log in ledger)
 *
 * @module connectors/stripe
 */

import type { PaymentConnector, WebhookEvent } from "./base.js";
import type {
  PaymentAccount,
  Payment,
  Refund,
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
} from "../models/payment.js";

/**
 * Stripe Payment Connector
 *
 * Connector for Stripe payments.
 * Synchronizes Stripe API state with the ledger.
 */
export class StripeConnector implements PaymentConnector {
  id = "stripe" as const;
  name = "Stripe";

  constructor(private apiKey: string) {
    // Initialize Stripe SDK
    // import Stripe from "stripe";
    // this.stripe = new Stripe(apiKey, { apiVersion: "2024-11-20.acacia" });
  }

  async createAccount(
    options: CreatePaymentAccountOptions
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt">> {
    // TODO: Create Stripe customer
    // const customer = await this.stripe.customers.create({
    //   metadata: { account_oid: options.account_oid },
    // });

    throw new Error("Stripe connector not yet implemented");
  }

  async getAccount(
    accountId: string
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt"> | null> {
    throw new Error("Stripe connector not yet implemented");
  }

  async createPayment(
    options: CreatePaymentOptions
  ): Promise<
    Omit<Payment, "id" | "ledgerEntryId" | "createdAt" | "updatedAt">
  > {
    // TODO: Create Stripe Payment Intent
    // const paymentIntent = await this.stripe.paymentIntents.create({
    //   amount: Number(options.amount),
    //   currency: options.currency.toLowerCase(),
    //   metadata: { account_oid: options.account_oid },
    // });

    throw new Error("Stripe connector not yet implemented");
  }

  async getPayment(
    paymentId: string
  ): Promise<Omit<
    Payment,
    "id" | "ledgerEntryId" | "createdAt" | "updatedAt"
  > | null> {
    throw new Error("Stripe connector not yet implemented");
  }

  async refundPayment(
    options: RefundPaymentOptions
  ): Promise<Omit<Refund, "id" | "createdAt">> {
    throw new Error("Stripe connector not yet implemented");
  }

  async verifyWebhook(request: Request, secret: string): Promise<WebhookEvent> {
    // TODO: Verify Stripe webhook signature
    // const signature = request.headers.get("stripe-signature");
    // const event = this.stripe.webhooks.constructEvent(body, signature, secret);

    throw new Error("Stripe connector not yet implemented");
  }

  parseWebhookEvent(body: unknown): WebhookEvent {
    throw new Error("Stripe connector not yet implemented");
  }
}
```

**Codebase Analyse**:

- **Connector Pattern**: Gelijk aan database adapters, maar voor external services
- **Sync Capability**: Synchroniseert Stripe payment state met ledger
- **Webhook Sync**: Verwerkt Stripe webhooks en update ledger status
- **Stripe SDK**: Vereist `stripe` package (toe te voegen aan dependencies)
- **Webhook Verification**: Stripe heeft eigen signature verification

---

### Stap 4.3: Mollie Connector (Stub)

**Wat**: Mollie payment connector (basis structuur)

**Waar**: `ledger/modules/payment/src/connectors/mollie.ts`

**Waarom**:

- **External Service Sync**: Synchroniseert Mollie payment state met ledger
- **Webhook Sync**: Verwerkt Mollie webhooks en update ledger status
- Europese payment methods (iDEAL, Bancontact, etc.)
- Populair in Nederland/België
- Webhook support

**Hoe**:

```typescript
/**
 * Mollie Payment Connector
 *
 * Connector for Mollie payments (iDEAL, Bancontact, etc.).
 * Synchronizes Mollie payment state with the ledger.
 *
 * **Sync Features**:
 * - Payment status sync (Mollie -> Ledger)
 * - Webhook event processing
 * - Bidirectional sync (create in Mollie, log in ledger)
 *
 * @module connectors/mollie
 */

import type { PaymentConnector, WebhookEvent } from "./base.js";
import type {
  PaymentAccount,
  Payment,
  Refund,
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
} from "../models/payment.js";

/**
 * Mollie Payment Connector
 *
 * Connector for Mollie payments.
 * Synchronizes Mollie API state with the ledger.
 */
export class MollieConnector implements PaymentConnector {
  id = "mollie" as const;
  name = "Mollie";

  constructor(private apiKey: string) {
    // Initialize Mollie SDK
    // import { MollieClient } from "@mollie/api-client";
    // this.mollie = new MollieClient({ apiKey });
  }

  async createAccount(
    options: CreatePaymentAccountOptions
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt">> {
    // TODO: Create Mollie customer
    throw new Error("Mollie connector not yet implemented");
  }

  async getAccount(
    accountId: string
  ): Promise<Omit<PaymentAccount, "id" | "createdAt" | "updatedAt"> | null> {
    throw new Error("Mollie connector not yet implemented");
  }

  async createPayment(
    options: CreatePaymentOptions
  ): Promise<
    Omit<Payment, "id" | "ledgerEntryId" | "createdAt" | "updatedAt">
  > {
    // TODO: Create Mollie payment
    throw new Error("Mollie connector not yet implemented");
  }

  async getPayment(
    paymentId: string
  ): Promise<Omit<
    Payment,
    "id" | "ledgerEntryId" | "createdAt" | "updatedAt"
  > | null> {
    throw new Error("Mollie connector not yet implemented");
  }

  async refundPayment(
    options: RefundPaymentOptions
  ): Promise<Omit<Refund, "id" | "createdAt">> {
    throw new Error("Mollie connector not yet implemented");
  }

  async verifyWebhook(request: Request, secret: string): Promise<WebhookEvent> {
    // TODO: Verify Mollie webhook
    throw new Error("Mollie connector not yet implemented");
  }

  parseWebhookEvent(body: unknown): WebhookEvent {
    throw new Error("Mollie connector not yet implemented");
  }
}
```

**Codebase Analyse**:

- **Connector Pattern**: Gelijk aan database adapters, maar voor external services
- **Sync Capability**: Synchroniseert Mollie payment state met ledger
- **Webhook Sync**: Verwerkt Mollie webhooks en update ledger status
- **Mollie SDK**: Vereist `@mollie/api-client` package
- **Webhook Pattern**: Gelijk aan Stripe maar andere signature methode

---

## 🎯 Fase 5: Module Registration & Routes

### Stap 5.1: Payment Module Export

**Wat**: Main module export met service en route registratie

**Waar**: `ledger/modules/payment/src/index.ts`

**Waarom**:

- Eén export point voor de module
- Service registratie
- Route registratie
- Schema registratie

**Hoe**:

````typescript
/**
 * Payment module for Onoal Ledger
 *
 * Provides payment account and payment management functionality.
 * Supports Stripe, Mollie, and ledger token payments.
 *
 * @module ledger-module-payment
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { createCustomModule, ensureOid } from "@onoal/ledger-core";
import { PaymentService } from "./services/payment-service.js";
import { paymentDrizzleSchema } from "./schema/index.js";
import { LedgerTokenConnector } from "./connectors/ledger-token.js";
import type { PaymentConnector } from "./connectors/base.js";
import type {
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
} from "./models/payment.js";

/**
 * Payment Module Options
 */
export interface PaymentModuleOptions {
  /**
   * Payment provider connectors
   *
   * Connectors synchronize external payment services with the ledger.
   * Gelijk aan database adapters, maar voor external services.
   */
  connectors?: PaymentConnector[];

  /**
   * Stripe API key (optional, for Stripe connector)
   */
  stripeApiKey?: string;

  /**
   * Mollie API key (optional, for Mollie connector)
   */
  mollieApiKey?: string;

  /**
   * Enable ledger token payments (requires tokenModule)
   */
  enableLedgerTokens?: boolean; // default: true
}

/**
 * Payment Module
 *
 * Provides payment account and payment management functionality.
 * Registers PaymentService and API routes.
 *
 * @example
 * ```typescript
 * import { paymentModule } from "@onoal/ledger-module-payment";
 * import { createLedger } from "@onoal/ledger-core";
 * import { tokenModule } from "@onoal/ledger-module-token";
 *
 * const ledger = await createLedger({
 *   modules: [
 *     tokenModule(), // Required for ledger token payments
 *     paymentModule({
 *       stripeApiKey: env.STRIPE_SECRET_KEY,
 *       mollieApiKey: env.MOLLIE_API_KEY,
 *       enableLedgerTokens: true,
 *     }),
 *   ],
 * });
 *
 * // Use payment service
 * const paymentService = ledger.getService<PaymentService>("paymentService");
 * const account = await paymentService.createAccount({
 *   account_oid: "oid:onoal:org:company",
 *   provider: "stripe",
 * });
 * ```
 */
export function paymentModule(options: PaymentModuleOptions = {}) {
  // Build connectors list
  const connectors: PaymentConnector[] = [];

  // Add ledger token connector (if enabled and token module available)
  if (options.enableLedgerTokens !== false) {
    // Connector will be created in service constructor with ledger context
    // We'll pass a factory function instead
    connectors.push({
      id: "ledger_token",
      name: "Ledger Token",
      // Factory will be called in service constructor
    } as any);
  }

  // Add Stripe connector (if API key provided)
  if (options.stripeApiKey) {
    // TODO: Import and create StripeConnector
    // connectors.push(new StripeConnector(options.stripeApiKey));
  }

  // Add Mollie connector (if API key provided)
  if (options.mollieApiKey) {
    // TODO: Import and create MollieConnector
    // connectors.push(new MollieConnector(options.mollieApiKey));
  }

  // Add custom connectors
  if (options.connectors) {
    connectors.push(...options.connectors);
  }

  return createCustomModule({
    id: "payment",
    label: "Payment Module",
    version: "0.1.0",
    dependencies: [], // Optional: ["token"] if ledger tokens enabled
    services: {
      // PaymentService needs connectors, so we use a factory
      paymentService: (ledger: OnoalLedger) => {
        // Build connectors with ledger context
        const serviceConnectors: PaymentConnector[] = [];

        // Add ledger token connector
        if (options.enableLedgerTokens !== false) {
          serviceConnectors.push(new LedgerTokenConnector(ledger));
        }

        // Add Stripe connector
        if (options.stripeApiKey) {
          // TODO: serviceConnectors.push(new StripeConnector(options.stripeApiKey));
        }

        // Add Mollie connector
        if (options.mollieApiKey) {
          // TODO: serviceConnectors.push(new MollieConnector(options.mollieApiKey));
        }

        // Add custom connectors
        if (options.connectors) {
          serviceConnectors.push(...options.connectors);
        }

        return new PaymentService(ledger, serviceConnectors);
      },
    },
    // Drizzle schema tables (automatically registered with database adapter)
    drizzleSchema: paymentDrizzleSchema,
    routes: [
      // POST /payment/account - Create payment account
      {
        method: "POST",
        path: "/payment/account",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const paymentService =
            ledger.getService<PaymentService>("paymentService");

          const contentType = req.headers.get("content-type") || "";
          if (!contentType.toLowerCase().includes("application/json")) {
            return Response.json(
              { error: 'Content-Type must be "application/json"' },
              { status: 400 }
            );
          }

          try {
            const body = (await req.json()) as CreatePaymentAccountOptions;

            if (!body.account_oid || !body.provider) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["account_oid", "provider"],
                },
                { status: 400 }
              );
            }

            const account = await paymentService.createAccount(body);

            return Response.json(account);
          } catch (error) {
            console.error("Payment account creation error:", error);
            return Response.json(
              {
                error: "Failed to create payment account",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /payment/account/:id - Get payment account
      {
        method: "GET",
        path: "/payment/account/:id",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined>
        ) => {
          const paymentService =
            ledger.getService<PaymentService>("paymentService");
          const accountId = params.id;

          if (!accountId) {
            return Response.json(
              { error: "Account ID required" },
              { status: 400 }
            );
          }

          try {
            // TODO: Implement getAccount in PaymentService
            return Response.json({ error: "Not implemented" }, { status: 501 });
          } catch (error) {
            return Response.json(
              {
                error: "Failed to retrieve payment account",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // POST /payment - Create payment
      {
        method: "POST",
        path: "/payment",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined> & {
            _requester_oid?: string;
          }
        ) => {
          const paymentService =
            ledger.getService<PaymentService>("paymentService");

          const contentType = req.headers.get("content-type") || "";
          if (!contentType.toLowerCase().includes("application/json")) {
            return Response.json(
              { error: 'Content-Type must be "application/json"' },
              { status: 400 }
            );
          }

          try {
            const body = (await req.json()) as CreatePaymentOptions & {
              amount?: string; // BigInt as string
            };

            if (
              !body.account_oid ||
              !body.provider ||
              !body.amount ||
              !body.currency
            ) {
              return Response.json(
                {
                  error: "Missing required fields",
                  required: ["account_oid", "provider", "amount", "currency"],
                },
                { status: 400 }
              );
            }

            // Parse amount (BigInt from string)
            const amount = BigInt(body.amount);

            const payment = await paymentService.createPayment({
              ...body,
              amount,
            });

            return Response.json(payment);
          } catch (error) {
            console.error("Payment creation error:", error);
            return Response.json(
              {
                error: "Failed to create payment",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // GET /payment/:id - Get payment
      {
        method: "GET",
        path: "/payment/:id",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined>
        ) => {
          const paymentService =
            ledger.getService<PaymentService>("paymentService");
          const paymentId = params.id;

          if (!paymentId) {
            return Response.json(
              { error: "Payment ID required" },
              { status: 400 }
            );
          }

          try {
            const payment = await paymentService.getPayment(paymentId);

            if (!payment) {
              return Response.json(
                { error: "Payment not found" },
                { status: 404 }
              );
            }

            return Response.json({
              ...payment,
              amount: payment.amount.toString(), // Serialize BigInt
            });
          } catch (error) {
            return Response.json(
              {
                error: "Failed to retrieve payment",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }
        },
      },
      // POST /payment/webhook/:provider - Webhook endpoint
      {
        method: "POST",
        path: "/payment/webhook/:provider",
        handler: async (
          req: Request,
          ledger: OnoalLedger,
          params: Record<string, string | undefined>
        ) => {
          const paymentService =
            ledger.getService<PaymentService>("paymentService");
          const provider = params.provider;

          if (!provider) {
            return Response.json(
              { error: "Provider required" },
              { status: 400 }
            );
          }

          try {
            // Get webhook secret from environment or config
            const secret =
              process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] || "";

            await paymentService.handleWebhook(
              provider as "stripe" | "mollie" | "ledger_token",
              req,
              secret
            );

            return Response.json({ received: true });
          } catch (error) {
            console.error("Webhook handling error:", error);
            return Response.json(
              {
                error: "Webhook verification failed",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
              { status: 400 }
            );
          }
        },
      },
    ],
  });
}

// Re-export types and services
export { PaymentService } from "./services/payment-service.js";
export type {
  PaymentAccount,
  Payment,
  Refund,
  PaymentProvider,
  PaymentStatus,
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
} from "./models/payment.js";
export type { PaymentConnector, WebhookEvent } from "./connectors/base.js";
````

**Codebase Analyse**:

- **Token Module**: `ledger/modules/token/src/index.ts` - Referentie voor module export
- **createCustomModule**: `ledger/framework/src/core/types.ts` - Helper voor module creation
- **Service Factory**: Services kunnen factory functions zijn voor dependency injection
- **Route Handlers**: Gelijk aan token module routes
- **BigInt Serialization**: Amount wordt als string in/uit API

---

## 🎯 Fase 6: Testing & Documentation

### Stap 6.1: Unit Tests

**Wat**: Unit tests voor PaymentService en adapters

**Waar**: `ledger/modules/payment/tests/`

**Waarom**:

- Code quality
- Regression prevention
- Documentation via tests

**Hoe**:

- Test PaymentService methods
- Test adapter interfaces
- Mock database en ledger
- Test error handling

---

### Stap 6.2: Integration Tests

**Wat**: Integration tests met echte database

**Waar**: `ledger/modules/payment/tests/integration/`

**Waarom**:

- End-to-end testing
- Database schema validation
- Ledger integration testing

---

### Stap 6.3: Documentation

**Wat**: README en API documentatie

**Waar**: `ledger/modules/payment/README.md`

**Waarom**:

- Developer experience
- Usage examples
- API reference

---

## 📊 Implementatie Volgorde

### Prioriteit 1 (MVP):

1. ✅ Stap 1.1-1.5: Foundation & Schema
2. ✅ Stap 2.1: Base Adapter Interface
3. ✅ Stap 3.1: Payment Service Core
4. ✅ Stap 4.1: Ledger Token Connector
5. ✅ Stap 5.1: Module Registration

### Prioriteit 2 (Production):

6. Stap 4.2: Stripe Connector (volledige implementatie)
7. Stap 4.3: Mollie Connector (volledige implementatie)
8. Stap 6.1-6.3: Testing & Documentation

### Prioriteit 3 (Advanced):

9. Refund support
10. Payment methods management
11. Recurring payments

---

## 🔍 Codebase Referenties

### Module Pattern:

- **Token Module**: `ledger/modules/token/` - Complete referentie
- **Asset Module**: `ledger/modules/asset/` - Alternatieve referentie
- **Mesh Module**: `ledger/modules/mesh/` - Complexe module referentie

### Service Pattern:

- **Token Service**: `ledger/modules/token/src/services/token-service.ts` - Service implementatie
- **Service Container**: `ledger/framework/src/core/ledger.ts` - Service registratie

### Schema Pattern:

- **Token Schema**: `ledger/modules/token/src/schema/` - PostgreSQL + SQLite schemas
- **Schema Registration**: `ledger/framework/src/core/ledger.ts` (regel 121-164) - Hoe schemas worden geregistreerd

### Connector Pattern:

- **Framework Support**: ✅ Connector pattern is nu geïmplementeerd in het framework
- **LedgerConnector Interface**: `ledger/framework/src/core/types.ts` (regel 54-124) - Basis connector interface
- **Module Connectors Property**: `ledger/framework/src/core/types.ts` (regel 206-239) - `connectors` property in modules
- **Declarative Schema**: Connectors kunnen declarative schema definitions gebruiken (gelijk aan modules)
- **Service Container**: Connectors worden automatisch geregistreerd (`connector:${id}` en `connectors:${type}`)
- **Lifecycle Hooks**: Automatische `connect()` tijdens module start, `disconnect()` tijdens module stop
- **Helper Methods**: `ledger.getConnector(id)`, `ledger.getConnectorsByType(type)`, `ledger.getConnectors()`
- **Database Adapters**: `ledger/database/` - Referentie voor adapter pattern
- **Sync Capability**: Connectors synchroniseren external service state met ledger

---

## ✅ Checklist per Stap

### Stap 1: Foundation

- [ ] Package.json aangemaakt
- [ ] tsconfig.json aangemaakt
- [ ] Folder structuur aangemaakt
- [ ] Type definitions (models/payment.ts)
- [ ] PostgreSQL schema (schema/payments.ts)
- [ ] SQLite schema (schema/payments-sqlite.ts)
- [ ] Schema index export (schema/index.ts)

### Stap 2: Connector Interface

- [ ] Base connector interface (connectors/base.ts)

### Stap 3: Payment Service

- [ ] PaymentService class (services/payment-service.ts)
- [ ] createAccount method
- [ ] createPayment method
- [ ] getPayment method
- [ ] updatePaymentStatus method
- [ ] handleWebhook method

### Stap 4: Payment Connectors

- [ ] LedgerTokenConnector (connectors/ledger-token.ts)
- [ ] StripeConnector stub (connectors/stripe.ts)
- [ ] MollieConnector stub (connectors/mollie.ts)

### Stap 5: Module Registration

- [ ] paymentModule() export (index.ts)
- [ ] Service registratie
- [ ] Route registratie
- [ ] Schema registratie

### Stap 6: Testing & Docs

- [ ] Unit tests
- [ ] Integration tests
- [ ] README.md
- [ ] API documentatie

---

## 🚀 Next Steps

Na voltooiing van dit stappenplan:

1. Implementeer Stripe connector volledig
2. Implementeer Mollie connector volledig
3. Voeg refund support toe
4. Voeg payment methods management toe
5. Documentatie in `@onoal-docs`
