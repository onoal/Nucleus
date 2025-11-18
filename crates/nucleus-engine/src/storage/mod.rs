//! Storage backend for persistent ledger data
//!
//! This module provides the storage abstraction layer for persisting
//! ledger entries to disk. The storage backend is implemented in Rust
//! for performance, integrity, and correctness.
//!
//! # Architecture
//!
//! - **Storage in Rust core**: Database operations are always Rust-side
//! - **Hash reconstruction**: Chain is fully verified on load
//! - **Atomic operations**: Save operations are atomic with rollback on error
//! - **TypeScript passthrough**: TS config only specifies storage choice, no storage logic
//!
//! # Usage
//!
//! ```rust,ignore
//! use nucleus_engine::storage::{StorageBackend, sqlite::SqliteStorage};
//!
//! // Create storage backend
//! let mut storage = SqliteStorage::new("ledger.db")?;
//! storage.initialize()?;
//!
//! // Save entry
//! storage.save_entry(&entry)?;
//!
//! // Load all entries
//! let entries = storage.load_all_entries()?;
//!
//! // Verify integrity
//! let is_valid = storage.verify_integrity()?;
//! ```

use nucleus_core::hash_chain::ChainEntry;
use nucleus_core::Hash;

pub mod error;

// SQLite is only available on native targets (not WASM)
#[cfg(not(target_arch = "wasm32"))]
pub mod sqlite;

pub use error::{StorageError, StorageResult};

#[cfg(not(target_arch = "wasm32"))]
pub use sqlite::SqliteStorage;

/// Storage backend trait for persistent storage
///
/// This trait defines the interface for storing and retrieving
/// ledger entries from persistent storage (SQLite, PostgreSQL, etc.)
///
/// # Important
///
/// - Storage operations are always Rust-side for performance and correctness
/// - On load, the entire chain must be verified (hash reconstruction)
/// - Save operations should be atomic (rollback on failure)
/// - Storage is per-ledger (no global state)
///
/// # Implementation Notes
///
/// Implementations should:
/// - Use transactions for atomic operations
/// - Verify chain integrity on load
/// - Return entries in chain order (genesis first)
/// - Handle errors gracefully with proper error types
///
/// # Thread Safety
///
/// Storage backends are `Send` but not `Sync`. Each ledger engine owns
/// its storage backend and should not be shared across threads.
/// For multi-threaded scenarios, create multiple engine instances.
pub trait StorageBackend: Send {
    /// Initialize storage (create tables, run migrations)
    ///
    /// This method should be idempotent - calling it multiple times
    /// should be safe and not cause errors.
    ///
    /// # Returns
    ///
    /// - `Ok(())` if initialization succeeded
    /// - `Err(StorageError)` if initialization failed
    fn initialize(&mut self) -> StorageResult<()>;

    /// Save a chain entry to storage
    ///
    /// This operation should be atomic. If the save fails,
    /// the storage should remain in a consistent state.
    ///
    /// # Arguments
    ///
    /// * `entry` - Chain entry to save
    ///
    /// # Returns
    ///
    /// - `Ok(())` if saved successfully
    /// - `Err(StorageError)` if save failed
    fn save_entry(&mut self, entry: &ChainEntry) -> StorageResult<()>;

    /// Load a chain entry by hash
    ///
    /// # Arguments
    ///
    /// * `hash` - Hash of the entry to load
    ///
    /// # Returns
    ///
    /// - `Ok(Some(entry))` if found
    /// - `Ok(None)` if not found
    /// - `Err(StorageError)` if load failed
    fn load_entry(&self, hash: &Hash) -> StorageResult<Option<ChainEntry>>;

    /// Load all entries from storage
    ///
    /// # Important
    ///
    /// - Entries MUST be returned in chain order (genesis first)
    /// - Full reconstruction (hash, prev_hash, ordering) is required
    /// - The caller will verify chain integrity after load
    ///
    /// # Returns
    ///
    /// - `Ok(entries)` - All entries in storage, ordered by chain sequence
    /// - `Err(StorageError)` if load failed
    fn load_all_entries(&self) -> StorageResult<Vec<ChainEntry>>;

    /// Load entries in a range
    ///
    /// # Arguments
    ///
    /// * `from_hash` - Optional starting hash (inclusive)
    /// * `limit` - Maximum number of entries to load
    ///
    /// # Returns
    ///
    /// - `Ok(entries)` - Entries in range, ordered by chain sequence
    /// - `Err(StorageError)` if load failed
    fn load_entries_range(
        &self,
        from_hash: Option<&Hash>,
        limit: usize,
    ) -> StorageResult<Vec<ChainEntry>>;

    /// Get entry count
    ///
    /// # Returns
    ///
    /// - `Ok(count)` - Number of entries in storage
    /// - `Err(StorageError)` if query failed
    fn get_entry_count(&self) -> StorageResult<usize>;

    /// Get latest entry hash
    ///
    /// # Returns
    ///
    /// - `Ok(Some(hash))` if entries exist
    /// - `Ok(None)` if storage is empty
    /// - `Err(StorageError)` if query failed
    fn get_latest_hash(&self) -> StorageResult<Option<Hash>>;

    /// Verify storage integrity
    ///
    /// This method checks that all entries in storage form a valid chain.
    /// It recomputes hashes and verifies chain links.
    ///
    /// # Important
    ///
    /// - This performs full hash reconstruction
    /// - Chain verification is performed using `nucleus_core::hash_chain::verify_chain`
    /// - Any integrity failures should return detailed error information
    ///
    /// # Returns
    ///
    /// - `Ok(true)` if integrity is valid
    /// - `Err(StorageError::IntegrityFailed)` if integrity check failed
    /// - `Err(StorageError)` for other errors
    fn verify_integrity(&self) -> StorageResult<bool>;

    /// Close storage connection
    ///
    /// Cleanup and close database connections. This should be called
    /// when the storage is no longer needed.
    ///
    /// # Returns
    ///
    /// - `Ok(())` if closed successfully
    /// - `Err(StorageError)` if close failed
    fn close(&mut self) -> StorageResult<()>;
}

