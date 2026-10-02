use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::auth::strategies::resolve_semester_id;
use crate::core::client::factory::{VtopRequest, VtopRequestFactory};
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;
use crate::od::parser::parse_student_od_details;
use crate::od::types::OdResponse;

pub struct OdService;

impl OdService {
    pub async fn get_student_od_details(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester_sub_id: Option<String>,
    ) -> Result<OdResponse, BackendError> {
        let semester_id = resolve_semester_id(semester_sub_id, app, store).await?;
        let semester_id_for_req = semester_id.clone();
        let semester_id_for_parser = semester_id.clone();

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let mut req = VtopRequestFactory::create_form_request(
                    "/vtop/searchStudentOdDetails",
                    vec![("semesterSubId", semester_id_for_req.clone())],
                    tokens,
                );
                if let VtopRequest::Form { ref mut headers, .. } = req {
                    headers.push(("X-Requested-With", "XMLHttpRequest".to_string()));
                }
                req
            },
            move |html| {
                parse_student_od_details(html, &semester_id_for_parser)
            },
        )
        .await?;

        crate::attendance::widget::sync_od_widget(app, data.total_count as i32);

        Ok(OdResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }
}
