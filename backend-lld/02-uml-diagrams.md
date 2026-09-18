# 02. UML Diagrams & Object Models

This document specifies the object-oriented and structural models of the Deskly backend using standard UML diagrams implemented in Mermaid.

---

## 1. Complete UML Class Diagram

The following class diagram models the core structs, traits, relationships, and methods across the Deskly backend:

```mermaid
classDiagram
    direction TB

    %% Traits & Interfaces
    class VtopExecutor {
        <<trait>>
        +execute(request: &VtopRequest) Result~VtopResponse, BackendError~*
    }

    class AuthObserver {
        <<trait>>
        +on_auth_event(event: &AuthEvent, app: &AppHandle, auth: &PersistedAuth)*
    }

    class CredentialStrategy {
        <<trait>>
        +recover_password(user_id: &str, encrypted_fallback: Option~&str~) Result~(String, bool), BackendError~*
        +encrypt_password(password: &str) Result~String, BackendError~*
    }

    %% Core Client & Decorator
    class BaseHttpExecutor {
        -client: reqwest::Client
        +new() Result~Self, BackendError~
        +execute(request: &VtopRequest) Result~VtopResponse, BackendError~
    }

    class AutoReloginRetryDecorator {
        -inner: E
        -app: &AppHandle
        -store: &State~AuthStore~
        +new(inner: E, app: &AppHandle, store: &State~AuthStore~) Self
        +execute_with_retry(build_req: F) Result~VtopResponse, BackendError~
    }

    class HttpClientFactory {
        <<singleton>>
        -SHARED_CLIENT: Lazy~Result~Client, String~~$
        +create_client() Result~Client, BackendError~$
    }

    class VtopRequestFactory {
        <<factory>>
        +endpoint_url(endpoint: &str) String$
        +create_form_request(endpoint: &str, custom_params: Vec, tokens: &AuthTokens) VtopRequest$
        +create_multipart_request(endpoint: &str, fields: Vec, tokens: &AuthTokens) VtopRequest$
        +create_download_request(endpoint: &str, custom_params: Vec, tokens: &AuthTokens, fallback: String) VtopRequest$
    }

    class VtopRequest {
        <<enumeration>>
        Form(url, headers, form_params)
        Multipart(url, headers, fields)
        Download(url, headers, form_params, fallback_filename)
    }

    class VtopResponse {
        <<enumeration>>
        Text(String)
        Binary(filename, bytes)
        +into_text() Result~String, BackendError~
        +into_binary() Result~(String, Vec~u8~), BackendError~
    }

    class VtopPayloadAdapter {
        <<adapter>>
        +is_session_expired(html: &str) bool$
        +extract_csrf(html: &str) Option~String~$
        +extract_authorized_id(html: &str) Option~String~$
        +has_captcha_error(html: &str) bool$
    }

    %% Auth & State Store
    class AuthStore {
        +inner: std::sync::Mutex~PersistedAuth~
        +relogin_mutex: tokio::sync::Mutex~()~
        +new(initial: PersistedAuth) Self
    }

    class PersistedAuth {
        +state: Option~AuthState~
        +tokens: Option~AuthTokens~
        +semester: Option~SemesterInfo~
        +password_encrypted: Option~String~
    }

    class AuthTokens {
        +csrf: String
        +authorized_id: String
        +cookies: String
        +is_complete() bool
    }

    class AuthState {
        +user_id: String
        +logged_in: bool
        +last_login: i64
    }

    class AuthService {
        <<service>>
        +login(app: &AppHandle, store: &State~AuthStore~, credentials) Result~AuthState, BackendError~$
        +perform_auto_relogin(app: &AppHandle, store: &State~AuthStore~) Result~AuthTokens, BackendError~$
        +get_tokens_from_store(store: &State~AuthStore~) Result~AuthTokens, BackendError~$
        +restore_session(app: &AppHandle, store: &State~AuthStore~) Result~Option~AuthState~, BackendError~$
        +logout(app: &AppHandle, store: &State~AuthStore~) Result~bool, BackendError~$
    }

    class AuthSubject {
        -observers: Vec~Box~dyn AuthObserver~~
        +new() Self
        +register(observer: Box~dyn AuthObserver~)
        +notify(event: &AuthEvent, app: &AppHandle, auth: &PersistedAuth)
    }

    class DiskPersistenceObserver {
        +on_auth_event(event: &AuthEvent, app: &AppHandle, auth: &PersistedAuth)
    }

    class HybridCredentialStrategy {
        +recover_password(user_id: &str, encrypted_fallback: Option~&str~) Result~(String, bool), BackendError~$
        +encrypt_password(password: &str) Result~String, BackendError~$
    }

    %% Domain Service Example
    class AttendanceService {
        <<service>>
        +get_attendance(app: &AppHandle, store: &State~AuthStore~, semester_id: Option~String~) Result~AttendanceResponse, BackendError~$
    }

    %% Relationships & Realizations
    VtopExecutor <|.. BaseHttpExecutor : implements
    VtopExecutor <|.. AutoReloginRetryDecorator : wraps/delegates
    AutoReloginRetryDecorator *-- BaseHttpExecutor : contains inner
    AutoReloginRetryDecorator ..> AuthService : invokes perform_auto_relogin
    AutoReloginRetryDecorator ..> VtopPayloadAdapter : checks session expiry
    BaseHttpExecutor ..> HttpClientFactory : obtains pooled client
    BaseHttpExecutor ..> VtopRequest : consumes
    BaseHttpExecutor ..> VtopResponse : produces

    AuthStore *-- PersistedAuth : contains
    PersistedAuth *-- AuthTokens : contains
    PersistedAuth *-- AuthState : contains

    AuthService ..> AuthStore : reads & updates
    AuthService ..> HybridCredentialStrategy : retrieves credentials
    AuthService ..> AuthSubject : emits lifecycle events

    AuthObserver <|.. DiskPersistenceObserver : implements
    AuthSubject o-- AuthObserver : manages subscribers

    AttendanceService ..> AutoReloginRetryDecorator : uses for requests
    AttendanceService ..> VtopRequestFactory : builds requests
```

---

## 2. Module & Package Architecture Diagram

The backend divides concerns into clear, bounded contexts:

```mermaid
graph TD
    subgraph IPC_Layer["src-tauri/src/*/commands.rs"]
        AuthCmd["auth::commands"]
        AttCmd["attendance::commands"]
        TtCmd["timetable::commands"]
        GradeCmd["grades::commands"]
    end

    subgraph Domain_Layer["src-tauri/src/*/{service,parser,types}.rs"]
        AuthSvc["auth::service::AuthService"]
        AttSvc["attendance::service::AttendanceService"]
        TtSvc["timetable::service::TimetableService"]
        GradeSvc["grades::service::GradesService"]
    end

    subgraph Core_Client_Layer["src-tauri/src/core/client/*"]
        Decorator["AutoReloginRetryDecorator"]
        Executor["BaseHttpExecutor"]
        ReqFact["VtopRequestFactory"]
        ClientFact["HttpClientFactory"]
    end

    subgraph Core_Adapter_Layer["src-tauri/src/core/adapter/*"]
        PayloadAdapter["VtopPayloadAdapter"]
    end

    subgraph Security_Storage_Layer["src-tauri/src/auth/{store,strategies,observer}/*"]
        AuthStore["AuthStore (State)"]
        CredStrat["HybridCredentialStrategy"]
        Observer["AuthSubject & Observers"]
    end

    AuthCmd --> AuthSvc
    AttCmd --> AttSvc
    TtCmd --> TtSvc
    GradeCmd --> GradeSvc

    AttSvc --> Decorator
    TtSvc --> Decorator
    GradeSvc --> Decorator
    AttSvc --> ReqFact
    TtSvc --> ReqFact
    GradeSvc --> ReqFact

    Decorator --> Executor
    Decorator --> AuthSvc
    Decorator --> PayloadAdapter
    Executor --> ClientFact
    AuthSvc --> AuthStore
    AuthSvc --> CredStrat
    AuthSvc --> Observer
```

---

## 3. Sequence Diagram: Transparent Auto-Relogin

The sequence below illustrates what happens when a protected resource fetch encounters an expired session:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as React Dashboard
    participant IPC as Attendance Command
    participant Decorator as AutoReloginRetryDecorator
    participant Executor as BaseHttpExecutor
    participant VTOP as Upstream VTOP Portal
    participant AuthService as AuthService
    participant Mutex as AuthStore::relogin_mutex
    participant Store as AuthStore::inner

    User->>UI: Opens Dashboard
    UI->>IPC: invoke('get_attendance', { semester_id: 'WS2025' })
    IPC->>Decorator: execute_with_retry(build_attendance_req)

    Decorator->>Executor: execute(initial_attendance_request)
    Executor->>VTOP: POST /vtop/processViewAttendance (Expired Session Cookie)
    VTOP-->>Executor: HTTP 200 OK with HTML containing "Session Expired"
    Executor-->>Decorator: VtopResponse::Text(html)

    Decorator->>Decorator: VtopPayloadAdapter::is_session_expired(html) == true
    Note over Decorator: Expiration detected! Initiating transparent recovery.

    Decorator->>AuthService: perform_auto_relogin(app, store)
    AuthService->>Mutex: lock().await (Acquires Singleflight Mutex)

    AuthService->>Store: get_tokens_from_store() & check last_login age
    Note over AuthService: Tokens are stale (> 30s) -> proceed to re-login

    AuthService->>VTOP: POST /vtop/doLogin (with saved credentials)
    VTOP-->>AuthService: HTTP 302 / Set-Cookie (Fresh cookies, CSRF, authorizedID)

    AuthService->>Store: lock() -> update tokens and set last_login = now_unix_ms()
    AuthService-->>Decorator: Returns fresh AuthTokens
    Note over AuthService: Mutex is automatically released when _lock falls out of scope

    Decorator->>Decorator: build_req(&fresh_tokens) (Rebuilds request with new headers)
    Decorator->>Executor: execute(retried_attendance_request)
    Executor->>VTOP: POST /vtop/processViewAttendance (Valid Session Cookie)
    VTOP-->>Executor: HTTP 200 OK with valid Attendance Table HTML
    Executor-->>Decorator: VtopResponse::Text(valid_html)

    Decorator-->>IPC: Ok(VtopResponse)
    IPC->>IPC: parse_attendance_html(valid_html)
    IPC-->>UI: Return Attendance JSON (Success)
    UI-->>User: Renders Attendance Graph & Course Cards
```

---

## 4. State Machine Diagram: Authentication Session Lifecycle

This diagram documents the lifecycle states of a user session in Deskly:

```mermaid
stateDiagram-v2
    [*] --> LoggedOut: Application Startup (no saved session)
    [*] --> SessionRestoration: Startup with saved credentials in auth_state.json

    state SessionRestoration {
        [*] --> RecoveringCredentials
        RecoveringCredentials --> AutoLoggingIn: Password recovered from Keyring/AES
        AutoLoggingIn --> SessionActive: VTOP 200 OK with Tokens
        AutoLoggingIn --> WipingInvalidCredentials: VTOP 401 / Invalid Password
        WipingInvalidCredentials --> [*]
    }

    WipingInvalidCredentials --> LoggedOut
    SessionRestoration --> SessionActive: Restored successfully

    LoggedOut --> ManualAuthenticating: User submits Registration No + Password + Captcha
    ManualAuthenticating --> SessionActive: Credentials & Captcha Valid
    ManualAuthenticating --> LoggedOut: Bad Captcha or Invalid Credentials

    state SessionActive {
        [*] --> Idle
        Idle --> ExecutingRequests: UI triggers fetch
        ExecutingRequests --> Idle: Success (HTTP 200)
    }

    SessionActive --> AutoReauthenticating: Request receives SessionExpired / 401
    state AutoReauthenticating {
        [*] --> WaitingForSingleflightMutex
        WaitingForSingleflightMutex --> CheckingTokenFreshness: Lock acquired
        CheckingTokenFreshness --> ReusingExistingToken: Token age < 30s
        CheckingTokenFreshness --> PerformingRemoteLogin: Token age >= 30s
        PerformingRemoteLogin --> TokenStorageUpdated: New Cookies & CSRF saved
        TokenStorageUpdated --> [*]
        ReusingExistingToken --> [*]
    }

    AutoReauthenticating --> SessionActive: Request replayed with fresh token
    AutoReauthenticating --> LoggedOut: Credentials rejected by VTOP (wipes state)

    SessionActive --> LoggedOut: User clicks Logout
```
