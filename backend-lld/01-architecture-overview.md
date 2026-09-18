# 01. Architecture Overview

Deskly’s backend is structured as a layered, modular asynchronous system in Rust. It serves as an anti-corruption layer and performance accelerator between the modern React frontend and the legacy VTOP academic management portal.

---

## 🏗️ Layered Architecture & Tiers

The backend is decomposed into five distinct architectural layers:

```
+-----------------------------------------------------------------------+
| 1. Presentation & IPC Tier (Tauri Commands)                           |
|    - attendance::commands, auth::commands, timetable::commands, etc. |
|    - Validates IPC inputs, maps Results into JSON/IPC errors          |
+-----------------------------------------------------------------------+
                                  │
                                  ▼
+-----------------------------------------------------------------------+
| 2. Domain Service Tier                                                |
|    - AuthService, AttendanceService, TimetableService, GradesService  |
|    - Encapsulates academic business logic, parsing orchestration,     |
|      and domain workflow assembly                                     |
+-----------------------------------------------------------------------+
                                  │
                                  ▼
+-----------------------------------------------------------------------+
| 3. Core Client & Concurrency Tier (Anti-Corruption Engine)            |
|    - AutoReloginRetryDecorator (Transparent session recovery)         |
|    - BaseHttpExecutor (VtopExecutor trait implementation)             |
|    - VtopRequestFactory (Form, Multipart, Download builder)           |
|    - VtopPayloadAdapter (HTML/XML/JSON normalization & error sensing) |
|    - HttpClientFactory (Pooled reqwest::Client singleton)             |
+-----------------------------------------------------------------------+
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
+-----------------------------------+     +-----------------------------+
| 4. Security & Storage Tier        |     | 5. Upstream Transport Tier  |
|    - AuthStore (In-memory state)  |     |    - Pooled HTTP/1.1 & HTTP/2|
|    - HybridCredentialStrategy     |     |    - Connection Keep-Alive  |
|    - Hardware Keyring / AES-256   |     |    - TLS / Cookie jar       |
|    - AuthSubject / AuthObserver   |     |    - Remote VTOP Gateway    |
+-----------------------------------+     +-----------------------------+
```

---

## 1. Presentation & IPC Tier (`commands.rs`)

Tauri exposes Rust functions to the webview via the `#[tauri::command]` macro. These handlers are lightweight controller functions responsible for:
- Receiving invocations from the frontend with strongly-typed arguments (e.g., `semester_id: String`).
- Extracting managed state using Tauri dependency injection (`store: State<'_, AuthStore>`).
- Invoking the corresponding domain service asynchronously (`AttendanceService::get_attendance(...)`).
- Translating domain errors (`BackendError`) into serializable strings or error structures compatible with TypeScript.

```rust
#[tauri::command]
pub async fn get_attendance(
    app: AppHandle,
    store: State<'_, AuthStore>,
    semester_id: Option<String>,
) -> Result<AttendanceResponse, String> {
    AttendanceService::get_attendance(&app, &store, semester_id)
        .await
        .map_err(|e| e.to_string())
}
```

---

## 2. Domain Service Tier (`service.rs` & `parser.rs`)

Each academic domain (Attendance, Timetable, Grades, Exam Schedule, Course Content, Feedback) is encapsulated within its own module:
- **`service.rs`**: Assembles the exact sequence of HTTP requests required by VTOP. Because VTOP relies on multi-step form submissions, the service creates typed `VtopRequest` objects using `VtopRequestFactory`, passes them to `AutoReloginRetryDecorator`, and feeds raw HTML responses into parsers.
- **`parser.rs`**: Uses the `scraper` crate (CSS selectors and DOM traversal) to extract structured Rust structs from server-rendered HTML tables and hidden input fields.
- **`types.rs`**: Plain Old Data (POD) structs annotated with `serde::Serialize` and `serde::Deserialize`.

---

## 3. Core Client & Concurrency Tier

This layer insulates the rest of the application from the quirks of VTOP's legacy infrastructure:
- **`VtopExecutor` Trait**: Declares a generic contract for executing a `VtopRequest` and returning a `VtopResponse` (either Text or Binary).
- **`BaseHttpExecutor`**: Implements `VtopExecutor` using `reqwest::Client`. Handles HTTP status verification, header mapping, body stream extraction, and binary attachment parsing.
- **`AutoReloginRetryDecorator`**: Wraps any `VtopExecutor`. When an operation fails with `BackendError::SessionExpired` or when the response body contains an HTML session expiration marker, the decorator pauses the call, triggers `AuthService::perform_auto_relogin`, rebuilds the request with fresh session tokens, and retries the request seamlessly.
- **`VtopRequestFactory`**: Generates requests injecting standard cookies (`_csrf`, `authorizedID`, `Cookie`), referer headers, and URL encoding.
- **`VtopPayloadAdapter`**: Scans HTML payloads for legacy session expiration phrases (e.g., `"Session Expired"`, `"Login Again"`, `"Invalid User Session"`).

---

## 4. State Management & Thread Safety

The backend maintains shared, in-memory, thread-safe application state managed by Tauri’s dependency injection container:

```rust
pub struct AuthStore {
    // Synchronous mutex guarding in-memory credentials, tokens, and active semester
    pub(crate) inner: std::sync::Mutex<PersistedAuth>,

    // Asynchronous mutex serializing auto-relogin operations across concurrent tasks
    pub(crate) relogin_mutex: tokio::sync::Mutex<()>,
}
```

### Key Concurrency Rules:
1. **Separation of Mutex Types**:
   - `std::sync::Mutex` (`inner`): Used strictly for short-lived, synchronous read/write access to in-memory state. Locks are never held across `.await` yield points.
   - `tokio::sync::Mutex` (`relogin_mutex`): Used strictly for asynchronous synchronization during network-bound re-login attempts.
2. **Double-Checked Locking**:
   When multiple asynchronous tasks queue up at `relogin_mutex.lock().await`, the winning task logs in and updates the store with a new timestamp. The remaining waiting tasks wake up sequentially, inspect `state.last_login`, determine that the token was refreshed within the last 30 seconds (`age_ms < 30_000`), and immediately return without repeating the network request.

---

## 5. Security & Storage Tier

Deskly employs a defense-in-depth credential management strategy:
- **Primary Storage**: Hardware OS Keyring via the `keyring-rs` crate (Linux Secret Service, macOS Keychain, Windows Credential Manager).
- **Secondary Storage**: Machine-keyed local encrypted file (`auth_state.json`). If the OS keyring is unavailable (e.g. headless Linux sessions or locked keychains), Deskly uses AES-256-GCM encryption with a machine-derived entropy salt.
- **Self-Healing**: If credentials succeed via fallback storage, Deskly automatically attempts to repair and re-populate the hardware keyring for future runs.
- **Wipe on Revocation**: If VTOP rejects credentials with invalid password errors during an automated session restoration, stored credentials are wiped immediately from disk to prevent repeated lockouts.

---

## 6. Error Handling Hierarchy

Deskly utilizes a strongly-typed error enumeration `BackendError` defined in `src-tauri/src/core/error.rs`:

```rust
#[derive(Debug, thiserror::Error)]
pub enum BackendError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Session expired: {0}")]
    SessionExpired(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Internal error: {0}")]
    Other(String),
}
```

### Error Flow:
1. `reqwest` transport failures $\rightarrow$ mapped to `BackendError::Network`.
2. HTTP 401/403/404 or HTML expiration markers $\rightarrow$ mapped to `BackendError::SessionExpired`.
3. Bad credentials or repeated re-login failures $\rightarrow$ mapped to `BackendError::AuthFailed`.
4. HTML scraper missing nodes $\rightarrow$ mapped to `BackendError::ParseError`.
5. Keyring / filesystem I/O errors $\rightarrow$ mapped to `BackendError::StorageError`.
6. IPC Boundary $\rightarrow$ `map_err(|e| e.to_string())` converts `BackendError` into clean error strings for the frontend to handle with toast notifications or redirects.
