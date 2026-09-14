use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::auth::types::AuthTokens;
use crate::core::adapter::VtopPayloadAdapter;
use crate::core::client::executor::{AutoReloginRetryDecorator, BaseHttpExecutor};
use crate::core::client::factory::VtopRequest;
use crate::core::error::BackendError;

/// Template Method for VTOP queries.
/// Standardizes the pipeline:
/// Request Construction -> Authenticated Execution -> Session Expiration Interception & Auto-Relogin ->
/// Payload Adaptation (raw / JSON-wrapped unwrap) -> Domain Parsing -> Domain Result.
pub struct VtopQueryTemplate;

impl VtopQueryTemplate {
    pub async fn execute_query<ReqBuilder, Parser, T>(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        build_request: ReqBuilder,
        parse_response: Parser,
    ) -> Result<T, BackendError>
    where
        ReqBuilder: Fn(&AuthTokens) -> VtopRequest,
        Parser: FnOnce(&str) -> Result<T, String>,
    {
        let base_executor = BaseHttpExecutor::new()?;
        let decorator = AutoReloginRetryDecorator::new(base_executor, app, store);

        let response = decorator.execute_with_retry(build_request).await?;
        let raw_text = response.into_text()?;

        // Adapter Pattern: normalize JSON-wrapped HTML vs pure HTML
        let html = VtopPayloadAdapter::adapt_to_html(&raw_text);

        parse_response(&html).map_err(BackendError::ParseError)
    }

    pub async fn execute_download<ReqBuilder>(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        build_request: ReqBuilder,
    ) -> Result<(String, Vec<u8>), BackendError>
    where
        ReqBuilder: Fn(&AuthTokens) -> VtopRequest,
    {
        let base_executor = BaseHttpExecutor::new()?;
        let decorator = AutoReloginRetryDecorator::new(base_executor, app, store);

        let response = decorator.execute_with_retry(build_request).await?;
        response.into_binary()
    }
}
