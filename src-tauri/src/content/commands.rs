use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::content::service::ContentService;
use crate::content::types::{CGPAResponse, ContentResponse};

#[tauri::command]
pub async fn get_content_page(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<ContentResponse, String> {
    ContentService::get_content_page(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_cgpa_page(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<CGPAResponse, String> {
    ContentService::get_cgpa_page(&app, &store)
        .await
        .map_err(Into::into)
}
