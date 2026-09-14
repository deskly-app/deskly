use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::feedback::service::FeedbackService;
use crate::feedback::types::FeedbackResponse;

#[tauri::command]
pub async fn feedback_get_status(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<FeedbackResponse, String> {
    FeedbackService::get_status(&app, &store)
        .await
        .map_err(Into::into)
}
