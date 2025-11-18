-- Create entries table for ledger storage
-- This table stores all chain entries with full serialization for integrity

CREATE TABLE IF NOT EXISTS entries (
  -- Primary key: entry hash
  hash TEXT PRIMARY KEY,
  
  -- Chain link: previous entry hash (NULL for genesis)
  prev_hash TEXT,
  
  -- Record fields
  record_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  
  -- JSON payloads for querying
  payload TEXT NOT NULL,
  meta TEXT,
  
  -- Full serialized record for reconstruction
  serialized TEXT NOT NULL,
  
  -- Metadata
  created_at INTEGER NOT NULL
);

-- Performance indexes

-- Index for chain traversal (lookup by previous hash)
CREATE INDEX IF NOT EXISTS idx_entries_prev_hash
  ON entries(prev_hash);

-- Index for record ID lookups
CREATE INDEX IF NOT EXISTS idx_entries_record_id
  ON entries(record_id);

-- Index for stream filtering
CREATE INDEX IF NOT EXISTS idx_entries_stream
  ON entries(stream);

-- Index for timestamp range queries
CREATE INDEX IF NOT EXISTS idx_entries_timestamp
  ON entries(timestamp);

-- Index for latest hash lookup (ordered by creation time)
CREATE INDEX IF NOT EXISTS idx_entries_created_at
  ON entries(created_at DESC);

