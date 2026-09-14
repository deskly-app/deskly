use chrono::Utc;
use tauri::{AppHandle, State};

use crate::attendance::parser::{
    extract_semesters_from_html, parse_attendance, parse_attendance_details,
};
use crate::attendance::types::{
    AttendanceDetailResponse, AttendanceResponse, Semester, SemestersResponse,
};
use crate::auth::store::AuthStore;
use crate::auth::strategies::resolve_semester_id;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;

pub struct AttendanceService;

impl AttendanceService {
    pub async fn get_current(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<AttendanceResponse, BackendError> {
        let semester_id = resolve_semester_id(None, app, store).await?;
        let semester_id_for_req = semester_id.clone();

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/processViewStudentAttendance",
                    vec![
                        ("semesterSubId", semester_id_for_req.clone()),
                        ("x", x_param),
                    ],
                    tokens,
                )
            },
            |html| parse_attendance(html),
        )
        .await?;

        Ok(AttendanceResponse {
            success: true,
            data: Some(data),
            semester_id: Some(semester_id),
            error: None,
        })
    }

    pub async fn get_detail(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        class_id: String,
        slot_name: String,
    ) -> Result<AttendanceDetailResponse, BackendError> {
        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/processViewAttendanceDetail",
                    vec![
                        ("classId", class_id.clone()),
                        ("slotName", slot_name.clone()),
                        ("x", x_param),
                    ],
                    tokens,
                )
            },
            |html| parse_attendance_details(html),
        )
        .await?;

        Ok(AttendanceDetailResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn get_semesters(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<SemestersResponse, BackendError> {
        let semesters = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let nocache = Utc::now().timestamp_millis().to_string();
                VtopRequestFactory::create_form_request(
                    "/vtop/academics/common/StudentTimeTableChn",
                    vec![("verifyMenu", "true".to_string()), ("nocache", nocache)],
                    tokens,
                )
            },
            |html| {
                let parsed = extract_semesters_from_html(html)?;
                Ok(parsed
                    .into_iter()
                    .map(|s| Semester {
                        id: s.id,
                        name: s.name,
                    })
                    .collect())
            },
        )
        .await?;

        Ok(SemestersResponse {
            success: true,
            semesters: Some(semesters),
            error: None,
        })
    }
}
