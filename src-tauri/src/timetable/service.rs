use chrono::Utc;
use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::auth::strategies::resolve_semester_id;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;
use crate::timetable::formatter::generate_weekly_schedule;
use crate::timetable::parser::parse_timetable_courses;
use crate::timetable::types::{TimetableResponse, WeeklyScheduleResponse};

pub struct TimetableService;

impl TimetableService {
    pub async fn get_courses(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester_sub_id: Option<String>,
    ) -> Result<TimetableResponse, BackendError> {
        let semester_id = resolve_semester_id(semester_sub_id, app, store).await?;

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/processViewTimeTable",
                    vec![
                        ("semesterSubId", semester_id.clone()),
                        ("x", x_param),
                    ],
                    tokens,
                )
            },
            |html| parse_timetable_courses(html),
        )
        .await?;

        Ok(TimetableResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn get_weekly(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester_sub_id: Option<String>,
    ) -> Result<WeeklyScheduleResponse, BackendError> {
        let semester_id = resolve_semester_id(semester_sub_id, app, store).await?;

        let courses = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/processViewTimeTable",
                    vec![
                        ("semesterSubId", semester_id.clone()),
                        ("x", x_param),
                    ],
                    tokens,
                )
            },
            |html| parse_timetable_courses(html),
        )
        .await?;

        let weekly_schedule = generate_weekly_schedule(&courses);

        Ok(WeeklyScheduleResponse {
            success: true,
            data: Some(weekly_schedule),
            error: None,
        })
    }
}
