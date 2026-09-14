use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::timetable::service::TimetableService;
use crate::timetable::types::{TimetableResponse, WeeklyScheduleResponse};

#[tauri::command]
pub async fn timetable_get_courses(
    app: AppHandle,
    semester_sub_id: Option<String>,
    store: State<'_, AuthStore>,
) -> Result<TimetableResponse, String> {
    TimetableService::get_courses(&app, &store, semester_sub_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn timetable_get_weekly(
    app: AppHandle,
    semester_sub_id: Option<String>,
    store: State<'_, AuthStore>,
) -> Result<WeeklyScheduleResponse, String> {
    TimetableService::get_weekly(&app, &store, semester_sub_id)
        .await
        .map_err(Into::into)
}
