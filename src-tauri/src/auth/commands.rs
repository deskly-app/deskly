use tauri::{AppHandle, State};

use crate::auth::keyring;
use crate::auth::service::AuthService;
use crate::auth::store::AuthStore;
use crate::auth::strategies::RemoteDefaultSemesterStrategy;
use crate::auth::types::{AuthState, AuthTokens, CredentialStatus, LoginResponse, Semester};

#[tauri::command]
pub async fn auth_login(
    app: AppHandle,
    store: State<'_, AuthStore>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    AuthService::login(&app, &store, username, password)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub fn auth_logout(app: AppHandle, store: State<'_, AuthStore>) -> Result<bool, String> {
    AuthService::logout(&app, &store).map_err(Into::into)
}

#[tauri::command]
pub fn auth_get_state(store: State<'_, AuthStore>) -> Result<Option<AuthState>, String> {
    AuthService::get_state(&store).map_err(Into::into)
}

#[tauri::command]
pub fn auth_get_credential_status(store: State<'_, AuthStore>) -> Result<CredentialStatus, String> {
    AuthService::get_credential_status(&store).map_err(Into::into)
}

#[tauri::command]
pub async fn auth_restore_session(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<Option<AuthState>, String> {
    AuthService::restore_session(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub fn auth_set_tokens(
    app: AppHandle,
    store: State<'_, AuthStore>,
    tokens: AuthTokens,
) -> Result<bool, String> {
    AuthService::set_tokens(&app, &store, tokens).map_err(Into::into)
}

#[tauri::command]
pub fn auth_get_tokens(store: State<'_, AuthStore>) -> Result<Option<AuthTokens>, String> {
    Ok(AuthService::get_tokens_from_store(&store).ok())
}

#[tauri::command]
pub fn auth_clear_tokens(app: AppHandle, store: State<'_, AuthStore>) -> Result<bool, String> {
    AuthService::clear_tokens(&app, &store).map_err(Into::into)
}

#[tauri::command]
pub fn auth_get_semester(store: State<'_, AuthStore>) -> Result<Option<Semester>, String> {
    AuthService::get_semester(&store).map_err(Into::into)
}

#[tauri::command]
pub fn auth_set_semester(
    app: AppHandle,
    store: State<'_, AuthStore>,
    semester: Semester,
) -> Result<bool, String> {
    AuthService::set_semester(&app, &store, semester).map_err(Into::into)
}

#[tauri::command]
pub fn auth_clear_semester(app: AppHandle, store: State<'_, AuthStore>) -> Result<bool, String> {
    AuthService::clear_semester(&app, &store).map_err(Into::into)
}

#[tauri::command]
pub async fn auth_get_semesters(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<Vec<Semester>, String> {
    RemoteDefaultSemesterStrategy::fetch_remote_semesters(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn auth_auto_relogin(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<AuthTokens, String> {
    AuthService::perform_auto_relogin(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub fn auth_keyring_set(username: String, password: String) -> Result<(), String> {
    keyring::set_password(&username, &password)
}

#[tauri::command]
pub fn auth_keyring_get(username: String) -> Result<Option<String>, String> {
    match keyring::get_password_with_retry(&username) {
        Ok(pwd) => Ok(Some(pwd)),
        Err(e) if keyring::is_missing_entry_error(&e) => Ok(None),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn auth_keyring_delete(username: String) -> Result<bool, String> {
    match keyring::delete_password(&username) {
        Ok(_) => Ok(true),
        Err(e) if keyring::is_missing_entry_error(&e) => Ok(false),
        Err(e) => Err(e),
    }
}
