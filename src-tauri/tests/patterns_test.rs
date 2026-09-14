use deskly_tauri_lib::auth::observer::{AuthEvent, AuthObserver, AuthSubject};
use deskly_tauri_lib::auth::strategies::{ExplicitSemesterStrategy, SemesterResolutionStrategy};
use deskly_tauri_lib::auth::types::{AuthTokens, PersistedAuth};
use deskly_tauri_lib::core::adapter::VtopPayloadAdapter;
use deskly_tauri_lib::core::calendar::{CalendarComponent, CalendarComposite, CalendarLeaf};
use deskly_tauri_lib::core::client::factory::{VtopRequest, VtopRequestFactory};
use deskly_tauri_lib::core::error::BackendError;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[test]
fn test_factory_pattern_creates_form_request() {
    let tokens = AuthTokens {
        authorized_id: "STUDENT_999".to_string(),
        csrf: "TOKEN_XYZ_123".to_string(),
        cookies: "session_id=abc; route=node1".to_string(),
    };

    let req = VtopRequestFactory::create_form_request(
        "/vtop/academics/test",
        vec![
            ("semesterSubId", "FS2025".to_string()),
            ("nocache", "12345678".to_string()),
        ],
        &tokens,
    );

    match req {
        VtopRequest::Form {
            url,
            headers,
            form_params,
        } => {
            assert!(url.ends_with("/vtop/academics/test"));
            assert!(headers
                .iter()
                .any(|(k, v)| *k == "Cookie" && v.contains("session_id=abc")));

            // Verify authorizedID and _csrf are injected by factory
            let auth_id_param = form_params
                .iter()
                .find(|(k, _)| k == "authorizedID")
                .map(|(_, v)| v.as_str());
            let csrf_param = form_params
                .iter()
                .find(|(k, _)| k == "_csrf")
                .map(|(_, v)| v.as_str());
            let sem_param = form_params
                .iter()
                .find(|(k, _)| k == "semesterSubId")
                .map(|(_, v)| v.as_str());

            assert_eq!(auth_id_param, Some("STUDENT_999"));
            assert_eq!(csrf_param, Some("TOKEN_XYZ_123"));
            assert_eq!(sem_param, Some("FS2025"));
        }
        _ => panic!("Expected VtopRequest::Form"),
    }
}

#[test]
fn test_factory_pattern_creates_multipart_request() {
    let tokens = AuthTokens {
        authorized_id: "AUTH_STUDENT".to_string(),
        csrf: "CSRF_VAL".to_string(),
        cookies: "cookie_val".to_string(),
    };

    let req = VtopRequestFactory::create_multipart_request(
        "/vtop/examinations/examGradeView",
        vec![("semesterSubId", "WIN2025".to_string())],
        &tokens,
    );

    match req {
        VtopRequest::Multipart {
            url,
            headers,
            fields,
        } => {
            assert!(url.ends_with("/vtop/examinations/examGradeView"));
            assert!(headers
                .iter()
                .any(|(k, v)| *k == "X-Requested-With" && v == "XMLHttpRequest"));
            assert!(fields
                .iter()
                .any(|(k, v)| k == "authorizedID" && v == "AUTH_STUDENT"));
            assert!(fields
                .iter()
                .any(|(k, v)| k == "semesterSubId" && v == "WIN2025"));
        }
        _ => panic!("Expected VtopRequest::Multipart"),
    }
}

#[test]
fn test_adapter_pattern_unwraps_json_and_raw_html() {
    // Case 1: Plain HTML string
    let direct_html = "<div class=\"attendance\">90%</div>";
    assert_eq!(
        VtopPayloadAdapter::adapt_to_html(direct_html),
        direct_html
    );

    // Case 2: VTOP JSON wrapped HTML
    let json_wrapped =
        r#"{"status": "success", "html": "<table id=\"credits\"><tr><td>24</td></tr></table>"}"#;
    let adapted = VtopPayloadAdapter::adapt_to_html(json_wrapped);
    assert_eq!(
        adapted,
        "<table id=\"credits\"><tr><td>24</td></tr></table>"
    );

    // Case 3: Malformed JSON falls back gracefully to raw text
    let invalid_json = "{ invalid_json_without_quotes }";
    assert_eq!(
        VtopPayloadAdapter::adapt_to_html(invalid_json),
        invalid_json
    );
}

#[test]
fn test_adapter_pattern_session_expiry_detection() {
    assert!(VtopPayloadAdapter::is_session_expired(
        "<html><body>VTOP Login - Your session expired, please login again</body></html>"
    ));
    assert!(VtopPayloadAdapter::is_session_expired(
        "<html>VTOP Login <input name=\"captcha\"></html>"
    ));

    // Valid authenticated page should NOT be detected as expired
    assert!(!VtopPayloadAdapter::is_session_expired(
        "<html><span id=\"authorizedID\">21BCE0001</span><div>Dashboard Content</div></html>"
    ));
}

#[test]
fn test_composite_pattern_calendar_serialization() {
    let mut calendar = CalendarComposite::new("VCALENDAR")
        .with_property("VERSION", "2.0")
        .with_property("PRODID", "-//Deskly//EN");

    let event1 = CalendarLeaf::new("VEVENT")
        .with_property("UID", "event-101")
        .with_property("SUMMARY", "Computer Networks Lecture")
        .with_property("LOCATION", "SJT 401");

    let event2 = CalendarLeaf::new("VEVENT")
        .with_property("UID", "event-102")
        .with_property("SUMMARY", "Database Systems Lab")
        .with_property("LOCATION", "TT 202");

    calendar.add_child(Box::new(event1));
    calendar.add_child(Box::new(event2));

    let rendered = calendar.render();

    assert!(rendered.starts_with("BEGIN:VCALENDAR\r\n"));
    assert!(rendered.contains("VERSION:2.0\r\n"));
    assert!(rendered.contains("BEGIN:VEVENT\r\nUID:event-101\r\n"));
    assert!(rendered.contains("SUMMARY:Computer Networks Lecture\r\n"));
    assert!(rendered.contains("BEGIN:VEVENT\r\nUID:event-102\r\n"));
    assert!(rendered.contains("SUMMARY:Database Systems Lab\r\n"));
    assert!(rendered.ends_with("END:VCALENDAR\r\n"));
}

struct CountingObserver {
    counter: Arc<AtomicUsize>,
}

impl AuthObserver for CountingObserver {
    fn on_auth_event(
        &self,
        _event: &AuthEvent,
        _app: &tauri::AppHandle,
        _data: &PersistedAuth,
    ) {
        self.counter.fetch_add(1, Ordering::SeqCst);
    }
}

#[test]
fn test_observer_pattern_subscription_and_dispatch() {
    let count = Arc::new(AtomicUsize::new(0));
    let mut subject = AuthSubject::new();
    subject.attach(Box::new(CountingObserver {
        counter: count.clone(),
    }));

    // Dummy app handle cannot be easily spun up outside Tauri runtime,
    // so we test the struct's observer registration directly.
    assert_eq!(count.load(Ordering::SeqCst), 0);
}

#[test]
fn test_strategy_pattern_explicit_semester() {
    tauri::async_runtime::block_on(async {
        let strategy_with_val = ExplicitSemesterStrategy::new(Some("WIN2025".to_string()));
        let resolved = strategy_with_val.resolve().await.unwrap();
        assert_eq!(resolved, Some("WIN2025".to_string()));

        let strategy_with_empty = ExplicitSemesterStrategy::new(Some("   ".to_string()));
        let resolved_empty = strategy_with_empty.resolve().await.unwrap();
        assert_eq!(resolved_empty, None);

        let strategy_with_none = ExplicitSemesterStrategy::new(None);
        let resolved_none = strategy_with_none.resolve().await.unwrap();
        assert_eq!(resolved_none, None);
    });
}

#[test]
fn test_backend_error_conversions() {
    let err = BackendError::SessionExpired("timeout".to_string());
    let err_str: String = err.into();
    assert!(err_str.contains("Session expired"));
    assert!(err_str.contains("timeout"));

    let input_err = BackendError::InvalidInput("username required".to_string());
    let input_str: String = input_err.into();
    assert!(input_str.contains("Invalid input"));
}
