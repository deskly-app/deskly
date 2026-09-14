use chrono::Utc;
use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::auth::strategies::resolve_semester_id;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;
use crate::marks::parser::parse_marks;
use crate::marks::types::MarksResponse;

pub struct MarksService;

impl MarksService {
    pub async fn get_student_mark_view(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester_sub_id: Option<String>,
    ) -> Result<MarksResponse, BackendError> {
        let semester_id = resolve_semester_id(semester_sub_id, app, store).await?;

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/examinations/doStudentMarkView",
                    vec![
                        ("semesterSubId", semester_id.clone()),
                        ("x", x_param),
                    ],
                    tokens,
                )
            },
            |html| parse_marks(html),
        )
        .await?;

        Ok(MarksResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }
}
