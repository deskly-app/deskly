use chrono::Utc;
use tauri::{AppHandle, State};

use crate::attendance::parser::extract_semesters_from_html;
use crate::auth::store::AuthStore;
use crate::auth::types::Semester;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;

/// Strategy trait for resolving target semester ID.
#[allow(async_fn_in_trait)]
pub trait SemesterResolutionStrategy: Send + Sync {
    async fn resolve(&self) -> Result<Option<String>, BackendError>;
}

/// Strategy that uses an explicitly requested semester ID (if provided).
pub struct ExplicitSemesterStrategy {
    pub explicit_id: Option<String>,
}

impl ExplicitSemesterStrategy {
    pub fn new(explicit_id: Option<String>) -> Self {
        Self { explicit_id }
    }
}

impl SemesterResolutionStrategy for ExplicitSemesterStrategy {
    async fn resolve(&self) -> Result<Option<String>, BackendError> {
        Ok(self
            .explicit_id
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()))
    }
}

/// Strategy that inspects the currently stored semester in AuthStore.
pub struct StoredSemesterStrategy<'a> {
    pub store: &'a State<'a, AuthStore>,
}

impl<'a> StoredSemesterStrategy<'a> {
    pub fn new(store: &'a State<'a, AuthStore>) -> Self {
        Self { store }
    }
}

impl<'a> SemesterResolutionStrategy for StoredSemesterStrategy<'a> {
    async fn resolve(&self) -> Result<Option<String>, BackendError> {
        let guard = self
            .store
            .inner
            .lock()
            .map_err(|_| BackendError::StorageError("Failed to lock auth store".to_string()))?;
        Ok(guard.semester.as_ref().map(|s| s.id.clone()))
    }
}

/// Strategy that queries VTOP to fetch the default / current active semester.
pub struct RemoteDefaultSemesterStrategy<'a> {
    pub app: &'a AppHandle,
    pub store: &'a State<'a, AuthStore>,
}

impl<'a> RemoteDefaultSemesterStrategy<'a> {
    pub fn new(app: &'a AppHandle, store: &'a State<'a, AuthStore>) -> Self {
        Self { app, store }
    }

    pub async fn fetch_remote_semesters(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<Vec<Semester>, BackendError> {
        VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let nocache = Utc::now().timestamp_millis().to_string();
                VtopRequestFactory::create_form_request(
                    "/vtop/academics/common/StudentTimeTableChn",
                    vec![("verifyMenu", "true".to_string()), ("nocache", nocache)],
                    tokens,
                )
            },
            |html| {
                let parsed = extract_semesters_from_html(html)?;
                Ok(parsed
                    .into_iter()
                    .map(|s| Semester {
                        id: s.id,
                        name: s.name,
                    })
                    .collect())
            },
        )
        .await
    }
}

impl<'a> SemesterResolutionStrategy for RemoteDefaultSemesterStrategy<'a> {
    async fn resolve(&self) -> Result<Option<String>, BackendError> {
        let semesters = Self::fetch_remote_semesters(self.app, self.store).await?;
        Ok(semesters.first().map(|s| s.id.clone()))
    }
}

/// Helper method executing the fallback chain across the strategies:
/// 1. Explicit ID Strategy
/// 2. Stored ID Strategy
/// 3. Remote Default ID Strategy
pub async fn resolve_semester_id(
    explicit_id: Option<String>,
    app: &AppHandle,
    store: &State<'_, AuthStore>,
) -> Result<String, BackendError> {
    if let Some(id) = ExplicitSemesterStrategy::new(explicit_id).resolve().await? {
        return Ok(id);
    }

    if let Some(id) = StoredSemesterStrategy::new(store).resolve().await? {
        return Ok(id);
    }

    RemoteDefaultSemesterStrategy::new(app, store)
        .resolve()
        .await?
        .ok_or_else(|| BackendError::Other("No semester info found".to_string()))
}
