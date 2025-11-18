/**
 * Service Access Helpers
 *
 * Utility functions for accessing services from ledger instance.
 * Provides a proxy-based API for type-safe service access.
 *
 * @module routes/services
 */

import type { OnoalLedger } from "../core/types.js";

/**
 * Service proxy type
 *
 * Dynamically provides access to all registered services as properties.
 * Type-safe access via property names.
 */
export type ServiceProxy = {
  [key: string]: any;
};

/**
 * Get services proxy from ledger
 *
 * Returns a proxy object that allows property-based access to services.
 * Similar to React hooks pattern but with property access syntax.
 *
 * @param ledger - Ledger instance
 * @returns Proxy object with service properties
 *
 * @example
 * ```typescript
 * const services = useService(ledger);
 * const tokenService = services.tokenService; // Type-safe access
 * ```
 */
export function useService(ledger: OnoalLedger): ServiceProxy {
  return new Proxy({} as ServiceProxy, {
    get(_target, prop: string) {
      if (typeof prop !== "string") {
        return undefined;
      }

      // Check if service exists
      if (!ledger.hasService(prop)) {
        const availableServices = ledger.getServiceNames();
        throw new Error(
          `Service "${prop}" not found. Available services: ${availableServices.length > 0 ? availableServices.join(", ") : "none"}`
        );
      }

      // Return service
      return ledger.getService(prop);
    },
    has(_target, prop: string) {
      if (typeof prop !== "string") {
        return false;
      }
      return ledger.hasService(prop);
    },
    ownKeys(_target) {
      // Return all service names for Object.keys() support
      return ledger.getServiceNames();
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      if (typeof prop !== "string") {
        return undefined;
      }
      if (ledger.hasService(prop)) {
        return {
          enumerable: true,
          configurable: true,
        };
      }
      return undefined;
    },
  });
}

/**
 * Check if service exists
 *
 * @param ledger - Ledger instance
 * @param serviceName - Name of the service to check
 * @returns True if service exists, false otherwise
 *
 * @example
 * ```typescript
 * if (hasService(ledger, "tokenService")) {
 *   const services = useService(ledger);
 *   const tokenService = services.tokenService;
 * }
 * ```
 */
export function hasService(ledger: OnoalLedger, serviceName: string): boolean {
  return ledger.hasService(serviceName);
}
