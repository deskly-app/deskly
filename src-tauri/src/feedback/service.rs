use chrono::Utc;
use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::auth::strategies::resolve_semester_id;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;
use crate::feedback::parser::parse_feedback_status;
use crate::feedback::types::FeedbackResponse;

pub struct FeedbackService;

impl FeedbackService {
    pub async fn get_status(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<FeedbackResponse, BackendError> {
        let semester_id = resolve_semester_id(None, app, store).await?;

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/processViewFeedBackStatus",
                    vec![
                        ("semesterSubId", semester_id.clone()),
                        ("x", x_param),
                    ],
                    tokens,
                )
            },
            |html| parse_feedback_status(html),
        )
        .await?;

        Ok(FeedbackResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }
}
