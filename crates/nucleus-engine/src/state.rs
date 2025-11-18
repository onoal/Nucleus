use nucleus_core::Hash;
use nucleus_core::hash_chain::ChainEntry;
use std::collections::HashMap;

/// In-memory ledger state
pub struct LedgerState {
    /// All chain entries in order
    entries: Vec<ChainEntry>,

    /// Index by hash for O(1) lookup
    by_hash: HashMap<Hash, usize>,

    /// Index by record ID for O(1) lookup
    by_id: HashMap<String, usize>,

    /// Latest entry hash (tip of chain)
    latest_hash: Option<Hash>,
}

impl LedgerState {
    /// Create a new empty ledger state
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            by_hash: HashMap::new(),
            by_id: HashMap::new(),
            latest_hash: None,
        }
    }

    /// Append a chain entry to the state
    pub fn append(&mut self, entry: ChainEntry) {
        let idx = self.entries.len();

        // Index by hash
        self.by_hash.insert(entry.hash, idx);

        // Index by ID
        self.by_id.insert(entry.record.id.clone(), idx);

        // Update latest hash
        self.latest_hash = Some(entry.hash);

        // Append to entries
        self.entries.push(entry);
    }

    /// Get entry by hash
    pub fn get_by_hash(&self, hash: &Hash) -> Option<&ChainEntry> {
        self.by_hash
            .get(hash)
            .map(|&idx| &self.entries[idx])
    }

    /// Get entry by record ID
    pub fn get_by_id(&self, id: &str) -> Option<&ChainEntry> {
        self.by_id
            .get(id)
            .map(|&idx| &self.entries[idx])
    }

    /// Get latest entry hash (tip of chain)
    pub fn latest_hash(&self) -> Option<&Hash> {
        self.latest_hash.as_ref()
    }

    /// Get latest entry
    pub fn latest_entry(&self) -> Option<&ChainEntry> {
        self.latest_hash
            .as_ref()
            .and_then(|hash| self.get_by_hash(hash))
    }

    /// Get all entries
    pub fn all_entries(&self) -> &[ChainEntry] {
        &self.entries
    }

    /// Get entry count
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Check if state is empty
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Get entries by stream
    pub fn get_by_stream(&self, stream: &str) -> Vec<&ChainEntry> {
        self.entries
            .iter()
            .filter(|entry| entry.record.stream == stream)
            .collect()
    }

    /// Get entries in range (for pagination)
    pub fn get_range(&self, start: usize, end: usize) -> &[ChainEntry] {
        let end = end.min(self.entries.len());
        let start = start.min(end);
        &self.entries[start..end]
    }
}

impl Default for LedgerState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nucleus_core::Record;

    fn create_test_entry(id: &str, prev_hash: Option<Hash>) -> ChainEntry {
        let record = Record::new(
            id.to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        ChainEntry::new(record, prev_hash).unwrap()
    }

    #[test]
    fn test_ledger_state_new() {
        let state = LedgerState::new();

        assert!(state.is_empty());
        assert_eq!(state.len(), 0);
        assert!(state.latest_hash().is_none());
    }

    #[test]
    fn test_ledger_state_append() {
        let mut state = LedgerState::new();
        let entry = create_test_entry("entry-1", None);

        state.append(entry.clone());

        assert_eq!(state.len(), 1);
        assert!(state.latest_hash().is_some());
        assert_eq!(state.latest_hash(), Some(&entry.hash));
    }

    #[test]
    fn test_ledger_state_get_by_hash() {
        let mut state = LedgerState::new();
        let entry = create_test_entry("entry-1", None);
        let hash = entry.hash;

        state.append(entry.clone());

        let retrieved = state.get_by_hash(&hash);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().record.id, "entry-1");
    }

    #[test]
    fn test_ledger_state_get_by_id() {
        let mut state = LedgerState::new();
        let entry = create_test_entry("entry-1", None);

        state.append(entry);

        let retrieved = state.get_by_id("entry-1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().record.id, "entry-1");
    }

    #[test]
    fn test_ledger_state_chain_linking() {
        let mut state = LedgerState::new();

        let entry1 = create_test_entry("entry-1", None);
        let hash1 = entry1.hash;
        state.append(entry1);

        let entry2 = create_test_entry("entry-2", Some(hash1));
        let hash2 = entry2.hash;
        state.append(entry2);

        assert_eq!(state.len(), 2);
        assert_eq!(state.latest_hash(), Some(&hash2));

        let retrieved2 = state.get_by_hash(&hash2).unwrap();
        assert_eq!(retrieved2.prev_hash, Some(hash1));
    }

    #[test]
    fn test_ledger_state_get_by_stream() {
        let mut state = LedgerState::new();

        let entry1 = Record::new(
            "entry-1".to_string(),
            "proofs".to_string(),
            1234567890,
            serde_json::json!({"type": "proof"}),
        );
        state.append(ChainEntry::new(entry1, None).unwrap());

        let entry2 = Record::new(
            "entry-2".to_string(),
            "assets".to_string(),
            1234567891,
            serde_json::json!({"type": "asset"}),
        );
        state.append(ChainEntry::new(entry2, None).unwrap());

        let proofs = state.get_by_stream("proofs");
        assert_eq!(proofs.len(), 1);
        assert_eq!(proofs[0].record.id, "entry-1");

        let assets = state.get_by_stream("assets");
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].record.id, "entry-2");
    }
}

