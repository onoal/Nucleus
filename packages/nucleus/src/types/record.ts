/**
 * Record payload type
 */
export type RecordPayload = Record<string, unknown>;

/**
 * Record metadata type
 */
export type RecordMetadata = Record<string, unknown>;

/**
 * Ledger record
 */
export interface LedgerRecord {
  /**
   * Unique record identifier
   */
  id: string;

  /**
   * Stream type (e.g., "proofs", "assets", "consent")
   */
  stream: string;

  /**
   * Unix timestamp in milliseconds
   */
  timestamp: number;

  /**
   * Record payload (JSON object)
   */
  payload: RecordPayload;

  /**
   * Optional metadata
   */
  meta?: RecordMetadata;
}

/**
 * Query filters
 */
export interface QueryFilters {
  /**
   * Filter by stream
   */
  stream?: string;

  /**
   * Filter by record ID
   */
  id?: string;

  /**
   * Limit number of results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Timestamp range (start)
   */
  timestampFrom?: number;

  /**
   * Timestamp range (end)
   */
  timestampTo?: number;

  /**
   * Module-specific filters
   */
  moduleFilters?: Record<string, unknown>;
}

/**
 * Query result
 */
export interface QueryResult {
  /**
   * Matching records
   */
  records: LedgerRecord[];

  /**
   * Total number of matching records (before limit/offset)
   */
  total: number;

  /**
   * Whether there are more results
   */
  hasMore: boolean;
}
