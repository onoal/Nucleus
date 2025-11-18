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

