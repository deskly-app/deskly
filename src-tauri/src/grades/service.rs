use chrono::Utc;
use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::auth::strategies::resolve_semester_id;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;
use crate::grades::parser::{parse_semester_grade_view, parse_student_history};
use crate::grades::types::{GradesResponse, SemesterGradeViewResponse};

pub struct GradesService;

impl GradesService {
    pub async fn get_history(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<GradesResponse, BackendError> {
        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let nocache = Utc::now().timestamp_millis().to_string();
                VtopRequestFactory::create_form_request(
                    "/vtop/examinations/examGradeView/StudentGradeHistory",
                    vec![("verifyMenu", "true".to_string()), ("nocache", nocache)],
                    tokens,
                )
            },
            |html| parse_student_history(html),
        )
        .await?;

        Ok(GradesResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn get_student_grade_view(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester_sub_id: Option<String>,
    ) -> Result<SemesterGradeViewResponse, BackendError> {
        let semester_id = resolve_semester_id(semester_sub_id, app, store).await?;
        let semester_id_for_req = semester_id.clone();
        let semester_id_for_parse = semester_id.clone();

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                VtopRequestFactory::create_multipart_request(
                    "/vtop/examinations/examGradeView/doStudentGradeView",
                    vec![("semesterSubId", semester_id_for_req.clone())],
                    tokens,
                )
            },
            move |html| Ok(parse_semester_grade_view(&semester_id_for_parse, html)),
        )
        .await?;

        Ok(SemesterGradeViewResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }
}
