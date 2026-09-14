use tauri::{AppHandle, State};

use crate::attendance::service::AttendanceService;
use crate::attendance::types::{AttendanceDetailResponse, AttendanceResponse, SemestersResponse};
use crate::auth::store::AuthStore;

#[tauri::command]
pub async fn attendance_get_current(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<AttendanceResponse, String> {
    AttendanceService::get_current(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn attendance_get_detail(
    app: AppHandle,
    class_id: String,
    slot_name: String,
    store: State<'_, AuthStore>,
) -> Result<AttendanceDetailResponse, String> {
    AttendanceService::get_detail(&app, &store, class_id, slot_name)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn attendance_get_semesters(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<SemestersResponse, String> {
    AttendanceService::get_semesters(&app, &store)
        .await
        .map_err(Into::into)
}
