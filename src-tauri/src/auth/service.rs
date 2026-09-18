use reqwest::header::{COOKIE, LOCATION};
use tauri::{AppHandle, State};

use crate::auth::captcha::{decode_data_url_bytes, solve_captcha_from_image_bytes};
use crate::auth::constants::VTOP_BASE_URL;
use crate::auth::http::{
    build_http_client, collect_set_cookies, get_with_redirect_follow, merge_cookies,
    split_cookie_header,
};
use crate::auth::observer::{AuthEvent, AuthSubject};
use crate::auth::parser::{
    classify_login_error, extract_auth_tokens_from_dashboard, extract_captcha_src,
    extract_csrf_from_setup, is_recaptcha_page,
};
use crate::auth::store::{load_from_disk, now_unix_ms, save_to_disk, AuthStore};
use crate::auth::strategies::{
    HybridCredentialStrategy, RemoteDefaultSemesterStrategy,
};
use crate::auth::types::{AuthState, AuthTokens, CredentialStatus, LoginResponse, Semester};
use crate::core::error::BackendError;

fn has_complete_tokens(tokens: &AuthTokens) -> bool {
    !tokens.authorized_id.trim().is_empty()
        && !tokens.csrf.trim().is_empty()
        && !tokens.cookies.trim().is_empty()
}

pub struct AuthService;

impl AuthService {
    /// Low-level HTTP login flow against VTOP portal.
    pub async fn internal_login(username: &str, password: &str) -> Result<AuthTokens, BackendError> {
        let client = build_http_client().map_err(BackendError::Network)?;

        let mut csrf: Option<String> = None;
        let mut session_cookie_header: Option<String> = None;
        let mut captcha_image_bytes: Option<Vec<u8>> = None;

        for attempt in 1..=10 {
            let setup_response = get_with_redirect_follow(
                &client,
                &format!("{VTOP_BASE_URL}/vtop/prelogin/setup"),
                None,
                3,
            )
            .await
            .map_err(|e| BackendError::Network(format!("prelogin setup request failed: {e}")))?;

            let setup_cookies = collect_set_cookies(&setup_response);
            let setup_html = setup_response
                .text()
                .await
                .map_err(|e| BackendError::Network(format!("failed to read prelogin setup page: {e}")))?;

            if setup_html.trim().is_empty() {
                if attempt < 10 {
                    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                    continue;
                }
                return Err(BackendError::Network(
                    "prelogin setup page returned empty body after retries".to_string(),
                ));
            }

            let this_csrf = match extract_csrf_from_setup(&setup_html) {
                Ok(value) => value,
                Err(e) if attempt < 10 => {
                    let _ = e;
                    continue;
                }
                Err(e) => return Err(BackendError::ParseError(e)),
            };

            let cookie_header = merge_cookies(&setup_cookies, &[]);
            let setup_post_response = client
                .post(format!("{VTOP_BASE_URL}/vtop/prelogin/setup"))
                .header(COOKIE, cookie_header.clone())
                .header("content-type", "application/x-www-form-urlencoded")
                .body(format!("_csrf={this_csrf}&flag=VTOP"))
                .send()
                .await
                .map_err(|e| BackendError::Network(format!("prelogin setup post failed: {e}")))?;

            let setup_post_cookies = collect_set_cookies(&setup_post_response);
            let this_session_cookie_header = merge_cookies(&setup_cookies, &setup_post_cookies);

            let login_page = get_with_redirect_follow(
                &client,
                &format!("{VTOP_BASE_URL}/vtop/login"),
                Some(&this_session_cookie_header),
                3,
            )
            .await
            .map_err(|e| BackendError::Network(format!("login page request failed: {e}")))?;

            let login_page_html = login_page
                .text()
                .await
                .map_err(|e| BackendError::Network(format!("failed to read login page: {e}")))?;

            let captcha_src = match extract_captcha_src(&login_page_html) {
                Ok(src) => src,
                Err(image_err) => {
                    if is_recaptcha_page(&login_page_html).map_err(BackendError::ParseError)? {
                        if attempt < 10 {
                            std::thread::sleep(std::time::Duration::from_millis(800));
                            continue;
                        }
                        return Err(BackendError::AuthFailed(
                            "captcha image source not found: page is using reCAPTCHA after retries"
                                .to_string(),
                        ));
                    }

                    if attempt < 10 {
                        std::thread::sleep(std::time::Duration::from_millis(800));
                        continue;
                    }

                    return Err(BackendError::ParseError(image_err));
                }
            };

            let this_captcha_image_bytes = if captcha_src.starts_with("data:image") {
                decode_data_url_bytes(&captcha_src).map_err(BackendError::ParseError)?
            } else {
                let captcha_url = reqwest::Url::parse(VTOP_BASE_URL)
                    .map_err(|e| BackendError::Network(format!("invalid base url: {e}")))?
                    .join(&captcha_src)
                    .map_err(|e| BackendError::Network(format!("invalid captcha url: {e}")))?;

                client
                    .get(captcha_url)
                    .header(COOKIE, this_session_cookie_header.clone())
                    .send()
                    .await
                    .map_err(|e| BackendError::Network(format!("captcha request failed: {e}")))?
                    .bytes()
                    .await
                    .map_err(|e| BackendError::Network(format!("failed to read captcha bytes: {e}")))?
                    .to_vec()
            };

            csrf = Some(this_csrf);
            session_cookie_header = Some(this_session_cookie_header);
            captcha_image_bytes = Some(this_captcha_image_bytes);
            break;
        }

        let csrf = csrf.ok_or_else(|| BackendError::AuthFailed("failed to get csrf for login".to_string()))?;
        let session_cookie_header = session_cookie_header
            .ok_or_else(|| BackendError::AuthFailed("failed to establish session cookies".to_string()))?;
        let captcha_image_bytes = captcha_image_bytes
            .ok_or_else(|| BackendError::AuthFailed("failed to fetch image captcha".to_string()))?;

        let captcha_text = solve_captcha_from_image_bytes(&captcha_image_bytes)
            .map_err(BackendError::ParseError)?;

        let login_form = format!(
            "_csrf={}&username={}&password={}&captchaStr={}",
            urlencoding::encode(&csrf),
            urlencoding::encode(username.trim()),
            urlencoding::encode(password.trim()),
            urlencoding::encode(&captcha_text)
        );

        let login_response = client
            .post(format!("{VTOP_BASE_URL}/vtop/login"))
            .header(COOKIE, session_cookie_header.clone())
            .header("content-type", "application/x-www-form-urlencoded")
            .body(login_form)
            .send()
            .await
            .map_err(|e| BackendError::Network(format!("login request failed: {e}")))?;

        let login_set_cookies = collect_set_cookies(&login_response);
        let all_cookie_header = merge_cookies(
            &split_cookie_header(&session_cookie_header),
            &login_set_cookies,
        );

        let dashboard_response = if login_response.status().is_redirection() {
            let location = login_response
                .headers()
                .get(LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| BackendError::Network("login redirect location missing".to_string()))?;

            let url = reqwest::Url::parse(VTOP_BASE_URL)
                .map_err(|e| BackendError::Network(format!("invalid base url: {e}")))?
                .join(location)
                .map_err(|e| BackendError::Network(format!("invalid redirect url: {e}")))?;

            get_with_redirect_follow(&client, url.as_ref(), Some(&all_cookie_header), 5)
                .await
                .map_err(|e| BackendError::Network(format!("failed to load dashboard after login: {e}")))?
        } else {
            get_with_redirect_follow(
                &client,
                &format!("{VTOP_BASE_URL}/vtop/open/page"),
                Some(&all_cookie_header),
                5,
            )
            .await
            .map_err(|e| BackendError::Network(format!("failed to load open page after login: {e}")))?
        };

        let dashboard_status = dashboard_response.status();
        let dashboard_url = dashboard_response.url().to_string();
        let dashboard_html = dashboard_response
            .text()
            .await
            .map_err(|e| BackendError::Network(format!("failed to read dashboard html: {e}")))?;

        if dashboard_html.trim().is_empty() {
            return Err(BackendError::Network(format!(
                "Login failed: empty dashboard response (status: {}, url: {})",
                dashboard_status, dashboard_url
            )));
        }

        let lowered = dashboard_html.to_lowercase();
        let is_authorized = lowered.contains("authorizedidx") || lowered.contains("authorizedid");
        if !is_authorized {
            if let Some(msg) = classify_login_error(&dashboard_html) {
                return Err(BackendError::AuthFailed(msg));
            }
            return Err(BackendError::AuthFailed(
                "Login failed: not authorized. Please check your credentials.".to_string(),
            ));
        }

        let (new_csrf, authorized_id) = extract_auth_tokens_from_dashboard(&dashboard_html)
            .map_err(BackendError::ParseError)?;

        Ok(AuthTokens {
            authorized_id,
            csrf: new_csrf,
            cookies: all_cookie_header,
        })
    }

    /// User login orchestrator.
    pub async fn login(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        username: String,
        password: String,
    ) -> Result<LoginResponse, BackendError> {
        let username_trimmed = username.trim();
        if username_trimmed.is_empty() {
            return Err(BackendError::InvalidInput("username is required".to_string()));
        }

        let tokens = Self::internal_login(username_trimmed, &password).await?;

        let auth_state = AuthState {
            user_id: username_trimmed.to_string(),
            logged_in: true,
            last_login: now_unix_ms(),
        };

        let encrypted_password = HybridCredentialStrategy::encrypt_password(&password)?;

        {
            let mut guard = store
                .inner
                .lock()
                .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;

            guard.state = Some(auth_state.clone());
            guard.tokens = Some(tokens.clone());
            guard.password_encrypted = Some(encrypted_password);
        }

        // Fetch default semester
        let selected_semester = RemoteDefaultSemesterStrategy::fetch_remote_semesters(app, store)
            .await
            .ok()
            .and_then(|semesters| semesters.first().cloned());

        let mut guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        guard.semester = selected_semester;

        // Notify observers
        let subject = AuthSubject::new();
        subject.notify(
            &AuthEvent::LoggedIn {
                user_id: username_trimmed.to_string(),
                password: Some(password),
            },
            app,
            &guard,
        );

        Ok(LoginResponse {
            state: auth_state,
            tokens,
        })
    }

    /// Logs out current user, clearing session state and saved credentials.
    pub fn logout(app: &AppHandle, store: &State<'_, AuthStore>) -> Result<bool, BackendError> {
        let mut guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;

        let user_id = guard.state.as_ref().map(|s| s.user_id.clone());

        guard.state = None;
        guard.tokens = None;
        guard.semester = None;
        guard.password_encrypted = None;

        let subject = AuthSubject::new();
        subject.notify(&AuthEvent::LoggedOut { user_id }, app, &guard);

        Ok(true)
    }

    /// Automatically logs in using stored credentials (with Keyring fallback and self-repair).
    pub async fn perform_auto_relogin(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<AuthTokens, BackendError> {
        // Singleflight: serialize concurrent auto-relogins so only 1 runs at a time
        let _lock = store.relogin_mutex.lock().await;

        // Double-check if another waiting task already refreshed tokens while we waited for the lock
        if let Ok(existing_tokens) = Self::get_tokens_from_store(store) {
            if has_complete_tokens(&existing_tokens) {
                let guard = store
                    .inner
                    .lock()
                    .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
                if let Some(state) = guard.state.as_ref() {
                    let age_ms = now_unix_ms().saturating_sub(state.last_login);
                    if age_ms < 30_000 {
                        return Ok(existing_tokens);
                    }
                }
            }
        }

        let (user_id, password, should_repair_encrypted) = {
            let guard = store
                .inner
                .lock()
                .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;

            let user_id = guard
                .state
                .as_ref()
                .ok_or_else(|| BackendError::AuthFailed("No active session found for auto-login".to_string()))?
                .user_id
                .clone();

            let (pwd, needs_repair) = HybridCredentialStrategy::recover_password(
                &user_id,
                guard.password_encrypted.as_deref(),
            )?;

            (user_id, pwd, needs_repair)
        };

        let mut tokens: Option<AuthTokens> = None;
        for attempt in 1..=2 {
            let candidate = Self::internal_login(&user_id, &password).await?;
            if has_complete_tokens(&candidate) {
                tokens = Some(candidate);
                break;
            }

            if attempt == 2 {
                return Err(BackendError::AuthFailed(
                    "Auto-login failed after retry: login succeeded but auth tokens were incomplete".to_string(),
                ));
            }
        }

        let tokens = tokens.ok_or_else(|| {
            BackendError::AuthFailed("Auto-login failed: no auth tokens produced after retry".to_string())
        })?;

        let mut guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;

        if should_repair_encrypted {
            if let Ok(enc) = HybridCredentialStrategy::encrypt_password(&password) {
                guard.password_encrypted = Some(enc);
            }
        }

        guard.tokens = Some(tokens.clone());
        if let Some(state) = guard.state.as_mut() {
            state.last_login = now_unix_ms();
        }

        let subject = AuthSubject::new();
        subject.notify(&AuthEvent::TokensRefreshed { tokens: tokens.clone() }, app, &guard);

        Ok(tokens)
    }

    /// Restores persisted session from disk on application startup.
    pub async fn restore_session(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<Option<AuthState>, BackendError> {
        let persisted = load_from_disk(app);

        let (state, tokens_missing) = {
            let mut guard = store
                .inner
                .lock()
                .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
            *guard = persisted;
            (guard.state.clone(), guard.tokens.is_none())
        };

        if state.as_ref().is_some_and(|s| s.logged_in && tokens_missing) {
            match Self::perform_auto_relogin(app, store).await {
                Ok(_) => {}
                Err(BackendError::AuthFailed(_)) => {
                    // Password changed or credentials invalid on VTOP -> wipe credentials and force login screen
                    let mut guard = store
                        .inner
                        .lock()
                        .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
                    guard.state = None;
                    guard.tokens = None;
                    guard.semester = None;
                    guard.password_encrypted = None;
                    let _ = save_to_disk(app, &guard);
                    return Ok(None);
                }
                Err(BackendError::Network(_)) => {
                    // Network timeout or VTOP offline -> KEEP CALM! Do NOT wipe credentials.
                    // Keep the student logged in so they can view cached dashboard data.
                }
                Err(_) => {
                    // Any other transient error -> keep calm, preserve session
                }
            }
        }

        let guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        Ok(guard.state.clone())
    }

    pub fn get_tokens_from_store(store: &State<'_, AuthStore>) -> Result<AuthTokens, BackendError> {
        let guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("Failed to lock auth store".to_string()))?;
        guard
            .tokens
            .clone()
            .ok_or_else(|| BackendError::AuthFailed("No auth tokens found".to_string()))
    }

    pub fn set_tokens(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        tokens: AuthTokens,
    ) -> Result<bool, BackendError> {
        let mut guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        guard.tokens = Some(tokens);
        save_to_disk(app, &guard).map_err(BackendError::StorageError)?;
        Ok(true)
    }

    pub fn clear_tokens(app: &AppHandle, store: &State<'_, AuthStore>) -> Result<bool, BackendError> {
        let mut guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        guard.tokens = None;
        save_to_disk(app, &guard).map_err(BackendError::StorageError)?;
        Ok(true)
    }

    pub fn get_state(store: &State<'_, AuthStore>) -> Result<Option<AuthState>, BackendError> {
        let guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        Ok(guard.state.clone())
    }

    pub fn get_credential_status(
        store: &State<'_, AuthStore>,
    ) -> Result<CredentialStatus, BackendError> {
        let guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        let user_id = guard.state.as_ref().map(|s| s.user_id.clone());
        let has_password_stored = guard
            .password_encrypted
            .as_ref()
            .is_some_and(|p| !p.trim().is_empty());
        Ok(CredentialStatus {
            user_id,
            has_password_stored,
            keyring_error: None,
        })
    }

    pub fn get_semester(store: &State<'_, AuthStore>) -> Result<Option<Semester>, BackendError> {
        let guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        Ok(guard.semester.clone())
    }

    pub fn set_semester(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester: Semester,
    ) -> Result<bool, BackendError> {
        let mut guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        guard.semester = Some(semester);
        save_to_disk(app, &guard).map_err(BackendError::StorageError)?;
        Ok(true)
    }

    pub fn clear_semester(app: &AppHandle, store: &State<'_, AuthStore>) -> Result<bool, BackendError> {
        let mut guard = store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("failed to lock auth store".to_string()))?;
        guard.semester = None;
        save_to_disk(app, &guard).map_err(BackendError::StorageError)?;
        Ok(true)
    }
}
