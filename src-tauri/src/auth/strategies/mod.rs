pub mod credential_strategy;
pub mod semester_strategy;

pub use credential_strategy::{CredentialStorageStrategy, HybridCredentialStrategy};
pub use semester_strategy::{
    resolve_semester_id, ExplicitSemesterStrategy, RemoteDefaultSemesterStrategy,
    SemesterResolutionStrategy, StoredSemesterStrategy,
};
