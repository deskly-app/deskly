use reqwest::StatusCode;
use tauri::AppHandle;

use crate::auth::store::AuthStore;
use crate::auth::types::AuthTokens;
use crate::core::adapter::VtopPayloadAdapter;
use crate::core::client::factory::{HttpClientFactory, VtopRequest};
use crate::core::error::BackendError;

pub enum VtopResponse {
    Text(String),
    Binary {
        filename: String,
        bytes: Vec<u8>,
    },
}

impl VtopResponse {
    pub fn into_text(self) -> Result<String, BackendError> {
        match self {
            VtopResponse::Text(s) => Ok(s),
            VtopResponse::Binary { .. } => Err(BackendError::ParseError(
                "Expected text response but received binary".to_string(),
            )),
        }
    }

    pub fn into_binary(self) -> Result<(String, Vec<u8>), BackendError> {
        match self {
            VtopResponse::Binary { filename, bytes } => Ok((filename, bytes)),
            VtopResponse::Text(_) => Err(BackendError::ParseError(
                "Expected binary response but received text".to_string(),
            )),
        }
    }
}

/// Executor trait defining the execution of a VTOP request.
#[allow(async_fn_in_trait)]
pub trait VtopExecutor: Send + Sync {
    async fn execute(&self, request: &VtopRequest) -> Result<VtopResponse, BackendError>;
}

/// Base HTTP executor that performs raw HTTP calls using reqwest.
pub struct BaseHttpExecutor {
    client: reqwest::Client,
}

impl BaseHttpExecutor {
    pub fn new() -> Result<Self, BackendError> {
        Ok(Self {
            client: HttpClientFactory::create_client()?,
        })
    }
}

impl VtopExecutor for BaseHttpExecutor {
    async fn execute(&self, request: &VtopRequest) -> Result<VtopResponse, BackendError> {
        match request {
            VtopRequest::Form {
                url,
                headers,
                form_params,
            } => {
                let mut req = self.client.post(url);
                for (k, v) in headers {
                    req = req.header(*k, v.as_str());
                }
                let resp = req
                    .form(form_params)
                    .send()
                    .await
                    .map_err(|e| BackendError::Network(e.to_string()))?;

                let status = resp.status();
                if matches!(
                    status,
                    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::NOT_FOUND
                ) {
                    return Err(BackendError::SessionExpired(format!(
                        "HTTP {}",
                        status.as_u16()
                    )));
                }

                let text = resp
                    .text()
                    .await
                    .map_err(|e| BackendError::Network(e.to_string()))?;

                Ok(VtopResponse::Text(text))
            }
            VtopRequest::Multipart {
                url,
                headers,
                fields,
            } => {
                let mut req = self.client.post(url);
                for (k, v) in headers {
                    req = req.header(*k, v.as_str());
                }
                let mut form = reqwest::multipart::Form::new();
                for (k, v) in fields {
                    form = form.text(k.clone(), v.clone());
                }
                let resp = req
                    .multipart(form)
                    .send()
                    .await
                    .map_err(|e| BackendError::Network(e.to_string()))?;

                let status = resp.status();
                if matches!(
                    status,
                    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::NOT_FOUND
                ) {
                    return Err(BackendError::SessionExpired(format!(
                        "HTTP {}",
                        status.as_u16()
                    )));
                }

                let text = resp
                    .text()
                    .await
                    .map_err(|e| BackendError::Network(e.to_string()))?;

                Ok(VtopResponse::Text(text))
            }
            VtopRequest::Download {
                url,
                headers,
                form_params,
                fallback_filename,
            } => {
                let mut req = self.client.post(url);
                for (k, v) in headers {
                    req = req.header(*k, v.as_str());
                }
                let resp = req
                    .form(form_params)
                    .send()
                    .await
                    .map_err(|e| BackendError::Network(e.to_string()))?;

                let status = resp.status();
                if matches!(
                    status,
                    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::NOT_FOUND
                ) {
                    return Err(BackendError::SessionExpired(format!(
                        "HTTP {}",
                        status.as_u16()
                    )));
                }

                // Check if response is text/html (indicates error or expired session)
                let content_type = resp
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();

                if content_type.contains("text/html") {
                    let text = resp
                        .text()
                        .await
                        .map_err(|e| BackendError::Network(e.to_string()))?;
                    if VtopPayloadAdapter::is_session_expired(&text) {
                        return Err(BackendError::SessionExpired("Session expired".to_string()));
                    }
                    return Err(BackendError::Other(
                        "Expected file download but received HTML response".to_string(),
                    ));
                }

                let filename = resp
                    .headers()
                    .get("content-disposition")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| {
                        if let Some(pos) = s.find("filename=\"") {
                            let start = pos + 10;
                            if let Some(end) = s[start..].find('\"') {
                                return Some(s[start..start + end].to_string());
                            }
                        }
                        None
                    })
                    .unwrap_or_else(|| fallback_filename.clone());

                let bytes = resp
                    .bytes()
                    .await
                    .map_err(|e| BackendError::Network(e.to_string()))?
                    .to_vec();

                Ok(VtopResponse::Binary { filename, bytes })
            }
        }
    }
}

/// Decorator that intercepts session expiration and 401/403 errors,
/// automatically performing re-login and retrying the request.
pub struct AutoReloginRetryDecorator<'a, E: VtopExecutor> {
    inner: E,
    app: &'a AppHandle,
    store: &'a tauri::State<'a, AuthStore>,
}

impl<'a, E: VtopExecutor> AutoReloginRetryDecorator<'a, E> {
    pub fn new(inner: E, app: &'a AppHandle, store: &'a tauri::State<'a, AuthStore>) -> Self {
        Self { inner, app, store }
    }

    /// Executes the request with automatic session retry.
    /// If session expired, performs auto-relogin, rebuilds the request with fresh tokens, and retries.
    pub async fn execute_with_retry<F>(&self, build_req: F) -> Result<VtopResponse, BackendError>
    where
        F: Fn(&AuthTokens) -> VtopRequest,
    {
        let tokens = crate::auth::service::AuthService::get_tokens_from_store(self.store)?;
        let initial_req = build_req(&tokens);

        let result = self.inner.execute(&initial_req).await;

        let needs_retry = match &result {
            Err(BackendError::SessionExpired(_)) => true,
            Ok(VtopResponse::Text(html)) => VtopPayloadAdapter::is_session_expired(html),
            _ => false,
        };

        if needs_retry {
            eprintln!("[decorator] Session expired detected. Triggering auto-relogin...");
            let fresh_tokens =
                crate::auth::service::AuthService::perform_auto_relogin(self.app, self.store)
                    .await
                    .map_err(|e| {
                        BackendError::AuthFailed(format!("Auto-relogin failed: {}", e))
                    })?;

            let retry_req = build_req(&fresh_tokens);
            let retry_res = self.inner.execute(&retry_req).await?;

            if let VtopResponse::Text(html) = &retry_res {
                if VtopPayloadAdapter::is_session_expired(html) {
                    return Err(BackendError::AuthFailed(
                        "Authentication failed after auto-relogin retry".to_string(),
                    ));
                }
            }

            return Ok(retry_res);
        }

        result
    }
}
