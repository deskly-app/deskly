use std::fmt;

#[derive(Debug)]
pub enum BackendError {
    Network(String),
    SessionExpired(String),
    AuthFailed(String),
    ParseError(String),
    StorageError(String),
    InvalidInput(String),
    Cancelled(String),
    Other(String),
}

impl fmt::Display for BackendError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BackendError::Network(msg) => write!(f, "Network error: {}", msg),
            BackendError::SessionExpired(msg) => write!(f, "Session expired: {}", msg),
            BackendError::AuthFailed(msg) => write!(f, "Authentication failed: {}", msg),
            BackendError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            BackendError::StorageError(msg) => write!(f, "Storage error: {}", msg),
            BackendError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            BackendError::Cancelled(msg) => write!(f, "Cancelled: {}", msg),
            BackendError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for BackendError {}

impl From<BackendError> for String {
    fn from(err: BackendError) -> Self {
        err.to_string()
    }
}

impl From<reqwest::Error> for BackendError {
    fn from(err: reqwest::Error) -> Self {
        BackendError::Network(err.to_string())
    }
}

impl From<serde_json::Error> for BackendError {
    fn from(err: serde_json::Error) -> Self {
        BackendError::ParseError(err.to_string())
    }
}

impl From<String> for BackendError {
    fn from(err: String) -> Self {
        BackendError::Other(err)
    }
}

impl From<&str> for BackendError {
    fn from(err: &str) -> Self {
        BackendError::Other(err.to_string())
    }
}
