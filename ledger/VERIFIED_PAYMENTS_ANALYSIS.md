# Verified Payments - Analyse

**Laatste update**: 2025-01-27  
**Doel**: Analyse van verified payments in het Onoal ecosysteem - Module, Plugin, of eigen Framework?

---

## 📋 Executive Summary

**Verified Payments** moet een unified payment systeem bieden dat werkt met:

- ✅ **Ledger Framework** - Eigen token payments (double-entry accounting)
- ✅ **Stripe** - Credit card, ACH, SEPA payments
- ✅ **Mollie** - European payment methods
- ✅ **Andere providers** - Uitbreidbaar via adapters
- ✅ **OID-Native** - Payment accounts gekoppeld aan OID
- ✅ **Webhook Support** - Payment status updates via webhooks
- ✅ **Ledger Integration** - Alle payments gelogd in ledger voor verificatie

**Kernvraag**: Moet dit een **Module**, **Plugin**, of **eigen Framework** zijn?

---

## 🎯 Requirements

### Functional Requirements

1. **Payment Methods**:
   - Ledger tokens (via Token Module)
   - Stripe (credit cards, ACH, SEPA)
   - Mollie (iDEAL, Bancontact, etc.)
   - Uitbreidbaar voor andere providers

2. **Payment Accounts**:
   - Gekoppeld aan OID (`account_oid`)
   - Provider-specifieke account IDs
   - Metadata (payment method, status, etc.)

3. **Payment Processing**:
   - Initiate payment
   - Verify payment status
   - Handle webhooks
   - Refund support

4. **Ledger Integration**:
   - Alle payments gelogd in ledger
   - Verifieerbare payment records
   - Proof generation voor payments

5. **Webhook Support**:
   - Provider webhooks (Stripe, Mollie, etc.)
   - Ledger webhooks (payment status updates)
   - Idempotency handling

---

## 🏗️ Architectuur Opties

### Optie 1: Ledger Module

**Pattern**: Gelijk aan `tokenModule`, `assetModule`, `proofModule`

**Voordelen**:

- ✅ Consistent met bestaande modules
- ✅ Service container integratie
- ✅ Routes automatisch geregistreerd
- ✅ Database schema via Drizzle
- ✅ Volledige controle over business logic

**Nadelen**:

- ❌ Moet werken met externe providers (Stripe, Mollie)
- ❌ Webhook handling vereist eigen routes
- ❌ Minder flexibel voor verschillende use cases

**Implementatie**:

```typescript
import { paymentModule } from "@onoal/ledger-module-payment";

const ledger = await createLedger({
  modules: [
    tokenModule(), // Required for ledger token payments
    paymentModule({
      providers: {
        stripe: { apiKey: env.STRIPE_SECRET_KEY },
        mollie: { apiKey: env.MOLLIE_API_KEY },
      },
    }),
  ],
});

// Use payment service
const paymentService = ledger.getService("paymentService");
const payment = await paymentService.createPayment({
  account_oid: "oid:onoal:org:company",
  amount: 10000, // €100.00 (in cents)
  currency: "EUR",
  provider: "stripe", // or "mollie" or "ledger_token"
  token_id: "tok_...", // For ledger token payments
});
```

**Database Schema**:

```typescript
// payment_accounts table
{
  id: string; // pay_acc_<uuidv7>
  account_oid: string; // oid:onoal:org:...
  provider: "stripe" | "mollie" | "ledger_token";
  provider_account_id: string; // Stripe customer ID, Mollie customer ID, etc.
  status: "active" | "inactive" | "suspended";
  metadata: jsonb;
}

// payments table
{
  id: string; // pay_<uuidv7>
  account_oid: string;
  provider: "stripe" | "mollie" | "ledger_token";
  provider_payment_id: string; // Stripe payment intent ID, etc.
  amount: bigint; // In smallest unit (cents)
  currency: string; // "EUR", "USD", etc.
  status: "pending" | "processing" | "succeeded" | "failed" | "refunded";
  ledger_entry_id: string; // Reference to ledger entry
  metadata: jsonb;
}
```

**Routes**:

- `POST /payment/account` - Create payment account
- `GET /payment/account/:id` - Get payment account
- `POST /payment` - Create payment
- `GET /payment/:id` - Get payment status
- `POST /payment/:id/refund` - Refund payment
- `POST /payment/webhook/:provider` - Webhook endpoint

---

### Optie 2: Plugin

**Pattern**: Gelijk aan `webhookPlugin`, `analyticsPlugin`, `auditLogPlugin`

**Voordelen**:

- ✅ Lichter gewicht (geen eigen routes)
- ✅ Kan hooks gebruiken voor ledger events
- ✅ Optioneel (niet required voor ledger)

**Nadelen**:

- ❌ Geen eigen services (moet via hooks)
- ❌ Geen database schema (moet via andere manier)
- ❌ Minder controle over business logic
- ❌ Webhook routes moeten elders geregistreerd worden

**Implementatie**:

```typescript
import { paymentPlugin } from "@onoal/ledger-plugins";

const ledger = await createLedger({
  modules: [tokenModule()],
  plugins: [
    paymentPlugin({
      providers: {
        stripe: { apiKey: env.STRIPE_SECRET_KEY },
        mollie: { apiKey: env.MOLLIE_API_KEY },
      },
      onPaymentSuccess: async (payment, ledger) => {
        // Custom logic
      },
    }),
  ],
});

// Payment service moet via andere manier beschikbaar zijn
// Bijvoorbeeld via een aparte service container
```

**Probleem**: Plugins hebben geen eigen services of routes. Dit zou een grote beperking zijn voor payments.

---

### Optie 3: Eigen Framework (Payment Framework)

**Pattern**: Gelijk aan `Ledger Framework`, maar dan voor payments

**Voordelen**:

- ✅ Volledige controle over architectuur
- ✅ Kan standalone gebruikt worden
- ✅ Provider adapters (zoals database adapters)
- ✅ Flexibele integratie met Ledger Framework

**Nadelen**:

- ❌ Meer complexiteit
- ❌ Moet eigen service container hebben
- ❌ Minder geïntegreerd met Ledger Framework
- ❌ Duplicatie van patterns

**Implementatie**:

```typescript
import { createPaymentService } from "@onoal/payment-core";
import { stripeAdapter } from "@onoal/payment-adapter-stripe";
import { mollieAdapter } from "@onoal/payment-adapter-mollie";
import { ledgerTokenAdapter } from "@onoal/payment-adapter-ledger";

const paymentService = await createPaymentService({
  adapters: [
    stripeAdapter({ apiKey: env.STRIPE_SECRET_KEY }),
    mollieAdapter({ apiKey: env.MOLLIE_API_KEY }),
    ledgerTokenAdapter({ ledger }), // Integratie met Ledger Framework
  ],
  ledger: ledger, // Optioneel, voor logging
});
```

**Probleem**: Dit zou een compleet nieuw framework zijn, wat waarschijnlijk overkill is.

---

## 🎯 Aanbeveling: **Module met Provider Adapters**

### Waarom Module?

1. **Consistentie**: Past perfect in het Ledger Framework patroon
2. **Services**: Payment service kan in service container
3. **Routes**: Automatische route registratie
4. **Schema**: Database schema via Drizzle
5. **Integratie**: Directe integratie met Token Module

### Waarom Provider Adapters?

1. **Flexibiliteit**: Verschillende providers via adapters
2. **Uitbreidbaarheid**: Nieuwe providers toevoegen zonder core te wijzigen
3. **Testbaarheid**: Mock adapters voor testing
4. **Consistentie**: Gelijk aan database adapters pattern

### Architectuur

```
@onoal/ledger-module-payment/
├── src/
│   ├── index.ts              # paymentModule() export
│   ├── services/
│   │   └── payment-service.ts # PaymentService class
│   ├── adapters/
│   │   ├── base.ts           # PaymentAdapter interface
│   │   ├── stripe.ts         # Stripe adapter
│   │   ├── mollie.ts         # Mollie adapter
│   │   └── ledger-token.ts   # Ledger token adapter
│   ├── schema/
│   │   ├── payments.ts       # Drizzle schema
│   │   └── payment-accounts.ts
│   ├── models/
│   │   └── payment.ts         # Type definitions
│   └── routes/
│       └── payment-routes.ts # API routes
├── package.json
└── README.md
```

### Provider Adapter Interface

```typescript
interface PaymentAdapter {
  id: string; // "stripe", "mollie", "ledger_token"
  name: string;

  // Account management
  createAccount(
    accountOid: string,
    metadata?: Record<string, unknown>
  ): Promise<PaymentAccount>;
  getAccount(accountId: string): Promise<PaymentAccount | null>;

  // Payment processing
  createPayment(options: CreatePaymentOptions): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment | null>;
  refundPayment(paymentId: string, amount?: bigint): Promise<Refund>;

  // Webhook handling
  verifyWebhook(request: Request, secret: string): Promise<WebhookEvent>;
  parseWebhookEvent(body: unknown): WebhookEvent;
}
```

### Payment Service

```typescript
class PaymentService {
  private adapters: Map<string, PaymentAdapter>;
  private ledger: OnoalLedger;

  // Account management
  async createAccount(options: {
    account_oid: string;
    provider: "stripe" | "mollie" | "ledger_token";
    metadata?: Record<string, unknown>;
  }): Promise<PaymentAccount> {
    const adapter = this.adapters.get(options.provider);
    if (!adapter) {
      throw new Error(`Provider ${options.provider} not available`);
    }

    // Create account in provider
    const providerAccount = await adapter.createAccount(
      options.account_oid,
      options.metadata
    );

    // Store in database
    const account = await this.db.insert(paymentAccounts).values({
      id: `pay_acc_${uuidv7()}`,
      account_oid: options.account_oid,
      provider: options.provider,
      provider_account_id: providerAccount.id,
      status: "active",
      metadata: options.metadata,
    });

    // Log in ledger
    await this.ledger.append({
      type: "payment_account_created",
      issuer_oid: options.account_oid,
      payload: {
        account_id: account.id,
        provider: options.provider,
      },
    });

    return account;
  }

  // Payment creation
  async createPayment(options: {
    account_oid: string;
    provider: "stripe" | "mollie" | "ledger_token";
    amount: bigint;
    currency: string;
    token_id?: string; // For ledger token payments
    metadata?: Record<string, unknown>;
  }): Promise<Payment> {
    const adapter = this.adapters.get(options.provider);
    if (!adapter) {
      throw new Error(`Provider ${options.provider} not available`);
    }

    // Create payment in provider
    const providerPayment = await adapter.createPayment({
      accountOid: options.account_oid,
      amount: options.amount,
      currency: options.currency,
      tokenId: options.token_id,
      metadata: options.metadata,
    });

    // Store in database
    const payment = await this.db.insert(payments).values({
      id: `pay_${uuidv7()}`,
      account_oid: options.account_oid,
      provider: options.provider,
      provider_payment_id: providerPayment.id,
      amount: options.amount,
      currency: options.currency,
      status: "pending",
      metadata: options.metadata,
    });

    // Log in ledger
    const ledgerEntry = await this.ledger.append({
      type: "payment_created",
      issuer_oid: options.account_oid,
      payload: {
        payment_id: payment.id,
        provider: options.provider,
        amount: options.amount.toString(),
        currency: options.currency,
        status: "pending",
      },
    });

    // Update payment with ledger entry ID
    await this.db
      .update(payments)
      .set({ ledger_entry_id: ledgerEntry.id })
      .where(eq(payments.id, payment.id));

    return { ...payment, ledger_entry_id: ledgerEntry.id };
  }

  // Webhook handling
  async handleWebhook(provider: string, request: Request): Promise<void> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not available`);
    }

    // Verify webhook
    const secret = this.getWebhookSecret(provider);
    const event = await adapter.verifyWebhook(request, secret);

    // Update payment status
    if (event.type === "payment.succeeded" || event.type === "payment.failed") {
      await this.updatePaymentStatus(event.paymentId, event.status);

      // Log in ledger
      await this.ledger.append({
        type: "payment_status_updated",
        issuer_oid: event.accountOid,
        payload: {
          payment_id: event.paymentId,
          status: event.status,
          provider: provider,
        },
      });
    }
  }
}
```

---

## 🔄 Integratie met Ledger Framework

### Token Payments

Voor ledger token payments gebruikt de module de Token Module:

```typescript
// In ledger-token adapter
class LedgerTokenAdapter implements PaymentAdapter {
  private tokenService: TokenService;

  async createPayment(options: CreatePaymentOptions): Promise<Payment> {
    // Transfer tokens from payer to payee
    const transfer = await this.tokenService.transferToken({
      tokenId: options.tokenId!,
      from: options.accountOid, // Payer
      to: options.payeeOid, // Payee (from metadata)
      amount: options.amount,
      nonce: await this.getNonce(options.accountOid, options.tokenId),
      txId: uuidv7(),
      actorOid: options.accountOid,
      ctx: {
        payment_id: `pay_${uuidv7()}`,
        currency: options.currency,
      },
    });

    return {
      id: transfer.ctx.payment_id,
      status: "succeeded", // Token transfers are instant
      provider_payment_id: transfer.tx_id,
    };
  }
}
```

### Ledger Logging

Alle payments worden gelogd in de ledger:

```typescript
// Payment created
await ledger.append({
  type: "payment_created",
  issuer_oid: account_oid,
  payload: {
    payment_id: "pay_...",
    provider: "stripe",
    amount: "10000",
    currency: "EUR",
    status: "pending",
  },
});

// Payment succeeded
await ledger.append({
  type: "payment_succeeded",
  issuer_oid: account_oid,
  payload: {
    payment_id: "pay_...",
    provider: "stripe",
    provider_payment_id: "pi_...",
    ledger_entry_id: "ledger_entry_...",
  },
});
```

---

## 📊 Vergelijking

| Feature                | Module | Plugin | Framework |
| ---------------------- | ------ | ------ | --------- |
| **Services**           | ✅     | ❌     | ✅        |
| **Routes**             | ✅     | ❌     | ✅        |
| **Database Schema**    | ✅     | ❌     | ✅        |
| **Provider Adapters**  | ✅     | ⚠️     | ✅        |
| **Ledger Integration** | ✅     | ⚠️     | ⚠️        |
| **Webhook Support**    | ✅     | ⚠️     | ✅        |
| **Consistentie**       | ✅     | ⚠️     | ❌        |
| **Complexiteit**       | Medium | Low    | High      |

---

## 🎯 Conclusie: **Module met Provider Adapters**

### Waarom?

1. **Perfecte fit**: Past in het Ledger Framework patroon
2. **Flexibiliteit**: Provider adapters voor uitbreidbaarheid
3. **Integratie**: Directe integratie met Token Module en Ledger
4. **Consistentie**: Gelijk aan andere modules (token, asset, proof)
5. **Services & Routes**: Volledige controle over business logic

### Implementatie Plan

**Fase 1: Core Module**

- Payment Service
- Database schema (payment_accounts, payments)
- Base PaymentAdapter interface

**Fase 2: Provider Adapters**

- Ledger Token Adapter (gebruikt Token Module)
- Stripe Adapter
- Mollie Adapter

**Fase 3: Webhook Support**

- Webhook routes
- Webhook verification
- Status updates

**Fase 4: Advanced Features**

- Refunds
- Payment methods management
- Recurring payments

---

## 📚 Referenties

- **Token Module**: `ledger/modules/token/` - Double-entry accounting
- **Database Adapters**: `ledger/database/` - Adapter pattern
- **Module Pattern**: `ledger/framework/src/core/types.ts` - createCustomModule
- **Webhook Plugin**: `ledger/plugins/src/` - Webhook patterns (TODO)

---

## 🚀 Next Steps

1. **Proof of Concept**: Implementeer basis Payment Module met Ledger Token adapter
2. **Stripe Integration**: Voeg Stripe adapter toe
3. **Webhook Support**: Implementeer webhook handling
4. **Documentation**: Documentatie voor payment module
5. **Testing**: Unit tests en integration tests
