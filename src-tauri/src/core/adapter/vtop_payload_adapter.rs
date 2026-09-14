use serde_json::Value;

pub struct VtopPayloadAdapter;

impl VtopPayloadAdapter {
    /// Adapts raw HTTP response text into clean HTML.
    /// VTOP sometimes returns direct HTML, and other times returns a JSON object
    /// with an embedded "html" field (e.g. `{ "html": "<table>...</table>" }`).
    pub fn adapt_to_html(raw: &str) -> String {
        let trimmed = raw.trim();
        if trimmed.starts_with('{') && trimmed.ends_with('}') {
            if let Ok(json) = serde_json::from_str::<Value>(trimmed) {
                if let Some(html_prop) = json.get("html").and_then(|v| v.as_str()) {
                    return html_prop.to_string();
                }
            }
        }
        raw.to_string()
    }

    /// Checks whether the payload indicates an expired or redirected session.
    pub fn is_session_expired(html: &str) -> bool {
        let lowered = html.to_lowercase();
        (lowered.contains("session expired") && lowered.contains("vtop login"))
            || (lowered.contains("vtop login")
                && !lowered.contains("authorizedid")
                && lowered.contains("captcha"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adapt_raw_html() {
        let raw = "<div>Hello VTOP</div>";
        assert_eq!(VtopPayloadAdapter::adapt_to_html(raw), raw);
    }

    #[test]
    fn test_adapt_json_wrapped_html() {
        let json = r#"{"status": "ok", "html": "<table><tr><td>CGPA</td></tr></table>"}"#;
        assert_eq!(
            VtopPayloadAdapter::adapt_to_html(json),
            "<table><tr><td>CGPA</td></tr></table>"
        );
    }

    #[test]
    fn test_detect_session_expired() {
        let expired_html = "<html>VTOP Login Session Expired</html>";
        assert!(VtopPayloadAdapter::is_session_expired(expired_html));

        let valid_html = "<html>authorizedid=12345</html>";
        assert!(!VtopPayloadAdapter::is_session_expired(valid_html));
    }
}
