use std::time::Duration;

use crate::auth::types::AuthTokens;
use crate::core::constants::{USER_AGENT, VTOP_BASE_URL};
use crate::core::error::BackendError;

const SECTIGO_INTERMEDIATE: &[u8] = include_bytes!("../../auth/sectigo_intermediate.pem");

/// Factory for creating configured reqwest HTTP clients.
pub struct HttpClientFactory;

impl HttpClientFactory {
    pub fn create_client() -> Result<reqwest::Client, BackendError> {
        let mut builder = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent(USER_AGENT)
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert(
                    reqwest::header::ACCEPT,
                    reqwest::header::HeaderValue::from_static(
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    ),
                );
                headers
            });

        // 100% Secure Fix: Inject the missing VTOP intermediate certificate 
        // directly so the Rust client can bridge the trust chain.
        if let Ok(cert) = reqwest::Certificate::from_pem(SECTIGO_INTERMEDIATE) {
            builder = builder.add_root_certificate(cert);
        }

        builder
            .build()
            .map_err(|e| BackendError::Network(format!("Failed to build HTTP client: {e}")))
    }
}

/// Request definitions created by the VtopRequestFactory.
pub enum VtopRequest {
    Form {
        url: String,
        headers: Vec<(&'static str, String)>,
        form_params: Vec<(String, String)>,
    },
    Multipart {
        url: String,
        headers: Vec<(&'static str, String)>,
        fields: Vec<(String, String)>,
    },
    Download {
        url: String,
        headers: Vec<(&'static str, String)>,
        form_params: Vec<(String, String)>,
        fallback_filename: String,
    },
}

/// Factory for creating standard VTOP requests with auth headers and CSRF tokens.
pub struct VtopRequestFactory;

impl VtopRequestFactory {
    /// Normalizes endpoint path into a full VTOP URL.
    pub fn endpoint_url(endpoint: &str) -> String {
        if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
            endpoint.to_string()
        } else if endpoint.starts_with('/') {
            format!("{VTOP_BASE_URL}{endpoint}")
        } else {
            format!("{VTOP_BASE_URL}/{endpoint}")
        }
    }

    /// Creates an authenticated URL-encoded form request.
    pub fn create_form_request(
        endpoint: &str,
        custom_params: Vec<(&str, String)>,
        tokens: &AuthTokens,
    ) -> VtopRequest {
        let mut form_params = vec![
            ("authorizedID".to_string(), tokens.authorized_id.clone()),
            ("_csrf".to_string(), tokens.csrf.clone()),
        ];
        for (k, v) in custom_params {
            form_params.push((k.to_string(), v));
        }

        VtopRequest::Form {
            url: Self::endpoint_url(endpoint),
            headers: vec![
                ("Cookie", tokens.cookies.clone()),
                ("Content-Type", "application/x-www-form-urlencoded".to_string()),
                ("Referer", format!("{VTOP_BASE_URL}/vtop/content")),
            ],
            form_params,
        }
    }

    /// Creates an authenticated multipart form request.
    pub fn create_multipart_request(
        endpoint: &str,
        custom_fields: Vec<(&str, String)>,
        tokens: &AuthTokens,
    ) -> VtopRequest {
        let mut fields = vec![
            ("authorizedID".to_string(), tokens.authorized_id.clone()),
            ("_csrf".to_string(), tokens.csrf.clone()),
        ];
        for (k, v) in custom_fields {
            fields.push((k.to_string(), v));
        }

        VtopRequest::Multipart {
            url: Self::endpoint_url(endpoint),
            headers: vec![
                ("Cookie", tokens.cookies.clone()),
                ("Referer", format!("{VTOP_BASE_URL}/vtop/content")),
                ("X-Requested-With", "XMLHttpRequest".to_string()),
            ],
            fields,
        }
    }

    /// Creates an authenticated binary download request.
    pub fn create_download_request(
        endpoint: &str,
        custom_params: Vec<(&str, String)>,
        tokens: &AuthTokens,
        fallback_filename: &str,
    ) -> VtopRequest {
        let mut form_params = vec![
            ("authorizedID".to_string(), tokens.authorized_id.clone()),
            ("_csrf".to_string(), tokens.csrf.clone()),
        ];
        for (k, v) in custom_params {
            form_params.push((k.to_string(), v));
        }

        VtopRequest::Download {
            url: Self::endpoint_url(endpoint),
            headers: vec![
                ("Cookie", tokens.cookies.clone()),
                ("Content-Type", "application/x-www-form-urlencoded".to_string()),
                ("Referer", format!("{VTOP_BASE_URL}/vtop/content")),
            ],
            form_params,
            fallback_filename: fallback_filename.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_form_request() {
        let tokens = AuthTokens {
            authorized_id: "AUTH123".to_string(),
            csrf: "CSRF123".to_string(),
            cookies: "session=abc".to_string(),
        };

        let req = VtopRequestFactory::create_form_request(
            "/vtop/test",
            vec![("key", "val".to_string())],
            &tokens,
        );

        match req {
            VtopRequest::Form { url, form_params, .. } => {
                assert_eq!(url, format!("{VTOP_BASE_URL}/vtop/test"));
                assert!(form_params.iter().any(|(k, v)| k == "authorizedID" && v == "AUTH123"));
                assert!(form_params.iter().any(|(k, v)| k == "key" && v == "val"));
            }
            _ => panic!("Expected Form request"),
        }
    }
}
