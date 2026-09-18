use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

use super::types::PersistedAuth;

pub struct AuthStore {
    pub(crate) inner: Mutex<PersistedAuth>,
    pub(crate) relogin_mutex: tokio::sync::Mutex<()>,
}

impl AuthStore {
    fn new(initial: PersistedAuth) -> Self {
        Self {
            inner: Mutex::new(initial),
            relogin_mutex: tokio::sync::Mutex::new(()),
        }
    }
}

pub fn auth_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;

    fs::create_dir_all(&app_data_dir).map_err(|e| format!("failed to create app data dir: {e}"))?;

    Ok(app_data_dir.join("auth_state.json"))
}

pub fn load_from_disk(app: &AppHandle) -> PersistedAuth {
    let path = match auth_file_path(app) {
        Ok(path) => path,
        Err(_) => return PersistedAuth::default(),
    };

    if !path.exists() {
        return PersistedAuth::default();
    }

    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(_) => return PersistedAuth::default(),
    };

    serde_json::from_str::<PersistedAuth>(&content).unwrap_or_default()
}

pub fn save_to_disk(app: &AppHandle, data: &PersistedAuth) -> Result<(), String> {
    let path = auth_file_path(app)?;
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("failed to serialize auth state: {e}"))?;

    fs::write(path, content).map_err(|e| format!("failed to write auth state: {e}"))
}

pub fn now_unix_ms() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}

pub fn init_auth_store(app: &AppHandle) -> AuthStore {
    AuthStore::new(load_from_disk(app))
}
