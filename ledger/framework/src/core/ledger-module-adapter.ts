/**
 * Ledger Module Adapter
 *
 * Converts universele OnoalModule naar ledger-specifieke OnoalLedgerModule.
 * Dit zorgt ervoor dat universele modules werken met de ledger framework.
 *
 * @module core/ledger-module-adapter
 */

import type { OnoalModule, ModuleSchema } from "@onoal/core";
import type {
  OnoalLedger,
  OnoalLedgerModule,
  LedgerHooks,
  LedgerRoute,
} from "./types.js";

/**
 * Convert universele module naar ledger-specifieke module
 *
 * Deze adapter zorgt ervoor dat universele modules werken met de ledger framework.
 * Het converteert:
 * - Routes: universele routes → ledger routes
 * - Route hooks: universele route hooks → ledger route hooks
 * - Hooks: universele hooks → ledger hooks (beforeAppend, afterAppend, etc.)
 * - Schema: universele schema → ledger schema (opgeslagen in _schema)
 *
 * @param module - Universele module
 * @returns Ledger-specifieke module
 */
export function adaptModuleToLedger(
  module: OnoalModule<OnoalLedger>
): OnoalLedgerModule {
  // Convert routes
  // Map universele routes naar ledger routes
  // Ledger routes hebben extra params (_requester_oid, _request_context)
  const ledgerRoutes: LedgerRoute[] | undefined = module.routes?.map(
    (route) => ({
      method: route.method,
      path: route.path,
      handler: async (
        req: Request,
        ledger: OnoalLedger,
        params: Record<string, string | undefined> & {
          _requester_oid?: string;
          _request_context?:
            | import("../middleware/auth.js").RequestContext
            | null;
        }
      ) => {
        // Call universele handler with optional params
        return route.handler(req, ledger, params);
      },
    })
  );

  // Convert route hooks
  const ledgerRouteHooks = module.routeHooks
    ? {
        beforeRoute: module.routeHooks.beforeRoute
          ? async (
              req: Request,
              route: import("../server/index.js").LedgerRoute,
              ledger: OnoalLedger
            ) => {
              // Create universele route wrapper
              // Ledger route has extra params, but universele route has optional params
              const universalRoute: import("@onoal/core").OnoalRoute<OnoalLedger> =
                {
                  method: route.method,
                  path: route.path,
                  handler: async (
                    req: Request,
                    context: OnoalLedger,
                    params?: Record<string, string | undefined>
                  ) => {
                    // Convert to ledger params format
                    const ledgerParams = {
                      ...(params || {}),
                    } as Record<string, string | undefined> & {
                      _requester_oid?: string;
                      _request_context?:
                        | import("../middleware/auth.js").RequestContext
                        | null;
                    };
                    return route.handler(req, context, ledgerParams);
                  },
                };
              return module.routeHooks!.beforeRoute!(
                req,
                universalRoute,
                ledger
              );
            }
          : undefined,
        afterRoute: module.routeHooks.afterRoute
          ? async (
              req: Request,
              route: import("../server/index.js").LedgerRoute,
              response: Response,
              ledger: OnoalLedger
            ) => {
              // Create universele route wrapper
              // Ledger route has extra params, but universele route has optional params
              const universalRoute: import("@onoal/core").OnoalRoute<OnoalLedger> =
                {
                  method: route.method,
                  path: route.path,
                  handler: async (
                    req: Request,
                    context: OnoalLedger,
                    params?: Record<string, string | undefined>
                  ) => {
                    // Convert to ledger params format
                    const ledgerParams = {
                      ...(params || {}),
                    } as Record<string, string | undefined> & {
                      _requester_oid?: string;
                      _request_context?:
                        | import("../middleware/auth.js").RequestContext
                        | null;
                    };
                    return route.handler(req, context, ledgerParams);
                  },
                };
              return module.routeHooks!.afterRoute!(
                req,
                universalRoute,
                response,
                ledger
              );
            }
          : undefined,
      }
    : undefined;

  // Extract ledger-specific hooks from generic hooks
  // Map universele hooks naar ledger hooks
  const ledgerHooks: LedgerHooks | undefined = module.hooks
    ? {
        beforeAppend: module.hooks.beforeAppend as
          | LedgerHooks["beforeAppend"]
          | undefined,
        afterAppend: module.hooks.afterAppend as
          | LedgerHooks["afterAppend"]
          | undefined,
        beforeQuery: module.hooks.beforeQuery as
          | LedgerHooks["beforeQuery"]
          | undefined,
        afterQuery: module.hooks.afterQuery as
          | LedgerHooks["afterQuery"]
          | undefined,
        beforeGet: module.hooks.beforeGet as
          | LedgerHooks["beforeGet"]
          | undefined,
        afterGet: module.hooks.afterGet as LedgerHooks["afterGet"] | undefined,
        beforeVerifyChain: module.hooks.beforeVerifyChain as
          | LedgerHooks["beforeVerifyChain"]
          | undefined,
        afterVerifyChain: module.hooks.afterVerifyChain as
          | LedgerHooks["afterVerifyChain"]
          | undefined,
      }
    : undefined;

  return {
    id: module.id,
    label: module.label,
    version: module.version,
    dependencies: module.dependencies,
    services: module.services,
    routes: ledgerRoutes,
    routeHooks: ledgerRouteHooks,
    load: module.lifecycle?.load,
    start: module.lifecycle?.start,
    stop: module.lifecycle?.stop,
    // Store schema and hooks in module metadata for framework processing
    // @ts-ignore - Adding custom properties for framework use
    _schema: module.schema,
    // @ts-ignore
    _hooks: ledgerHooks,
    // Drizzle schema is passed through directly (if provided)
    drizzleSchema: (module as any).drizzleSchema,
  } as OnoalLedgerModule & {
    _schema?: ModuleSchema;
    _hooks?: LedgerHooks;
  };
}
