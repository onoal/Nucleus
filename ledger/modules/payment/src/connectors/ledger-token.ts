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
  type = "payment" as const;

  constructor(private ledger: OnoalLedger) {}

  /**
   * Get Token Service
   */
  private getTokenService() {
    const tokenService = this.ledger.getService<{
      getBalance(
        tokenId: string,
        subjectOid: string,
        requesterOid?: string
      ): Promise<{
        token_id: string;
        subject_oid: string;
        balance: bigint;
        balance_formatted: string;
        nonce: bigint;
        updated_at: number;
      } | null>;
      transferToken(options: {
        tokenId: string;
        from: string;
        to: string;
        amount: bigint;
        nonce: bigint;
        txId: string;
        actorOid: string;
        ctx?: Record<string, unknown>;
      }): Promise<{
        tx_id: string;
        ledger_id: number;
        token_id: string;
        kind: "transfer";
        from: string;
        to: string;
        amount: bigint;
        from_balance: bigint;
        to_balance: bigint;
        from_nonce: bigint;
        to_nonce: bigint;
        timestamp: number;
      }>;
    }>("tokenService");
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

    // Get current balance (includes nonce)
    const payerBalance = await tokenService.getBalance(
      options.token_id,
      options.account_oid,
      options.account_oid
    );

    if (!payerBalance) {
      throw new Error(
        `Token account not found for ${options.account_oid} with token ${options.token_id}`
      );
    }

    // Check balance
    if (payerBalance.balance < options.amount) {
      throw new Error("Insufficient balance");
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
   *
   * Note: This would require querying the token ledger by tx_id.
   * For now, we return null as this is not critical for MVP.
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
   * Note: This requires storing payee_oid in payment metadata.
   * For now, this is not implemented.
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
