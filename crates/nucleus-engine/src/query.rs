use serde::{Deserialize, Serialize};
use serde_json::Value;
use nucleus_core::Record;

/// Query filters for record retrieval
#[derive(Debug, Clone)]
pub struct QueryFilters {
    /// Filter by stream
    pub stream: Option<String>,

    /// Filter by record ID
    pub id: Option<String>,

    /// Limit number of results
    pub limit: Option<usize>,

    /// Offset for pagination
    pub offset: Option<usize>,

    /// Timestamp range (start)
    pub timestamp_from: Option<u64>,

    /// Timestamp range (end)
    pub timestamp_to: Option<u64>,

    /// Module-specific filters (JSON)
    pub module_filters: Value,
}

impl QueryFilters {
    /// Create new empty filters
    pub fn new() -> Self {
        Self::default()
    }

    /// Filter by stream
    pub fn with_stream(mut self, stream: String) -> Self {
        self.stream = Some(stream);
        self
    }

    /// Filter by ID
    pub fn with_id(mut self, id: String) -> Self {
        self.id = Some(id);
        self
    }

    /// Set limit
    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Set offset
    pub fn with_offset(mut self, offset: usize) -> Self {
        self.offset = Some(offset);
        self
    }

    /// Set timestamp range
    pub fn with_timestamp_range(mut self, from: Option<u64>, to: Option<u64>) -> Self {
        self.timestamp_from = from;
        self.timestamp_to = to;
        self
    }

    /// Set module filters
    pub fn with_module_filters(mut self, filters: Value) -> Self {
        self.module_filters = filters;
        self
    }
}

impl Default for QueryFilters {
    fn default() -> Self {
        Self {
            stream: None,
            id: None,
            limit: None,
            offset: None,
            timestamp_from: None,
            timestamp_to: None,
            module_filters: Value::Object(serde_json::Map::new()),
        }
    }
}

/// Query result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    /// Matching records
    pub records: Vec<Record>,

    /// Total number of matching records (before limit/offset)
    pub total: usize,

    /// Whether there are more results
    pub has_more: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_filters_new() {
        let filters = QueryFilters::new();

        assert!(filters.stream.is_none());
        assert!(filters.id.is_none());
        assert!(filters.limit.is_none());
    }

    #[test]
    fn test_query_filters_builder() {
        let filters = QueryFilters::new()
            .with_stream("proofs".to_string())
            .with_limit(10)
            .with_offset(5);

        assert_eq!(filters.stream, Some("proofs".to_string()));
        assert_eq!(filters.limit, Some(10));
        assert_eq!(filters.offset, Some(5));
    }
}

