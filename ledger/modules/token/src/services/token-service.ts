/**
 * Token Service for Ledger Framework
 *
 * Provides token creation, minting, burning, transfer, and querying functionality.
 * Based on: onoal/ledger/src/db/schema.ts (token primitives)
 *
 * @module services/token-service
 */

import type { OnoalLedger } from "@onoal/ledger-core";
import type { LedgerDatabase, UnifiedAccessLayer } from "@onoal/ledger-core";
import type {
  Token,
  TokenAccount,
  CreateTokenOptions,
  MintTokenOptions,
  TransferTokenOptions,
  BurnTokenOptions,
} from "../models/token.js";
import { tokenSchema } from "../schema/tokens.js";
import { tokenSchemaSqlite } from "../schema/tokens-sqlite.js";
import { eq, and } from "drizzle-orm";

/**
 * Token Service
 *
 * Service-based architecture (Medusa.js pattern) for token management.
 * Handles token creation, minting, burning, transfer, and querying.
 *
 * Note: This service uses direct database access via adapter.db.
 * Unlike Asset/Connect services, tokens don't use ledger.append() because
 * they use double-entry accounting with balances.
 */
export class TokenService {
  constructor(private ledger: OnoalLedger) {}

  /**
   * Get database adapter
   */
  private getAdapter(): LedgerDatabase {
    // Try to get adapter from service container first
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
   * Get token schema based on provider
   */
  private getTokenSchema() {
    const adapter = this.getAdapter();

    if (adapter.provider === "postgres") {
      return tokenSchema;
    } else if (adapter.provider === "sqlite" || adapter.provider === "d1") {
      return tokenSchemaSqlite;
    } else {
      throw new Error(`Unsupported database provider: ${adapter.provider}`);
    }
  }

  /**
   * Helper: Get schema tables
   */
  private getTables() {
    const schema = this.getTokenSchema();
    return {
      tokens: schema.tokens,
      tokenAccounts: schema.tokenAccounts,
      tokenLedger: schema.tokenLedger,
    };
  }

  /**
   * Helper: Serialize BigInt to string for database (SQLite/D1)
   */
  private serializeBigInt(value: bigint, provider: string): string | bigint {
    if (provider === "postgres") {
      return value;
    }
    return value.toString();
  }

  /**
   * Helper: Deserialize string to BigInt from database
   */
  private deserializeBigInt(value: string | number | bigint): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    return BigInt(value);
  }

  /**
   * Helper: Format balance with decimals
   */
  formatBalance(balance: bigint, decimals: number): string {
    const divisor = BigInt(10 ** decimals);
    const whole = balance / divisor;
    const fraction = balance % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0");
    return `${whole}.${fractionStr}`;
  }

  /**
   * Create new token
   *
   * Creates a new token definition in the tokens table.
   * Idempotency: If token with same issuer_oid and symbol exists, return existing.
   * ACL: Auto-grants admin access to issuer_oid.
   *
   * @param options - Token creation options
   * @returns Token creation result
   */
  async createToken(options: CreateTokenOptions): Promise<{
    token_id: string;
    issuer_oid: string;
    symbol?: string | null;
    name?: string | null;
    decimals: number;
    supply: bigint;
    status: "active" | "paused";
    created_at: number;
  }> {
    const db = this.getDb();
    const tables = this.getTables();
    const adapter = this.getAdapter();

    // 1. Validate decimals
    if (options.decimals < 0 || options.decimals > 18) {
      throw new Error("Decimals must be between 0 and 18");
    }

    // 2. Check idempotency (if symbol provided)
    if (options.symbol) {
      const existing = await db.query.tokens.findFirst({
        where: and(
          eq(tables.tokens.issuerOid, options.issuer_oid),
          eq(tables.tokens.symbol, options.symbol)
        ),
      });

      if (existing) {
        // Return existing token
        return {
          token_id: existing.id,
          issuer_oid: existing.issuerOid,
          symbol: existing.symbol ?? undefined,
          name: existing.name ?? undefined,
          decimals: existing.decimals,
          supply: this.deserializeBigInt(existing.supply as any),
          status: existing.status as "active" | "paused",
          created_at: existing.createdAt,
        };
      }
    }

    // 3. Generate token ID
    const tokenId = `tok_${crypto.randomUUID()}`;
    const now = Date.now();

    // 4. Insert token
    const tokenData: any = {
      id: tokenId,
      issuerOid: options.issuer_oid,
      decimals: options.decimals,
      supply: this.serializeBigInt(BigInt(0), adapter.provider),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    if (options.symbol) tokenData.symbol = options.symbol;
    if (options.name) tokenData.name = options.name;
    if (options.supply_cap !== undefined) {
      tokenData.supplyCap = this.serializeBigInt(
        options.supply_cap || BigInt(0),
        adapter.provider
      );
    }
    if (options.metadata) {
      tokenData.metadata =
        adapter.provider === "postgres"
          ? options.metadata
          : JSON.stringify(options.metadata);
    }
    if (options.admin_policy) {
      tokenData.adminPolicy =
        adapter.provider === "postgres"
          ? options.admin_policy
          : JSON.stringify(options.admin_policy);
    }

    await db.insert(tables.tokens).values(tokenData);

    // 5. Auto-grant ACL via UAL
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;
    if (ual) {
      await ual.grant([
        {
          resourceKind: "token",
          resourceId: tokenId,
          principalOid: options.issuer_oid,
          scope: "full",
          grantedBy: options.issuer_oid,
        },
      ]);
    }

    // 6. Return result
    return {
      token_id: tokenId,
      issuer_oid: options.issuer_oid,
      symbol: options.symbol,
      name: options.name,
      decimals: options.decimals,
      supply: BigInt(0),
      status: "active",
      created_at: now,
    };
  }

  /**
   * Get token by ID with ACL check
   *
   * @param tokenId - Token ID
   * @param requesterOid - Optional requester OID for ACL check
   * @returns Token or null if not found or access denied
   */
  async getToken(
    tokenId: string,
    requesterOid?: string
  ): Promise<Token | null> {
    const db = this.getDb();
    const tables = this.getTables();

    // ACL check if UAL available and requester_oid provided
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;
    if (ual && requesterOid) {
      try {
        // Use UAL.require() for ACL check
        await ual.require(requesterOid, "read", {
          kind: "token",
          id: tokenId,
        });
      } catch (error) {
        // ACL check failed - return null (non-disclosure)
        return null;
      }
    }

    // Get token from database
    const token = await db.query.tokens.findFirst({
      where: eq(tables.tokens.id, tokenId),
    });

    if (!token) {
      return null;
    }

    // Deserialize and return
    return {
      id: token.id,
      issuerOid: token.issuerOid,
      symbol: token.symbol ?? undefined,
      name: token.name ?? undefined,
      decimals: token.decimals,
      supplyCap: token.supplyCap
        ? this.deserializeBigInt(token.supplyCap as any)
        : null,
      supply: this.deserializeBigInt(token.supply as any),
      status: token.status as "active" | "paused",
      metadata: token.metadata
        ? typeof token.metadata === "string"
          ? JSON.parse(token.metadata)
          : token.metadata
        : undefined,
      adminPolicy: token.adminPolicy
        ? typeof token.adminPolicy === "string"
          ? JSON.parse(token.adminPolicy)
          : token.adminPolicy
        : undefined,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }

  /**
   * Get or create token account
   *
   * Helper method to get account, creating it if it doesn't exist.
   *
   * @param tokenId - Token ID
   * @param subjectOid - Subject OID
   * @returns Token account
   */
  private async getAccount(
    tokenId: string,
    subjectOid: string
  ): Promise<TokenAccount> {
    const db = this.getDb();
    const tables = this.getTables();
    const adapter = this.getAdapter();

    // Try to get existing account
    const account = await db.query.tokenAccounts.findFirst({
      where: and(
        eq(tables.tokenAccounts.tokenId, tokenId),
        eq(tables.tokenAccounts.subjectOid, subjectOid)
      ),
    });

    if (account) {
      // Deserialize and return
      return {
        id: account.id,
        tokenId: account.tokenId,
        subjectOid: account.subjectOid,
        balance: this.deserializeBigInt(account.balance as any),
        nonce: this.deserializeBigInt(account.nonce as any),
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    }

    // Account doesn't exist - create it
    const now = Date.now();

    const accountData: any = {
      tokenId,
      subjectOid,
      balance: this.serializeBigInt(BigInt(0), adapter.provider),
      nonce: this.serializeBigInt(BigInt(0), adapter.provider),
      createdAt: now,
      updatedAt: now,
    };

    const [inserted] = await db
      .insert(tables.tokenAccounts)
      .values(accountData)
      .returning();

    return {
      id: inserted.id,
      tokenId: inserted.tokenId,
      subjectOid: inserted.subjectOid,
      balance: BigInt(0),
      nonce: BigInt(0),
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  }

  /**
   * Execute operation in database transaction
   *
   * Wraps operations in a transaction for atomicity.
   * Provider-specific transaction handling.
   */
  private async withTransaction<T>(
    callback: (tx: any) => Promise<T>
  ): Promise<T> {
    const db = this.getDb();

    // Drizzle supports transactions for both PostgreSQL and SQLite/D1
    // Transaction type is adapter-specific, so we use any
    return await db.transaction(async (tx: any) => {
      return await callback(tx);
    });
  }

  /**
   * Mint tokens (create new supply)
   *
   * Creates new tokens and adds them to recipient's account.
   * Updates token supply and creates ledger entry.
   *
   * @param options - Mint options
   * @returns Mint result
   */
  async mintToken(options: MintTokenOptions): Promise<{
    tx_id: string;
    ledger_id: number;
    token_id: string;
    kind: "mint";
    to: string;
    amount: bigint;
    new_balance: bigint;
    new_supply: bigint;
    timestamp: number;
  }> {
    return await this.withTransaction(async (tx) => {
      const tables = this.getTables();
      const adapter = this.getAdapter();

      // 1. Get token (check status === 'active')
      const token = await this.getToken(options.tokenId);
      if (!token) {
        throw new Error("Token not found");
      }
      if (token.status !== "active") {
        throw new Error("Token is not active");
      }

      // 2. Check supply cap
      if (token.supplyCap !== null) {
        const newSupply = token.supply + options.amount;
        if (newSupply > token.supplyCap) {
          throw new Error("Supply cap exceeded");
        }
      }

      // 3. Check idempotency (tx_id)
      const existingTx = await tx.query.tokenLedger.findFirst({
        where: and(
          eq(tables.tokenLedger.tokenId, options.tokenId),
          eq(tables.tokenLedger.txId, options.txId)
        ),
      });

      if (existingTx) {
        // Return existing transaction
        const account = await this.getAccount(options.tokenId, options.to);
        return {
          tx_id: existingTx.txId,
          ledger_id: existingTx.id,
          token_id: options.tokenId,
          kind: existingTx.kind as "mint",
          to: options.to,
          amount: this.deserializeBigInt(existingTx.amount as any),
          new_balance: account.balance,
          new_supply:
            token.supply + this.deserializeBigInt(existingTx.amount as any),
          timestamp:
            existingTx.ts instanceof Date
              ? existingTx.ts.getTime()
              : existingTx.ts,
        };
      }

      // 4. Get or create account
      const account = await this.getAccount(options.tokenId, options.to);

      // 5. Update account balance and nonce
      const newBalance = account.balance + options.amount;
      const newNonce = account.nonce + BigInt(1);
      const now = Date.now();

      await tx
        .update(tables.tokenAccounts)
        .set({
          balance: this.serializeBigInt(newBalance, adapter.provider),
          nonce: this.serializeBigInt(newNonce, adapter.provider),
          updatedAt: now,
        })
        .where(
          and(
            eq(tables.tokenAccounts.tokenId, options.tokenId),
            eq(tables.tokenAccounts.subjectOid, options.to),
            eq(
              tables.tokenAccounts.nonce,
              this.serializeBigInt(account.nonce, adapter.provider)
            ) // Optimistic lock
          )
        );

      // 6. Update token supply
      const newSupply = token.supply + options.amount;
      await tx
        .update(tables.tokens)
        .set({
          supply: this.serializeBigInt(newSupply, adapter.provider),
          updatedAt: now,
        })
        .where(eq(tables.tokens.id, options.tokenId));

      // 7. Insert ledger entry
      const ledgerData: any = {
        tokenId: options.tokenId,
        txId: options.txId,
        kind: "mint",
        fromSubjectOid: null,
        toSubjectOid: options.to,
        amount: this.serializeBigInt(options.amount, adapter.provider),
        actorOid: options.actorOid,
        createdAt: now,
      };

      if (options.ctx) {
        ledgerData.ctx =
          adapter.provider === "postgres"
            ? options.ctx
            : JSON.stringify(options.ctx);
      }

      const [ledgerEntry] = await tx
        .insert(tables.tokenLedger)
        .values(ledgerData)
        .returning();

      return {
        tx_id: options.txId,
        ledger_id: ledgerEntry.id,
        token_id: options.tokenId,
        kind: "mint",
        to: options.to,
        amount: options.amount,
        new_balance: newBalance,
        new_supply: newSupply,
        timestamp: now,
      };
    });
  }

  /**
   * Transfer tokens (move between accounts)
   *
   * Transfers tokens from one account to another.
   * Requires nonce match for anti-replay protection.
   *
   * @param options - Transfer options
   * @returns Transfer result
   */
  async transferToken(options: TransferTokenOptions): Promise<{
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
  }> {
    return await this.withTransaction(async (tx) => {
      const tables = this.getTables();
      const adapter = this.getAdapter();

      // 1. Get token (check status === 'active')
      const token = await this.getToken(options.tokenId);
      if (!token) {
        throw new Error("Token not found");
      }
      if (token.status !== "active") {
        throw new Error("Token is not active");
      }

      // 2. Check idempotency
      const existingTx = await tx.query.tokenLedger.findFirst({
        where: and(
          eq(tables.tokenLedger.tokenId, options.tokenId),
          eq(tables.tokenLedger.txId, options.txId)
        ),
      });

      if (existingTx) {
        // Return existing transaction
        const fromAccount = await this.getAccount(
          options.tokenId,
          options.from
        );
        const toAccount = await this.getAccount(options.tokenId, options.to);
        return {
          tx_id: existingTx.txId,
          ledger_id: existingTx.id,
          token_id: options.tokenId,
          kind: "transfer",
          from: options.from,
          to: options.to,
          amount: this.deserializeBigInt(existingTx.amount as any),
          from_balance: fromAccount.balance,
          to_balance: toAccount.balance,
          from_nonce: fromAccount.nonce,
          to_nonce: toAccount.nonce,
          timestamp:
            existingTx.ts instanceof Date
              ? existingTx.ts.getTime()
              : existingTx.ts,
        };
      }

      // 3. Get from_account (check balance >= amount)
      const fromAccount = await this.getAccount(options.tokenId, options.from);
      if (fromAccount.balance < options.amount) {
        throw new Error("Insufficient balance");
      }

      // 4. Check nonce (anti-replay)
      if (fromAccount.nonce !== options.nonce) {
        throw new Error("Nonce mismatch");
      }

      // 5. Get or create to_account
      const toAccount = await this.getAccount(options.tokenId, options.to);

      // 6. Update from_account
      const fromNewBalance = fromAccount.balance - options.amount;
      const fromNewNonce = fromAccount.nonce + BigInt(1);
      const now = Date.now();

      await tx
        .update(tables.tokenAccounts)
        .set({
          balance: this.serializeBigInt(fromNewBalance, adapter.provider),
          nonce: this.serializeBigInt(fromNewNonce, adapter.provider),
          updatedAt: now,
        })
        .where(
          and(
            eq(tables.tokenAccounts.tokenId, options.tokenId),
            eq(tables.tokenAccounts.subjectOid, options.from),
            eq(
              tables.tokenAccounts.nonce,
              this.serializeBigInt(options.nonce, adapter.provider)
            ) // Optimistic lock
          )
        );

      // 7. Update to_account
      const toNewBalance = toAccount.balance + options.amount;
      const toNewNonce = toAccount.nonce + BigInt(1);

      await tx
        .update(tables.tokenAccounts)
        .set({
          balance: this.serializeBigInt(toNewBalance, adapter.provider),
          nonce: this.serializeBigInt(toNewNonce, adapter.provider),
          updatedAt: now,
        })
        .where(
          and(
            eq(tables.tokenAccounts.tokenId, options.tokenId),
            eq(tables.tokenAccounts.subjectOid, options.to)
          )
        );

      // 8. Insert ledger entry
      const ledgerData: any = {
        tokenId: options.tokenId,
        txId: options.txId,
        kind: "transfer",
        fromSubjectOid: options.from,
        toSubjectOid: options.to,
        amount: this.serializeBigInt(options.amount, adapter.provider),
        actorOid: options.actorOid,
        createdAt: now,
      };

      if (options.ctx) {
        ledgerData.ctx =
          adapter.provider === "postgres"
            ? options.ctx
            : JSON.stringify(options.ctx);
      }

      const [ledgerEntry] = await tx
        .insert(tables.tokenLedger)
        .values(ledgerData)
        .returning();

      return {
        tx_id: options.txId,
        ledger_id: ledgerEntry.id,
        token_id: options.tokenId,
        kind: "transfer",
        from: options.from,
        to: options.to,
        amount: options.amount,
        from_balance: fromNewBalance,
        to_balance: toNewBalance,
        from_nonce: fromNewNonce,
        to_nonce: toNewNonce,
        timestamp: now,
      };
    });
  }

  /**
   * Burn tokens (destroy supply)
   *
   * Removes tokens from account and reduces total supply.
   *
   * @param options - Burn options
   * @returns Burn result
   */
  async burnToken(options: BurnTokenOptions): Promise<{
    tx_id: string;
    ledger_id: number;
    token_id: string;
    kind: "burn";
    from: string;
    amount: bigint;
    new_balance: bigint;
    new_supply: bigint;
    timestamp: number;
  }> {
    return await this.withTransaction(async (tx) => {
      const tables = this.getTables();
      const adapter = this.getAdapter();

      // 1. Get token (check status === 'active')
      const token = await this.getToken(options.tokenId);
      if (!token) {
        throw new Error("Token not found");
      }
      if (token.status !== "active") {
        throw new Error("Token is not active");
      }

      // 2. Check idempotency
      const existingTx = await tx.query.tokenLedger.findFirst({
        where: and(
          eq(tables.tokenLedger.tokenId, options.tokenId),
          eq(tables.tokenLedger.txId, options.txId)
        ),
      });

      if (existingTx) {
        // Return existing transaction
        const account = await this.getAccount(options.tokenId, options.from);
        return {
          tx_id: existingTx.txId,
          ledger_id: existingTx.id,
          token_id: options.tokenId,
          kind: "burn",
          from: options.from,
          amount: this.deserializeBigInt(existingTx.amount as any),
          new_balance: account.balance,
          new_supply:
            token.supply - this.deserializeBigInt(existingTx.amount as any),
          timestamp:
            existingTx.ts instanceof Date
              ? existingTx.ts.getTime()
              : existingTx.ts,
        };
      }

      // 3. Get from_account (check balance >= amount)
      const fromAccount = await this.getAccount(options.tokenId, options.from);
      if (fromAccount.balance < options.amount) {
        throw new Error("Insufficient balance");
      }

      // 4. Check nonce (anti-replay)
      if (fromAccount.nonce !== options.nonce) {
        throw new Error("Nonce mismatch");
      }

      // 5. Update from_account
      const fromNewBalance = fromAccount.balance - options.amount;
      const fromNewNonce = fromAccount.nonce + BigInt(1);
      const now = Date.now();

      await tx
        .update(tables.tokenAccounts)
        .set({
          balance: this.serializeBigInt(fromNewBalance, adapter.provider),
          nonce: this.serializeBigInt(fromNewNonce, adapter.provider),
          updatedAt: now,
        })
        .where(
          and(
            eq(tables.tokenAccounts.tokenId, options.tokenId),
            eq(tables.tokenAccounts.subjectOid, options.from),
            eq(
              tables.tokenAccounts.nonce,
              this.serializeBigInt(options.nonce, adapter.provider)
            ) // Optimistic lock
          )
        );

      // 6. Update token supply
      const newSupply = token.supply - options.amount;
      await tx
        .update(tables.tokens)
        .set({
          supply: this.serializeBigInt(newSupply, adapter.provider),
          updatedAt: now,
        })
        .where(eq(tables.tokens.id, options.tokenId));

      // 7. Insert ledger entry
      const ledgerData: any = {
        tokenId: options.tokenId,
        txId: options.txId,
        kind: "burn",
        fromSubjectOid: options.from,
        toSubjectOid: null,
        amount: this.serializeBigInt(options.amount, adapter.provider),
        actorOid: options.actorOid,
        createdAt: now,
      };

      if (options.ctx) {
        ledgerData.ctx =
          adapter.provider === "postgres"
            ? options.ctx
            : JSON.stringify(options.ctx);
      }

      const [ledgerEntry] = await tx
        .insert(tables.tokenLedger)
        .values(ledgerData)
        .returning();

      return {
        tx_id: options.txId,
        ledger_id: ledgerEntry.id,
        token_id: options.tokenId,
        kind: "burn",
        from: options.from,
        amount: options.amount,
        new_balance: fromNewBalance,
        new_supply: newSupply,
        timestamp: now,
      };
    });
  }

  /**
   * Get token balance
   *
   * @param tokenId - Token ID
   * @param subjectOid - Subject OID
   * @param requesterOid - Optional requester OID for ACL check
   * @returns Balance result or null
   */
  async getBalance(
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
  } | null> {
    const db = this.getDb();
    const tables = this.getTables();

    // ACL check
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;
    if (ual && requesterOid) {
      const hasAccess = await ual.check(requesterOid, "read", {
        kind: "token",
        id: tokenId,
      });

      if (!hasAccess && requesterOid !== subjectOid) {
        return null; // Non-disclosure
      }
    }

    // Get account
    const account = await this.getAccount(tokenId, subjectOid);
    const token = await this.getToken(tokenId);
    if (!token) {
      return null;
    }

    return {
      token_id: tokenId,
      subject_oid: subjectOid,
      balance: account.balance,
      balance_formatted: this.formatBalance(account.balance, token.decimals),
      nonce: account.nonce,
      updated_at: account.updatedAt,
    };
  }

  /**
   * List tokens with filters
   *
   * @param filters - Query filters
   * @param requesterOid - Optional requester OID for ACL checks
   * @returns List of tokens with pagination
   */
  async listTokens(
    filters: {
      issuer_oid?: string;
      status?: "active" | "paused";
      limit?: number;
      cursor?: number;
    },
    requesterOid?: string
  ): Promise<{
    tokens: Token[];
    next_cursor: number | null;
    has_more: boolean;
  }> {
    const db = this.getDb();
    const tables = this.getTables();
    const adapter = this.getAdapter();

    // Use UAL for ACL-aware querying if available
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;
    if (ual && requesterOid) {
      const result = await ual.list(requesterOid, {
        kind: "token",
        issuerOid: filters.issuer_oid,
        status: filters.status,
        limit: filters.limit ?? 20,
        cursor: filters.cursor,
      });

      return {
        tokens: result.items as Token[],
        next_cursor: result.nextCursor ?? null,
        has_more: result.hasMore,
      };
    }

    // Fallback to direct database query
    const limit = filters.limit ?? 20;
    const offset = filters.cursor ?? 0;

    // Build where conditions
    const conditions: any[] = [];
    if (filters.issuer_oid) {
      conditions.push(eq(tables.tokens.issuerOid, filters.issuer_oid));
    }
    if (filters.status) {
      conditions.push(eq(tables.tokens.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query tokens
    const tokens = await db.query.tokens.findMany({
      where: whereClause,
      limit: limit + 1, // Get one extra to check has_more
      offset,
      orderBy: (tokens: any, { desc }: any) => [desc(tokens.createdAt)],
    });

    const hasMore = tokens.length > limit;
    const resultTokens = hasMore ? tokens.slice(0, limit) : tokens;

    // Deserialize tokens
    const deserializedTokens: Token[] = resultTokens.map((token: any) => ({
      id: token.id,
      issuerOid: token.issuerOid,
      symbol: token.symbol ?? undefined,
      name: token.name ?? undefined,
      decimals: token.decimals,
      supplyCap: token.supplyCap
        ? this.deserializeBigInt(token.supplyCap as any)
        : null,
      supply: this.deserializeBigInt(token.supply as any),
      status: token.status as "active" | "paused",
      metadata: token.metadata
        ? typeof token.metadata === "string"
          ? JSON.parse(token.metadata)
          : token.metadata
        : undefined,
      adminPolicy: token.adminPolicy
        ? typeof token.adminPolicy === "string"
          ? JSON.parse(token.adminPolicy)
          : token.adminPolicy
        : undefined,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    }));

    return {
      tokens: deserializedTokens,
      next_cursor: hasMore ? offset + limit : null,
      has_more: hasMore,
    };
  }

  /**
   * Get token holders (accounts with balance > 0)
   *
   * @param tokenId - Token ID
   * @param requesterOid - Optional requester OID for ACL checks
   * @param limit - Optional limit (default: 100)
   * @param cursor - Optional cursor for pagination
   * @returns List of holders with balances
   */
  async getHolders(
    tokenId: string,
    requesterOid?: string,
    limit: number = 100,
    cursor?: number
  ): Promise<{
    holders: Array<{
      subject_oid: string;
      balance: bigint;
      balance_formatted: string;
      nonce: bigint;
      updated_at: number;
    }>;
    next_cursor: number | null;
    has_more: boolean;
  }> {
    const db = this.getDb();
    const tables = this.getTables();

    // ACL check
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;
    if (ual && requesterOid) {
      const hasAccess = await ual.check(requesterOid, "read", {
        kind: "token",
        id: tokenId,
      });

      if (!hasAccess) {
        return {
          holders: [],
          next_cursor: null,
          has_more: false,
        };
      }
    }

    // Get token for decimals
    const token = await this.getToken(tokenId);
    if (!token) {
      return {
        holders: [],
        next_cursor: null,
        has_more: false,
      };
    }

    // Query accounts with balance > 0
    const offset = cursor ?? 0;
    const accounts = await db.query.tokenAccounts.findMany({
      where: and(
        eq(tables.tokenAccounts.tokenId, tokenId)
        // Filter balance > 0 (need to handle BigInt serialization)
      ),
      limit: limit + 1, // Get one extra to check has_more
      offset,
      orderBy: (accounts: any, { desc }: any) => [desc(accounts.balance)],
    });

    // Filter balance > 0 and deserialize
    const holders = accounts
      .filter((acc: any) => {
        const balance = this.deserializeBigInt(acc.balance as any);
        return balance > BigInt(0);
      })
      .slice(0, limit)
      .map((acc: any) => ({
        subject_oid: acc.subjectOid,
        balance: this.deserializeBigInt(acc.balance as any),
        balance_formatted: this.formatBalance(
          this.deserializeBigInt(acc.balance as any),
          token.decimals
        ),
        nonce: this.deserializeBigInt(acc.nonce as any),
        updated_at: acc.updatedAt,
      }));

    const hasMore = accounts.length > limit;

    return {
      holders,
      next_cursor: hasMore ? offset + limit : null,
      has_more: hasMore,
    };
  }

  /**
   * Get token ledger history
   *
   * @param tokenId - Token ID
   * @param requesterOid - Optional requester OID for ACL checks
   * @param limit - Optional limit (default: 100)
   * @param cursor - Optional cursor for pagination
   * @returns Ledger history entries
   */
  async getLedgerHistory(
    tokenId: string,
    requesterOid?: string,
    limit: number = 100,
    cursor?: number
  ): Promise<{
    entries: Array<{
      ledger_id: number;
      ts: number;
      tx_id: string;
      kind: "mint" | "burn" | "transfer" | "adjust";
      from_subject_oid: string | null;
      to_subject_oid: string | null;
      amount: bigint;
      amount_formatted: string;
      actor_oid: string;
      ctx: Record<string, unknown> | null;
      created_at: number;
    }>;
    next_cursor: number | null;
    has_more: boolean;
  }> {
    const db = this.getDb();
    const tables = this.getTables();

    // ACL check
    const ual = this.ledger.hasService("ual")
      ? this.ledger.getService<UnifiedAccessLayer>("ual")
      : null;
    if (ual && requesterOid) {
      const hasAccess = await ual.check(requesterOid, "read", {
        kind: "token",
        id: tokenId,
      });

      if (!hasAccess) {
        return {
          entries: [],
          next_cursor: null,
          has_more: false,
        };
      }
    }

    // Get token for decimals
    const token = await this.getToken(tokenId);
    if (!token) {
      return {
        entries: [],
        next_cursor: null,
        has_more: false,
      };
    }

    // Query ledger entries
    const offset = cursor ?? 0;
    const entries = await db.query.tokenLedger.findMany({
      where: eq(tables.tokenLedger.tokenId, tokenId),
      limit: limit + 1, // Get one extra to check has_more
      offset,
      orderBy: (ledger: any, { desc }: any) => [desc(ledger.ts)],
    });

    const hasMore = entries.length > limit;
    const resultEntries = hasMore ? entries.slice(0, limit) : entries;

    // Deserialize entries
    const deserializedEntries = resultEntries.map((entry: any) => ({
      ledger_id: entry.id,
      ts:
        entry.ts instanceof Date
          ? entry.ts.getTime()
          : typeof entry.ts === "number"
            ? entry.ts
            : Date.now(),
      tx_id: entry.txId,
      kind: entry.kind as "mint" | "burn" | "transfer" | "adjust",
      from_subject_oid: entry.fromSubjectOid ?? null,
      to_subject_oid: entry.toSubjectOid ?? null,
      amount: this.deserializeBigInt(entry.amount as any),
      amount_formatted: this.formatBalance(
        this.deserializeBigInt(entry.amount as any),
        token.decimals
      ),
      actor_oid: entry.actorOid,
      ctx: entry.ctx
        ? typeof entry.ctx === "string"
          ? JSON.parse(entry.ctx)
          : entry.ctx
        : null,
      created_at: entry.createdAt,
    }));

    return {
      entries: deserializedEntries,
      next_cursor: hasMore ? offset + limit : null,
      has_more: hasMore,
    };
  }
}
