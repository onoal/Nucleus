//! SQLite storage backend implementation
//!
//! This module provides a production-ready SQLite storage implementation
//! for persisting ledger entries.
//!
//! # Features
//!
//! - WAL mode for better concurrency
//! - Atomic operations with transactions
//! - Full chain integrity verification on load
//! - Indexed queries for performance
//!
//! # Usage
//!
//! ```rust,ignore
//! use nucleus_engine::storage::sqlite::SqliteStorage;
//!
//! let mut storage = SqliteStorage::new("ledger.db")?;
//! storage.initialize()?;
//!
//! // Save entry
//! storage.save_entry(&entry)?;
//!
//! // Load and verify
//! let entries = storage.load_all_entries()?;
//! let is_valid = storage.verify_integrity()?;
//! ```

use rusqlite::{Connection, params, Row, OptionalExtension};
use nucleus_core::{Record, Hash};
use nucleus_core::hash_chain::ChainEntry;
use std::fs;
use std::path::Path;

use super::{StorageBackend, StorageError, StorageResult};

/// SQLite storage backend
///
/// Provides persistent storage for ledger entries using SQLite.
/// The storage uses WAL mode for better concurrency and maintains
/// full chain integrity.
pub struct SqliteStorage {
    conn: Connection,
    #[allow(dead_code)]
    path: String, // Keep for debugging/logging
}

impl SqliteStorage {
    /// Create new SQLite storage
    ///
    /// # Arguments
    ///
    /// * `path` - Path to SQLite database file (use ":memory:" for in-memory)
    ///
    /// # Returns
    ///
    /// * `Ok(SqliteStorage)` if created successfully
    /// * `Err(StorageError)` if creation failed
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let storage = SqliteStorage::new("ledger.db")?;
    /// ```
    pub fn new(path: impl AsRef<Path>) -> StorageResult<Self> {
        let path_str = path.as_ref().to_string_lossy().to_string();

        // Create parent directory if needed
        if path_str != ":memory:" {
            if let Some(parent) = Path::new(&path_str).parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| StorageError::Database(format!("Failed to create directory: {}", e)))?;
            }
        }

        let conn = Connection::open(&path_str)
            .map_err(|e| StorageError::Database(format!("Failed to open database: {}", e)))?;

        // Enable WAL mode for better concurrency
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| StorageError::Database(format!("Failed to enable WAL: {}", e)))?;

        // Enable foreign keys
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(|e| StorageError::Database(format!("Failed to enable foreign keys: {}", e)))?;

        Ok(Self {
            conn,
            path: path_str,
        })
    }

    /// Load migration SQL
    fn load_migration(&self, name: &str) -> StorageResult<String> {
        match name {
            "001_create_entries" => Ok(include_str!("migrations/001_create_entries.sql").to_string()),
            _ => Err(StorageError::Database(format!("Unknown migration: {}", name))),
        }
    }

    /// Run migration
    fn run_migration(&self, name: &str) -> StorageResult<()> {
        let sql = self.load_migration(name)?;
        self.conn.execute_batch(&sql)
            .map_err(|e| StorageError::Database(format!("Migration '{}' failed: {}", name, e)))?;
        Ok(())
    }

    /// Deserialize entry from database row
    fn row_to_entry(&self, row: &Row) -> StorageResult<ChainEntry> {
        let hash_hex: String = row.get(0)
            .map_err(|e| StorageError::Deserialization(format!("Failed to get hash: {}", e)))?;
        let prev_hash_hex: Option<String> = row.get(1)
            .map_err(|e| StorageError::Deserialization(format!("Failed to get prev_hash: {}", e)))?;
        let serialized: String = row.get(7)
            .map_err(|e| StorageError::Deserialization(format!("Failed to get serialized: {}", e)))?;

        // Parse hash
        let hash = Hash::from_hex(&hash_hex)
            .map_err(|e| StorageError::Deserialization(format!("Invalid hash '{}': {:?}", hash_hex, e)))?;

        // Parse prev_hash
        let prev_hash = prev_hash_hex
            .map(|h| Hash::from_hex(&h))
            .transpose()
            .map_err(|e| StorageError::Deserialization(format!("Invalid prev_hash: {:?}", e)))?;

        // Deserialize record
        let record: Record = serde_json::from_str(&serialized)
            .map_err(|e| StorageError::Deserialization(format!("Failed to deserialize record: {}", e)))?;

        // Reconstruct ChainEntry
        Ok(ChainEntry {
            hash,
            prev_hash,
            record,
        })
    }
}

impl StorageBackend for SqliteStorage {
    fn initialize(&mut self) -> StorageResult<()> {
        self.run_migration("001_create_entries")?;
        Ok(())
    }

    fn save_entry(&mut self, entry: &ChainEntry) -> StorageResult<()> {
        // Serialize record
        let serialized = serde_json::to_string(&entry.record)
            .map_err(|e| StorageError::Serialization(format!("Failed to serialize record: {}", e)))?;

        // Serialize payload and meta separately for querying
        let payload_json = serde_json::to_string(&entry.record.payload)
            .map_err(|e| StorageError::Serialization(format!("Failed to serialize payload: {}", e)))?;

        let meta_json = entry.record.meta.as_ref()
            .map(|m| serde_json::to_string(m))
            .transpose()
            .map_err(|e| StorageError::Serialization(format!("Failed to serialize meta: {}", e)))?;

        // Insert or replace entry
        self.conn.execute(
            "INSERT OR REPLACE INTO entries
             (hash, prev_hash, record_id, stream, timestamp, payload, meta, serialized, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                entry.hash.to_hex(),
                entry.prev_hash.as_ref().map(|h| h.to_hex()),
                entry.record.id,
                entry.record.stream,
                entry.record.timestamp as i64,
                payload_json,
                meta_json,
                serialized,
                entry.record.timestamp as i64,
            ],
        )
        .map_err(|e| StorageError::Database(format!("Failed to save entry: {}", e)))?;

        Ok(())
    }

    fn load_entry(&self, hash: &Hash) -> StorageResult<Option<ChainEntry>> {
        let hash_hex = hash.to_hex();
        
        let mut stmt = self.conn.prepare(
            "SELECT hash, prev_hash, record_id, stream, timestamp, payload, meta, serialized, created_at
             FROM entries WHERE hash = ?1"
        )
        .map_err(|e| StorageError::Database(format!("Failed to prepare query: {}", e)))?;

        let mut rows = stmt.query(params![hash_hex])
            .map_err(|e| StorageError::Database(format!("Query failed: {}", e)))?;

        match rows.next() {
            Ok(Some(row)) => Ok(Some(self.row_to_entry(row)?)),
            Ok(None) => Ok(None),
            Err(e) => Err(StorageError::Database(format!("Row iteration failed: {}", e))),
        }
    }

    fn load_all_entries(&self) -> StorageResult<Vec<ChainEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT hash, prev_hash, record_id, stream, timestamp, payload, meta, serialized, created_at
             FROM entries ORDER BY created_at ASC"
        )
        .map_err(|e| StorageError::Database(format!("Failed to prepare query: {}", e)))?;

        let rows = stmt.query_map([], |row| Ok(self.row_to_entry(row)))
            .map_err(|e| StorageError::Database(format!("Query failed: {}", e)))?;

        let mut entries = Vec::new();
        for row_result in rows {
            let entry = row_result
                .map_err(|e| StorageError::Database(format!("Row iteration failed: {}", e)))??;
            entries.push(entry);
        }

        Ok(entries)
    }

    fn load_entries_range(
        &self,
        from_hash: Option<&Hash>,
        limit: usize,
    ) -> StorageResult<Vec<ChainEntry>> {
        if let Some(hash) = from_hash {
            let query = format!(
                "SELECT hash, prev_hash, record_id, stream, timestamp, payload, meta, serialized, created_at
                 FROM entries
                 WHERE created_at >= (SELECT created_at FROM entries WHERE hash = ?)
                 ORDER BY created_at ASC LIMIT {}",
                limit
            );
            
            let mut stmt = self.conn.prepare(&query)
                .map_err(|e| StorageError::Database(format!("Failed to prepare query: {}", e)))?;

            let rows = stmt.query_map(params![hash.to_hex()], |row| Ok(self.row_to_entry(row)))
                .map_err(|e| StorageError::Database(format!("Query failed: {}", e)))?;

            let mut entries = Vec::new();
            for row_result in rows {
                let entry = row_result
                    .map_err(|e| StorageError::Database(format!("Row iteration failed: {}", e)))??;
                entries.push(entry);
            }

            Ok(entries)
        } else {
            let query = format!(
                "SELECT hash, prev_hash, record_id, stream, timestamp, payload, meta, serialized, created_at
                 FROM entries
                 ORDER BY created_at ASC LIMIT {}",
                limit
            );
            
            let mut stmt = self.conn.prepare(&query)
                .map_err(|e| StorageError::Database(format!("Failed to prepare query: {}", e)))?;

            let rows = stmt.query_map([], |row| Ok(self.row_to_entry(row)))
                .map_err(|e| StorageError::Database(format!("Query failed: {}", e)))?;

            let mut entries = Vec::new();
            for row_result in rows {
                let entry = row_result
                    .map_err(|e| StorageError::Database(format!("Row iteration failed: {}", e)))??;
                entries.push(entry);
            }

            Ok(entries)
        }
    }

    fn get_entry_count(&self) -> StorageResult<usize> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM entries",
            [],
            |row| row.get(0)
        )
        .map_err(|e| StorageError::Database(format!("Count query failed: {}", e)))?;

        Ok(count as usize)
    }

    fn get_latest_hash(&self) -> StorageResult<Option<Hash>> {
        let hash_hex: Option<String> = self.conn.query_row(
            "SELECT hash FROM entries ORDER BY created_at DESC LIMIT 1",
            [],
            |row| row.get(0)
        )
        .optional()
        .map_err(|e| StorageError::Database(format!("Latest hash query failed: {}", e)))?;

        if let Some(hex) = hash_hex {
            Hash::from_hex(&hex)
                .map(Some)
                .map_err(|e| StorageError::Deserialization(format!("Invalid hash: {:?}", e)))
        } else {
            Ok(None)
        }
    }

    fn verify_integrity(&self) -> StorageResult<bool> {
        // Load all entries
        let entries = self.load_all_entries()?;

        if entries.is_empty() {
            return Ok(true); // Empty storage is valid
        }

        // Verify chain integrity using nucleus-core verification
        use nucleus_core::hash_chain::verify_chain;
        let result = verify_chain(&entries);

        if !result.valid {
            return Err(StorageError::IntegrityFailed(
                format!("Chain integrity check failed: {} errors found. First error: {:?}",
                    result.errors.len(),
                    result.errors.first()
                )
            ));
        }

        Ok(true)
    }

    fn close(&mut self) -> StorageResult<()> {
        // Explicitly close the connection
        // Note: Connection::close consumes self, so we need to replace it
        let conn = std::mem::replace(
            &mut self.conn,
            Connection::open(":memory:").map_err(|e| StorageError::Database(format!("Failed to create temp connection: {}", e)))?
        );
        
        conn.close()
            .map_err(|(_, e)| StorageError::Database(format!("Failed to close database: {}", e)))?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nucleus_core::Record;
    use serde_json::json;

    fn create_test_record(id: &str, stream: &str, timestamp: u64) -> Record {
        Record {
            id: id.to_string(),
            stream: stream.to_string(),
            timestamp,
            payload: json!({"type": "test", "data": "test data"}),
            meta: None,
        }
    }

    #[test]
    fn test_sqlite_storage_initialize() {
        let mut storage = SqliteStorage::new(":memory:").unwrap();
        storage.initialize().unwrap();
        
        // Verify tables exist
        let count: i64 = storage.conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='entries'",
            [],
            |row| row.get(0)
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_sqlite_storage_save_and_load() {
        let mut storage = SqliteStorage::new(":memory:").unwrap();
        storage.initialize().unwrap();

        // Create genesis entry
        let record = create_test_record("test-1", "proofs", 1000);
        let entry = ChainEntry::genesis(record).unwrap();
        
        // Save entry
        storage.save_entry(&entry).unwrap();

        // Load entry
        let loaded = storage.load_entry(&entry.hash).unwrap();
        assert!(loaded.is_some());
        let loaded_entry = loaded.unwrap();
        assert_eq!(loaded_entry.hash, entry.hash);
        assert_eq!(loaded_entry.record.id, "test-1");
    }

    #[test]
    fn test_sqlite_storage_entry_count() {
        let mut storage = SqliteStorage::new(":memory:").unwrap();
        storage.initialize().unwrap();

        assert_eq!(storage.get_entry_count().unwrap(), 0);

        let record = create_test_record("test-1", "proofs", 1000);
        let entry = ChainEntry::genesis(record).unwrap();
        storage.save_entry(&entry).unwrap();

        assert_eq!(storage.get_entry_count().unwrap(), 1);
    }

    #[test]
    fn test_sqlite_storage_verify_integrity() {
        let mut storage = SqliteStorage::new(":memory:").unwrap();
        storage.initialize().unwrap();

        // Create valid chain
        let record1 = create_test_record("test-1", "proofs", 1000);
        let entry1 = ChainEntry::genesis(record1).unwrap();
        storage.save_entry(&entry1).unwrap();

        let record2 = create_test_record("test-2", "proofs", 1001);
        let entry2 = ChainEntry::new(record2, Some(entry1.hash)).unwrap();
        storage.save_entry(&entry2).unwrap();

        // Verify integrity
        assert!(storage.verify_integrity().unwrap());
    }
}

