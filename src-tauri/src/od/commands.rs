use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::od::service::OdService;
use crate::od::types::OdResponse;

#[tauri::command]
pub async fn od_get_student_details(
    app: AppHandle,
    semester_sub_id: Option<String>,
    store: State<'_, AuthStore>,
) -> Result<OdResponse, String> {
    OdService::get_student_od_details(&app, &store, semester_sub_id)
        .await
        .map_err(Into::into)
}
