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

        // Add Stripe connector (if API key provided)
        // TODO: if (options.stripeApiKey) {
        //   serviceConnectors.push(new StripeConnector(options.stripeApiKey));
        // }

        // Add Mollie connector (if API key provided)
        // TODO: if (options.mollieApiKey) {
        //   serviceConnectors.push(new MollieConnector(options.mollieApiKey));
        // }

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

            return Response.json({
              ...payment,
              amount: payment.amount.toString(), // Serialize BigInt
            });
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

// Export types and services for convenience
export type { PaymentService } from "./services/payment-service.js";
export type {
  PaymentAccount,
  Payment,
  Refund,
  PaymentProvider,
  PaymentStatus,
  PaymentAccountStatus,
  CreatePaymentAccountOptions,
  CreatePaymentOptions,
  RefundPaymentOptions,
} from "./models/payment.js";
export type { PaymentConnector, WebhookEvent } from "./connectors/base.js";
export { LedgerTokenConnector } from "./connectors/ledger-token.js";
