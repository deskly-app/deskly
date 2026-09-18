# 04. Design Patterns in Deskly Backend

This document details the software design patterns implemented across Deskly’s Rust backend. Each pattern is analyzed with respect to its architectural intent, problem statement, concrete Rust implementation, and system benefits.

---

## Pattern Summary Matrix

| Pattern | Category | Concrete Implementation | File Location |
| :--- | :--- | :--- | :--- |
| **Decorator** | Structural | `AutoReloginRetryDecorator<'a, E: VtopExecutor>` | `src-tauri/src/core/client/executor.rs` |
| **Singleflight / Double-Checked** | Concurrency | `relogin_mutex` + `perform_auto_relogin` | `src-tauri/src/auth/service.rs` |
| **Factory Method** | Creational | `VtopRequestFactory` & `HttpClientFactory` | `src-tauri/src/core/client/factory.rs` |
| **Adapter** | Structural | `VtopPayloadAdapter` | `src-tauri/src/core/adapter/vtop_payload_adapter.rs` |
| **Strategy** | Behavioral | `HybridCredentialStrategy` & `SemesterResolutionStrategy` | `src-tauri/src/auth/strategies/` |
| **Observer** | Behavioral | `AuthSubject` & `AuthObserver` trait | `src-tauri/src/auth/observer/` |
| **Singleton / Flyweight** | Creational | `SHARED_CLIENT: Lazy<Result<reqwest::Client, String>>` | `src-tauri/src/core/client/factory.rs` |

---

## 1. Decorator Pattern: `AutoReloginRetryDecorator`

### Intent
Transparently augment any HTTP executor with automatic session expiration detection, credential re-authentication, and request replay capabilities without modifying the underlying executor or domain services.

### The Problem
VTOP invalidates sessions arbitrarily. Without a decorator, every domain service (`AttendanceService`, `TimetableService`, `GradesService`, etc.) would require duplicate `try-catch-relogin-retry` loops surrounding every single HTTP call.

### Implementation Structure
```rust
pub struct AutoReloginRetryDecorator<'a, E: VtopExecutor> {
    inner: E,
    app: &'a AppHandle,
    store: &'a tauri::State<'a, AuthStore>,
}

impl<'a, E: VtopExecutor> AutoReloginRetryDecorator<'a, E> {
    pub fn new(inner: E, app: &'a AppHandle, store: &'a tauri::State<'a, AuthStore>) -> Self {
        Self { inner, app, store }
    }

    pub async fn execute_with_retry<F>(&self, build_req: F) -> Result<VtopResponse, BackendError>
    where
        F: Fn(&AuthTokens) -> VtopRequest,
    {
        // 1. Fetch current tokens and execute original request
        let tokens = AuthService::get_tokens_from_store(self.store)?;
        let initial_req = build_req(&tokens);
        let result = self.inner.execute(&initial_req).await;

        // 2. Inspect response for expiration (HTTP status or HTML marker)
        let needs_retry = match &result {
            Err(BackendError::SessionExpired(_)) => true,
            Ok(VtopResponse::Text(html)) => VtopPayloadAdapter::is_session_expired(html),
            _ => false,
        };

        // 3. Transparently recover and replay if expired
        if needs_retry {
            let fresh_tokens = AuthService::perform_auto_relogin(self.app, self.store).await?;
            let retry_req = build_req(&fresh_tokens);
            return self.inner.execute(&retry_req).await;
        }

        result
    }
}
```

### Key Benefits:
- **Zero Boilerplate**: Domain services simply supply a closure `|tokens| VtopRequestFactory::create_form_request(...)`.
- **Composability**: Can wrap mock executors in test suites without altering retry semantics.
- **Single Responsibility Principle (SRP)**: Domain services only know how to build requests; the decorator manages transport resilience.

---

## 2. Singleflight Pattern: Concurrency Mutex & Double-Checked Locking

### Intent
Coalesce multiple concurrent requests for the same expensive operation (re-authenticating with VTOP) so that only **one** execution runs at a time, and subsequent callers reuse the fresh result.

### The Problem
When a user visits a multi-widget screen like the Dashboard, up to 5 concurrent requests hit VTOP. If the session expired, all 5 attempt to re-login in parallel, resulting in server-side account lockouts, rate limits, and race conditions.

### Implementation
- **Mutex**: `pub(crate) relogin_mutex: tokio::sync::Mutex<()>` in `AuthStore`.
- **Double-Checked Freshness**: Upon acquiring the lock, tasks verify `now_unix_ms() - state.last_login < 30_000`. If true, the re-login is bypassed, and the cached token is reused instantly.

*(Full architectural and sequence breakdown documented in [03. Singleflight Mutex & Concurrency](./03-singleflight-mutex-and-concurrency.md).)*

---

## 3. Factory Pattern: `VtopRequestFactory` & `HttpClientFactory`

### Intent
Encapsulate the complex instantiation logic of outgoing network requests and client instances into dedicated factories.

### A. `VtopRequestFactory`
VTOP requires identical hidden fields (`authorizedID`, `_csrf`) and specific headers (`Cookie`, `Content-Type`, `Referer`) on every form POST. 

```rust
pub struct VtopRequestFactory;

impl VtopRequestFactory {
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
}
```

### B. `HttpClientFactory`
Instantiates a pre-configured `reqwest::Client` with Keep-Alive connection pooling, redirect suppression, custom user-agents, and tuned connection/read timeouts.

---

## 4. Adapter Pattern: `VtopPayloadAdapter`

### Intent
Convert heterogeneous, legacy server-rendered HTML/Struts responses into clean semantic data signals expected by modern Rust services.

### The Problem
VTOP does not return standard REST JSON. It frequently returns HTTP 200 OK even when requests fail, embedding error strings like `"Session Expired"`, `"Invalid User ID"`, or `"Login again"` deep inside HTML tables.

### Implementation
```rust
pub struct VtopPayloadAdapter;

impl VtopPayloadAdapter {
    pub fn is_session_expired(html: &str) -> bool {
        let lower = html.to_lowercase();
        lower.contains("session timed out")
            || lower.contains("session expired")
            || lower.contains("login again")
            || lower.contains("invalid user session")
            || lower.contains("you have been logged out")
    }

    pub fn extract_csrf(html: &str) -> Option<String> {
        let document = Html::parse_document(html);
        let selector = Selector::parse(r#"input[name="_csrf"]"#).ok()?;
        document.select(&selector).next()?.value().attr("value").map(String::from)
    }
}
```

### Key Benefits:
- Insulates domain services from legacy markup changes.
- Centralizes HTML-based error heuristics in one place.

---

## 5. Strategy Pattern: `HybridCredentialStrategy` & `SemesterResolutionStrategy`

### Intent
Define a family of interchangeable algorithms, allowing Deskly to adapt its credential storage and semester resolution behavior dynamically based on runtime conditions.

### A. `HybridCredentialStrategy`
Enables seamless fallback between hardware keyrings and local AES-256 encryption:
- **Strategy 1 (Primary)**: OS Hardware Keyring (`keyring-rs`). Provides maximum security via OS-level DPAPI / Keychain / Secret Service.
- **Strategy 2 (Secondary)**: Machine-keyed AES-256-GCM local encrypted storage. Activates when keyrings are locked or running in containerized environments.
- **Self-Repairing**: When Strategy 2 succeeds, it dynamically restores Strategy 1 if the OS keyring becomes accessible again.

### B. `SemesterResolutionStrategy`
Resolves which semester data to query:
- Default: Active semester reported by VTOP's dashboard.
- Override: Explicit semester ID selected by the user via the frontend dropdown.

---

## 6. Observer Pattern: `AuthSubject` & `AuthObserver`

### Intent
Maintain loose coupling between the core authentication state machine and side-effect consumers (disk persistence, frontend event emission, telemetry).

### Implementation
```rust
pub trait AuthObserver: Send + Sync {
    fn on_auth_event(&self, event: &AuthEvent, app: &AppHandle, auth: &PersistedAuth);
}

pub struct AuthSubject {
    observers: Vec<Box<dyn AuthObserver>>,
}

impl AuthSubject {
    pub fn new() -> Self {
        Self {
            observers: vec![Box::new(DiskPersistenceObserver)],
        }
    }

    pub fn notify(&self, event: &AuthEvent, app: &AppHandle, auth: &PersistedAuth) {
        for observer in &self.observers {
            observer.on_auth_event(event, app, auth);
        }
    }
}
```

### Key Benefits:
- When a user logs in, logs out, or refreshes tokens, `AuthService` simply emits an `AuthEvent`.
- `DiskPersistenceObserver` handles serializing credentials and tokens to disk.
- Additional observers (e.g. logging, analytics, Tauri event emitters) can be registered without modifying `AuthService`.

---

## 7. Singleton / Flyweight Pattern: `SHARED_CLIENT`

### Intent
Share a single, pooled HTTP connection manager across all threads and asynchronous tasks.

### Implementation
```rust
static SHARED_CLIENT: Lazy<Result<reqwest::Client, String>> = Lazy::new(|| {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(40))
        .pool_max_idle_per_host(5)
        .pool_idle_timeout(Duration::from_secs(90))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(USER_AGENT)
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))
});
```

### Key Benefits:
- **Connection Reuse**: Keeps TCP/TLS sockets warm between sequential requests, reducing latency by 200–400ms per call.
- **Resource Discipline**: Restricts maximum idle sockets (`pool_max_idle_per_host(5)`), preventing descriptor exhaustion on the client machine.
