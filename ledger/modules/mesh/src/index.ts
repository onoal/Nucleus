/**
 * Onoal Network Mesh Protocol Module
 *
 * Provides cross-ledger connectivity, queries, and synchronization.
 *
 * @module @onoal/ledger-module-mesh
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import { createCustomModule } from "@onoal/ledger-core";
import { MeshNetworkService } from "./services/mesh-network-service.js";
import { MeshQueryService } from "./services/mesh-query-service.js";
import { MeshSyncService } from "./services/mesh-sync-service.js";
import { meshDrizzleSchema } from "./schema/index.js";
import type { MeshProtocolModuleOptions } from "./types.js";

// Route handlers
import { getPeersHandler, connectPeerHandler } from "./routes/peers.js";
import { queryHandler } from "./routes/query.js";
import { syncHandler } from "./routes/sync.js";

/**
 * Mesh Protocol Module
 *
 * Enables cross-ledger connectivity and operations.
 *
 * @example
 * ```typescript
 * import { meshProtocolModule } from "@onoal/ledger-module-mesh";
 * import { createLedger } from "@onoal/ledger-core";
 *
 * const ledger = await createLedger({
 *   name: "my-ledger",
 *   modules: [
 *     meshProtocolModule({
 *       ledgerId: "my-ledger-id",
 *       ledgerOid: "oid:onoal:org:myorg",
 *       publicKey: "a1b2c3...",
 *       endpoint: "https://ledger.example.com",
 *       bootstrapNodes: [
 *         { ledgerId: "hub-1", endpoint: "https://hub1.onoal.network" }
 *       ],
 *     }),
 *   ],
 *   // ...
 * });
 *
 * // Use mesh services
 * const meshNetwork = ledger.getService<MeshNetworkService>("meshNetworkService");
 * await meshNetwork.join();
 *
 * const meshQuery = ledger.getService<MeshQueryService>("meshQueryService");
 * const entries = await meshQuery.queryRemote("other-ledger-id", {
 *   subjectOid: "oid:...",
 * }, "oid:requester");
 * ```
 */
export function meshProtocolModule(
  options: MeshProtocolModuleOptions
): ReturnType<typeof createCustomModule> {
  return createCustomModule({
    id: "mesh-protocol",
    label: "Onoal Network Mesh Protocol",
    version: "1.0.0",

    // Services
    services: {
      meshNetworkService: (ledger: OnoalLedger) =>
        new MeshNetworkService(ledger, options),
      meshQueryService: MeshQueryService,
      meshSyncService: MeshSyncService,
    },

    // Routes
    routes: [
      {
        method: "GET",
        path: "/mesh/peers",
        handler: getPeersHandler,
      },
      {
        method: "POST",
        path: "/mesh/connect",
        handler: connectPeerHandler,
      },
      {
        method: "POST",
        path: "/mesh/query",
        handler: queryHandler,
      },
      {
        method: "POST",
        path: "/mesh/sync",
        handler: syncHandler,
      },
    ],

    // Database schema
    drizzleSchema: meshDrizzleSchema,

    // Lifecycle
    lifecycle: {
      start: async (ledger: OnoalLedger) => {
        const meshNetwork =
          ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.join();
      },
      stop: async (ledger: OnoalLedger) => {
        const meshNetwork =
          ledger.getService<MeshNetworkService>("meshNetworkService");
        await meshNetwork.leave();
      },
    },
  });
}

// Re-export services and types for convenience
export { MeshNetworkService } from "./services/mesh-network-service.js";
export { MeshQueryService } from "./services/mesh-query-service.js";
export { MeshSyncService } from "./services/mesh-sync-service.js";
export type * from "./types.js";
