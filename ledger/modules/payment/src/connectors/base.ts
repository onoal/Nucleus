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
 * **Framework Integration**: PaymentConnector extends LedgerConnector,
 * which provides automatic registration, lifecycle hooks, and declarative schema support.
 *
 * @module connectors/base
 */

// LedgerConnector is defined in @onoal/ledger-core types
// We'll import it directly from the types file path
import type { LedgerConnector } from "@onoal/ledger-core";
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
export interface PaymentConnector extends LedgerConnector {
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
