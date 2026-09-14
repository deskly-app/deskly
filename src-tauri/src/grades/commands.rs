use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::grades::service::GradesService;
use crate::grades::types::{GradesResponse, SemesterGradeViewResponse};

#[tauri::command]
pub async fn grades_get_history(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<GradesResponse, String> {
    GradesService::get_history(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn grades_get_student_grade_view(
    app: AppHandle,
    semester_sub_id: Option<String>,
    store: State<'_, AuthStore>,
) -> Result<SemesterGradeViewResponse, String> {
    GradesService::get_student_grade_view(&app, &store, semester_sub_id)
        .await
        .map_err(Into::into)
}
