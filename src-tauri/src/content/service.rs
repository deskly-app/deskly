use chrono::Utc;
use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::content::parser::{extract_attendance_from_html, extract_cgpa_from_html};
use crate::content::types::{CGPAResponse, ContentResponse};
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;

pub struct ContentService;

impl ContentService {
    pub async fn get_content_page(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<ContentResponse, BackendError> {
        let parsed = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/get/dashboard/current/semester/course/details",
                    vec![("x", x_param)],
                    tokens,
                )
            },
            |html| extract_attendance_from_html(html),
        )
        .await?;

        Ok(ContentResponse {
            success: true,
            courses: Some(parsed.courses),
            semester: Some(parsed.semester),
            error: None,
        })
    }

    pub async fn get_cgpa_page(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<CGPAResponse, BackendError> {
        let parsed = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let x_param = Utc::now().to_rfc2822();
                VtopRequestFactory::create_form_request(
                    "/vtop/get/dashboard/current/cgpa/credits",
                    vec![("x", x_param)],
                    tokens,
                )
            },
            |html| extract_cgpa_from_html(html),
        )
        .await?;

        Ok(CGPAResponse {
            success: true,
            cgpa_data: Some(parsed),
            error: None,
        })
    }
}
