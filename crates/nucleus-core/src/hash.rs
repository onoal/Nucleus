use std::fmt;
use hex;

/// Hash type - represents a SHA-256 hash (32 bytes)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Hash([u8; 32]);

impl Hash {
    /// Create a Hash from a byte array
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Create a Hash from a byte slice (must be exactly 32 bytes)
    pub fn from_slice(slice: &[u8]) -> Result<Self, HashError> {
        if slice.len() != 32 {
            return Err(HashError::InvalidLength(slice.len()));
        }

        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(slice);
        Ok(Self(bytes))
    }

    /// Get hash as byte array reference
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    /// Convert hash to hex string
    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }

    /// Create hash from hex string
    pub fn from_hex(hex_str: &str) -> Result<Self, HashError> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| HashError::InvalidHex(e.to_string()))?;

        Self::from_slice(&bytes)
    }

    /// Zero hash (all zeros)
    pub fn zero() -> Self {
        Self([0u8; 32])
    }
}

impl fmt::Display for Hash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum HashError {
    #[error("Invalid hash length: expected 32, got {0}")]
    InvalidLength(usize),

    #[error("Invalid hex string: {0}")]
    InvalidHex(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_from_bytes() {
        let bytes = [1u8; 32];
        let hash = Hash::from_bytes(bytes);
        assert_eq!(hash.as_bytes(), &bytes);
    }

    #[test]
    fn test_hash_from_slice() {
        let bytes = [2u8; 32];
        let hash = Hash::from_slice(&bytes).unwrap();
        assert_eq!(hash.as_bytes(), &bytes);
    }

    #[test]
    fn test_hash_from_slice_invalid_length() {
        let bytes = [1u8; 31];
        assert!(Hash::from_slice(&bytes).is_err());
    }

    #[test]
    fn test_hash_to_hex() {
        let hash = Hash::from_bytes([0xABu8; 32]);
        let hex = hash.to_hex();
        assert_eq!(hex.len(), 64); // 32 bytes * 2 hex chars
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_hash_from_hex() {
        let original = Hash::from_bytes([0xABu8; 32]);
        let hex = original.to_hex();
        let restored = Hash::from_hex(&hex).unwrap();
        assert_eq!(original, restored);
    }

    #[test]
    fn test_hash_zero() {
        let zero = Hash::zero();
        assert_eq!(zero.as_bytes(), &[0u8; 32]);
    }

    #[test]
    fn test_hash_display() {
        let hash = Hash::from_bytes([0xABu8; 32]);
        let display = format!("{}", hash);
        assert_eq!(display, hash.to_hex());
    }
}

