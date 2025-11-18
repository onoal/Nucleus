use thiserror::Error;

pub type AclResult<T> = Result<T, AclError>;

#[derive(Debug, Error)]
pub enum AclError {
    #[error("Access denied: {0}")]
    AccessDenied(String),

    #[error("Invalid grant: {0}")]
    InvalidGrant(String),

    #[error("Grant not found")]
    GrantNotFound,
}

