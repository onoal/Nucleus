/**
 * Token model types
 *
 * Type definitions for token entities and operations.
 *
 * @module models/token
 */

/**
 * Token status
 */
export type TokenStatus = "active" | "paused";

/**
 * Token ledger operation kind
 */
export type TokenLedgerKind = "mint" | "burn" | "transfer" | "adjust";

/**
 * Token definition
 */
export interface Token {
  id: string; // tok_<uuidv7>
  issuerOid: string; // oid:onoal:org:...
  symbol?: string | null; // e.g., "USDC", "POINTS"
  name?: string | null; // e.g., "US Dollar Coin"
  decimals: number; // 0-18 (like ERC-20)
  supplyCap: bigint | null; // Max supply (null = unlimited)
  supply: bigint; // Current total supply
  status: TokenStatus; // 'active' | 'paused'
  metadata?: Record<string, unknown> | null; // Additional metadata
  adminPolicy?: Record<string, unknown> | null; // Governance rules
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}

/**
 * Token account (balance holder)
 */
export interface TokenAccount {
  id: number; // Auto-increment
  tokenId: string; // Reference to tokens.id
  subjectOid: string; // oid:onoal:user:... | oid:onoal:org:...
  balance: bigint; // Account balance in smallest unit
  nonce: bigint; // Anti-replay counter
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}

/**
 * Token ledger entry (double-entry accounting)
 */
export interface TokenLedgerEntry {
  id: number; // Auto-increment
  ts: Date; // Timestamp
  tokenId: string; // Reference to tokens.id
  txId: string; // Idempotency key (UUID)
  kind: TokenLedgerKind; // 'mint' | 'burn' | 'transfer' | 'adjust'
  fromSubjectOid: string | null; // Source (null for mint)
  toSubjectOid: string | null; // Destination (null for burn)
  amount: bigint; // Amount in smallest unit
  actorOid: string; // Who initiated the operation
  ctx?: Record<string, unknown> | null; // Context (grant_jti, dpop_thumbprint, etc.)
  createdAt: number; // Unix timestamp (ms)
}

/**
 * Create token options
 */
export interface CreateTokenOptions {
  issuer_oid: string;
  symbol?: string;
  name?: string;
  decimals: number; // 0-18
  supply_cap?: bigint | null; // null = unlimited
  metadata?: Record<string, unknown>;
  admin_policy?: Record<string, unknown>;
}

/**
 * Mint token options
 */
export interface MintTokenOptions {
  tokenId: string;
  to: string; // subject_oid
  amount: bigint; // In smallest unit
  txId: string; // Idempotency key
  memo?: string;
  actorOid: string; // Who initiated
  ctx?: Record<string, unknown>; // Context
}

/**
 * Transfer token options
 */
export interface TransferTokenOptions {
  tokenId: string;
  from: string; // subject_oid
  to: string; // subject_oid
  amount: bigint; // In smallest unit
  nonce: bigint; // Current account nonce
  txId: string; // Idempotency key
  memo?: string;
  actorOid: string; // Who initiated
  ctx?: Record<string, unknown>; // Context
}

/**
 * Burn token options
 */
export interface BurnTokenOptions {
  tokenId: string;
  from: string; // subject_oid
  amount: bigint; // In smallest unit
  nonce: bigint; // Current account nonce
  txId: string; // Idempotency key
  memo?: string;
  actorOid: string; // Who initiated
  ctx?: Record<string, unknown>; // Context
}
