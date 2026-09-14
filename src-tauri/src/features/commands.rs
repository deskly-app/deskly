use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::features::service::FeaturesService;
use crate::features::types::{
    CalendarOptionsResponse, CalendarViewResponse, ContactResponse, CurriculumCategoriesResponse,
    CurriculumCoursesResponse, ExamScheduleResponse, HodDeanResponse, ReceiptResponse,
    SyllabusResponse,
};

#[tauri::command]
pub async fn academic_calendar_get(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<CalendarOptionsResponse, String> {
    FeaturesService::academic_calendar_get(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn academic_calendar_get_view(
    app: AppHandle,
    cal_date: String,
    store: State<'_, AuthStore>,
) -> Result<CalendarViewResponse, String> {
    FeaturesService::academic_calendar_get_view(&app, &store, cal_date)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn contact_info_get(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<ContactResponse, String> {
    FeaturesService::contact_info_get(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn payment_receipts_get(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<ReceiptResponse, String> {
    FeaturesService::payment_receipts_get(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn curriculum_get(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<CurriculumCategoriesResponse, String> {
    FeaturesService::curriculum_get(&app, &store)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn curriculum_get_category_view(
    app: AppHandle,
    category_id: String,
    store: State<'_, AuthStore>,
) -> Result<CurriculumCoursesResponse, String> {
    FeaturesService::curriculum_get_category_view(&app, &store, category_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn curriculum_download_syllabus(
    app: AppHandle,
    course_code: String,
    store: State<'_, AuthStore>,
) -> Result<SyllabusResponse, String> {
    FeaturesService::curriculum_download_syllabus(&app, &store, course_code)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn exam_schedule_get(
    app: AppHandle,
    semester_sub_id: Option<String>,
    store: State<'_, AuthStore>,
) -> Result<ExamScheduleResponse, String> {
    FeaturesService::exam_schedule_get(&app, &store, semester_sub_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn hod_dean_details_get(
    app: AppHandle,
    store: State<'_, AuthStore>,
) -> Result<HodDeanResponse, String> {
    FeaturesService::hod_dean_details_get(&app, &store)
        .await
        .map_err(Into::into)
}
