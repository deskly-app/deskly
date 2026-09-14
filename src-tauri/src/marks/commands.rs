use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::marks::service::MarksService;
use crate::marks::types::MarksResponse;

#[tauri::command]
pub async fn marks_get_student_mark_view(
    app: AppHandle,
    semester_sub_id: Option<String>,
    store: State<'_, AuthStore>,
) -> Result<MarksResponse, String> {
    MarksService::get_student_mark_view(&app, &store, semester_sub_id)
        .await
        .map_err(Into::into)
}
