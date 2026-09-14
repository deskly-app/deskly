use crate::auth::crypto;
use crate::auth::keyring;
use crate::core::error::BackendError;

pub trait CredentialStorageStrategy: Send + Sync {
    fn store_credential(&self, user_id: &str, password: &str) -> Result<Option<String>, BackendError>;
    fn retrieve_credential(&self, user_id: &str, encrypted: Option<&str>) -> Result<String, BackendError>;
    fn remove_credential(&self, user_id: &str) -> Result<(), BackendError>;
}

/// Hybrid credential strategy:
/// 1. Tries to decrypt password stored in encrypted format.
/// 2. If decryption fails or missing, falls back to native OS keyring.
/// 3. Upon successful recovery from keyring, signals that the encrypted copy should be repaired.
pub struct HybridCredentialStrategy;

impl HybridCredentialStrategy {
    pub fn encrypt_password(password: &str) -> Result<String, BackendError> {
        crypto::encrypt_password(password)
            .map_err(|e| BackendError::StorageError(format!("Encryption failed: {e}")))
    }

    pub fn decrypt_password(encrypted: &str) -> Result<String, BackendError> {
        crypto::decrypt_password(encrypted)
            .map_err(|e| BackendError::StorageError(format!("Decryption failed: {e}")))
    }

    pub fn recover_password(
        user_id: &str,
        encrypted_password: Option<&str>,
    ) -> Result<(String, bool), BackendError> {
        if let Some(stored_encrypted) = encrypted_password {
            match Self::decrypt_password(stored_encrypted) {
                Ok(pwd) => return Ok((pwd, false)),
                Err(decrypt_err) => {
                    eprintln!(
                        "[credential_strategy] Decryption failed, attempting keyring fallback: {}",
                        decrypt_err
                    );
                    match keyring::get_password_with_retry(user_id) {
                        Ok(pwd) => {
                            eprintln!("[credential_strategy] Keyring fallback succeeded!");
                            return Ok((pwd, true)); // true indicates repair needed
                        }
                        Err(keyring_err) if keyring::is_missing_entry_error(&keyring_err) => {
                            return Err(BackendError::AuthFailed(
                                "Auto-login credentials are unavailable. Please log in again.".to_string(),
                            ));
                        }
                        Err(keyring_err) => {
                            return Err(BackendError::StorageError(format!(
                                "Credential recovery failed: decrypt={decrypt_err}; keyring={keyring_err}"
                            )));
                        }
                    }
                }
            }
        }

        // No encrypted password, try keyring directly
        match keyring::get_password_with_retry(user_id) {
            Ok(pwd) => Ok((pwd, true)),
            Err(e) if keyring::is_missing_entry_error(&e) => Err(BackendError::AuthFailed(
                "No stored password found for auto-login. Please log in again.".to_string(),
            )),
            Err(e) => Err(BackendError::StorageError(format!(
                "Failed to retrieve password from keyring: {e}"
            ))),
        }
    }
}
