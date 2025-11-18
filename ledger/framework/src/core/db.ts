/**
 * Database schema and types for Ledger Framework
 *
 * Database-agnostic schema that works with SQLite, PostgreSQL, and D1.
 * Uses Drizzle ORM's unified schema API.
 *
 * @module core/db
 */

import { schema } from "./schema.js";

/**
 * Database type - can be SQLite, PostgreSQL, or D1
 *
 * This is a minimal interface that works with all Drizzle database implementations.
 * The actual database instance will have more methods, but we only define
 * what we need for the ledger operations.
 */
export type LedgerDb = {
  query: {
    ledgerEntries: {
      findFirst: (options?: {
        columns?: { id?: boolean; hash?: boolean; timestamp?: boolean };
        where?: (table: any, ops: any) => any;
        orderBy?: (table: any, ops: any) => any;
      }) => Promise<{
        id: string;
        hash: string;
        timestamp: number;
        stream: string;
        payload: Record<string, unknown>;
        prevHash: string | null;
        signature: string | null;
        status: string;
        meta: Record<string, unknown> | null;
        createdAt: number;
      } | null>;
    };
    ledgerTip: {
      findFirst: (options?: {
        columns?: { hash?: boolean; timestamp?: boolean };
        where?: (table: any, ops: any) => any;
      }) => Promise<{
        hash: string;
        timestamp: number;
      } | null>;
    };
    ledgerCheckpoints: {
      findFirst: (options?: {
        columns?: {
          id?: boolean;
          timestamp?: boolean;
          rootHash?: boolean;
          signature?: boolean;
          entriesCount?: boolean;
        };
        orderBy?: (table: any, ops: any) => any;
      }) => Promise<{
        id: string;
        timestamp: number;
        rootHash: string;
        signature: string;
        entriesCount: number;
      } | null>;
    };
    ledgerStats?: {
      findMany?: () => Promise<
        Array<{
          stream: string;
          totalEntries: number;
          lastEntryTimestamp: number | null;
          lastEntryHash: string | null;
          updatedAt: number;
        }>
      >;
    };
  };
  // Drizzle query builder - using any for flexibility across different databases
  // The actual Drizzle types are complex and database-specific, so we use any here
  // and rely on runtime behavior and the query API for type safety
  select: any;
  insert: any;
  delete: any;
  // Transaction support (optional - not all databases support transactions)
  transaction?: <T>(callback: (tx: LedgerDb) => Promise<T>) => Promise<T>;
};

// Re-export schema for convenience
export { schema } from "./schema.js";
