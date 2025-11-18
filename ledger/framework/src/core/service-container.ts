/**
 * Service Container for Ledger Framework
 *
 * Medusa.js pattern for dependency injection
 *
 * Allows modules to register services that can be resolved by other services.
 * This enables loose coupling and testability.
 *
 * @example
 * ```typescript
 * const container = new ServiceContainer();
 * container.register("proofService", new ProofService(ledger));
 * const proofService = container.resolve<ProofService>("proofService");
 * ```
 */

import { ServiceError, ErrorCodes } from "@onoal/core";
export class ServiceContainer {
  private services = new Map<string, any>();
  private serviceMetadata = new Map<
    string,
    {
      registeredAt: number;
      moduleId?: string;
      factory?: any; // Store factory for type inference
    }
  >();

  /**
   * Register a service
   *
   * @param name - Service name (must be unique)
   * @param service - Service instance
   * @param moduleId - Optional module ID that registered this service
   * @param factory - Optional factory function/class for type inference
   * @throws Error if service already registered
   */
  register<T>(
    name: string,
    service: T,
    moduleId?: string,
    factory?: any
  ): void {
    if (this.services.has(name)) {
      const metadata = this.serviceMetadata.get(name);
      throw new ServiceError(
        `Service already registered: ${name}` +
          (metadata?.moduleId
            ? ` (registered by module: ${metadata.moduleId})`
            : ""),
        ErrorCodes.SERVICE_ALREADY_REGISTERED,
        this.getServiceNames(),
        `Service '${name}' is already registered${metadata?.moduleId ? ` by module '${metadata.moduleId}'` : ""}. ` +
          `Available services: ${this.getServiceNames().join(", ")}`
      );
    }

    if (!service) {
      throw new ServiceError(
        `Cannot register null or undefined service: ${name}`,
        ErrorCodes.SERVICE_INSTANTIATION_FAILED,
        this.getServiceNames(),
        `Service '${name}' must be a valid object, class, or factory function`
      );
    }

    this.services.set(name, service);
    this.serviceMetadata.set(name, {
      registeredAt: Date.now(),
      moduleId,
      factory, // Store factory for type inference
    });
  }

  /**
   * Resolve a service
   *
   * @param name - Service name to resolve
   * @returns Service instance
   * @throws Error if service not found
   *
   * @example
   * ```typescript
   * const proofService = container.resolve<ProofService>("proofService");
   * ```
   */
  resolve<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      const availableServices = this.getServiceNames();
      throw new ServiceError(
        `Service not found: ${name}`,
        ErrorCodes.SERVICE_NOT_FOUND,
        availableServices,
        `Did you register the service in your module? Available services: ${availableServices.length > 0 ? availableServices.join(", ") : "none"}`
      );
    }

    // Record service resolution metrics if metrics collector is available
    const metrics = this.services.get("metrics");
    if (
      metrics &&
      metrics &&
      typeof (metrics as any).recordServiceResolution === "function"
    ) {
      // Service is already instantiated, so this is a cache hit
      (metrics as any).recordServiceResolution(true);
    }

    return service as T;
  }

  /**
   * Check if a service exists
   *
   * @param name - Service name to check
   * @returns true if service exists
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   *
   * @returns Array of service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service metadata
   *
   * @param name - Service name
   * @returns Service metadata or undefined
   */
  getMetadata(
    name: string
  ): { registeredAt: number; moduleId?: string } | undefined {
    return this.serviceMetadata.get(name);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.serviceMetadata.clear();
  }

  /**
   * Get count of registered services
   */
  get size(): number {
    return this.services.size;
  }
}
