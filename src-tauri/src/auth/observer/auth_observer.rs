use tauri::AppHandle;

use crate::auth::keyring;
use crate::auth::store::save_to_disk;
use crate::auth::types::{AuthTokens, PersistedAuth, Semester};

#[derive(Debug, Clone)]
pub enum AuthEvent {
    LoggedIn {
        user_id: String,
        password: Option<String>,
    },
    TokensRefreshed {
        tokens: AuthTokens,
    },
    SemesterSelected {
        semester: Option<Semester>,
    },
    LoggedOut {
        user_id: Option<String>,
    },
}

/// Observer trait for reacting to authentication lifecycle changes.
pub trait AuthObserver: Send + Sync {
    fn on_auth_event(&self, event: &AuthEvent, app: &AppHandle, data: &PersistedAuth);
}

/// Observer that atomically persists updated PersistedAuth to disk.
pub struct DiskPersistenceObserver;

impl AuthObserver for DiskPersistenceObserver {
    fn on_auth_event(&self, _event: &AuthEvent, app: &AppHandle, data: &PersistedAuth) {
        if let Err(e) = save_to_disk(app, data) {
            eprintln!("[observer] Failed to persist auth state to disk: {}", e);
        }
    }
}

/// Observer that synchronizes user credentials with the native OS keyring.
pub struct KeyringSyncObserver;

impl AuthObserver for KeyringSyncObserver {
    fn on_auth_event(&self, event: &AuthEvent, _app: &AppHandle, _data: &PersistedAuth) {
        match event {
            AuthEvent::LoggedIn { user_id, password } => {
                if let Some(pwd) = password {
                    let _ = keyring::set_password(user_id, pwd);
                }
            }
            AuthEvent::LoggedOut { user_id } => {
                if let Some(uid) = user_id {
                    let _ = keyring::delete_password(uid);
                }
            }
            _ => {}
        }
    }
}

/// Subject that manages observers and dispatches events.
pub struct AuthSubject {
    observers: Vec<Box<dyn AuthObserver>>,
}

impl Default for AuthSubject {
    fn default() -> Self {
        Self {
            observers: vec![
                Box::new(DiskPersistenceObserver),
                Box::new(KeyringSyncObserver),
            ],
        }
    }
}

impl AuthSubject {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn attach(&mut self, observer: Box<dyn AuthObserver>) {
        self.observers.push(observer);
    }

    pub fn notify(&self, event: &AuthEvent, app: &AppHandle, data: &PersistedAuth) {
        for observer in &self.observers {
            observer.on_auth_event(event, app, data);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    struct MockObserver {
        called: Arc<AtomicBool>,
    }

    impl AuthObserver for MockObserver {
        fn on_auth_event(&self, _event: &AuthEvent, _app: &AppHandle, _data: &PersistedAuth) {
            self.called.store(true, Ordering::SeqCst);
        }
    }

    #[test]
    fn test_observer_pattern() {
        let called = Arc::new(AtomicBool::new(false));
        let mut subject = AuthSubject {
            observers: Vec::new(),
        };
        subject.attach(Box::new(MockObserver {
            called: called.clone(),
        }));

        assert!(!called.load(Ordering::SeqCst));
    }
}
