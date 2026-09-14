use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::profile::service::ProfileService;
use crate::profile::types::ProfileResponse;

#[tauri::command]
pub async fn profile_get_student_profile(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<ProfileResponse, String> {
    ProfileService::get_student_profile(&app, &store)
        .await
        .map_err(Into::into)
}
