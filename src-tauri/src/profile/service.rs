use chrono::Utc;
use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;
use crate::profile::parser::parse_student_profile;
use crate::profile::types::ProfileResponse;

pub struct ProfileService;

impl ProfileService {
    pub async fn get_student_profile(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<ProfileResponse, BackendError> {
        let parsed = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let nocache = format!("@{}", Utc::now().timestamp_millis());
                VtopRequestFactory::create_form_request(
                    "/vtop/studentsRecord/StudentProfileAllView",
                    vec![
                        ("verifyMenu", "true".to_string()),
                        ("nocache", nocache),
                    ],
                    tokens,
                )
            },
            |html| parse_student_profile(html),
        )
        .await?;

        Ok(ProfileResponse {
            success: true,
            data: Some(parsed),
            error: None,
        })
    }
}
