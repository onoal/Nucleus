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
      amount: this.serializeBigInt(options.amount, adapter.provider) as any,
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
