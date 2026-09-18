# 05. Extensibility & Developer Guide

Deskly is architected according to the **Open/Closed Principle (OCP)**: open for extension, but closed for modification. New university features, endpoints, storage mechanisms, and response adapters can be added without altering existing core network engines or authentication pipelines.

---

## 🚀 1. Adding a New VTOP Feature: Step-by-Step Tutorial

This walkthrough illustrates how to add a hypothetical **Hostel Leave Application** or **Internal Marks** feature to Deskly.

### Architectural Blueprint:
```
src-tauri/src/marks/
├── mod.rs          # Module declarations and public exports
├── types.rs        # Strongly typed Rust domain models
├── parser.rs       # HTML scraper isolating VTOP DOM extraction
├── service.rs      # Business logic combining Decorator + RequestFactory
└── commands.rs     # IPC command handlers exposed to React
```

---

### Step 1: Define Domain Models (`marks/types.rs`)

Define pure data structures annotated with Serde for automatic serialization across the Tauri IPC boundary:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseMarks {
    pub course_code: String,
    pub course_title: String,
    pub faculty: String,
    pub cat1_mark: Option<f32>,
    pub cat2_mark: Option<f32>,
    pub da1_mark: Option<f32>,
    pub da2_mark: Option<f32>,
    pub total_marks: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarksResponse {
    pub semester_id: String,
    pub courses: Vec<CourseMarks>,
}
```

---

### Step 2: Implement HTML Parser (`marks/parser.rs`)

Isolate all HTML table navigation inside a pure, synchronous parser function:

```rust
use scraper::{Html, Selector};
use crate::core::error::BackendError;
use super::types::{CourseMarks, MarksResponse};

pub fn parse_marks_html(html: &str, semester_id: &str) -> Result<MarksResponse, BackendError> {
    let document = Html::parse_document(html);
    let row_selector = Selector::parse("table.table-striped tr").map_err(|e| {
        BackendError::ParseError(format!("Failed to parse CSS selector: {e}"))
    })?;

    let mut courses = Vec::new();
    for row in document.select(&row_selector).skip(1) {
        let cols: Vec<String> = row
            .select(&Selector::parse("td").unwrap())
            .map(|td| td.text().collect::<Vec<_>>().join(" ").trim().to_string())
            .collect();

        if cols.len() >= 6 {
            courses.push(CourseMarks {
                course_code: cols[1].clone(),
                course_title: cols[2].clone(),
                faculty: cols[3].clone(),
                cat1_mark: cols[4].parse::<f32>().ok(),
                cat2_mark: cols[5].parse::<f32>().ok(),
                da1_mark: None,
                da2_mark: None,
                total_marks: None,
            });
        }
    }

    Ok(MarksResponse {
        semester_id: semester_id.to_string(),
        courses,
    })
}
```

---

### Step 3: Implement Domain Service (`marks/service.rs`)

Leverage `VtopRequestFactory` and `AutoReloginRetryDecorator` to achieve automatic session management with zero custom retry logic:

```rust
use tauri::{AppHandle, State};
use crate::auth::store::AuthStore;
use crate::core::client::executor::{AutoReloginRetryDecorator, BaseHttpExecutor};
use crate::core::client::factory::VtopRequestFactory;
use crate::core::error::BackendError;
use super::parser::parse_marks_html;
use super::types::MarksResponse;

pub struct MarksService;

impl MarksService {
    pub async fn get_marks(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester_id: &str,
    ) -> Result<MarksResponse, BackendError> {
        // 1. Instantiate the base HTTP executor and wrap it in the retry decorator
        let base_executor = BaseHttpExecutor::new()?;
        let decorator = AutoReloginRetryDecorator::new(base_executor, app, store);

        // 2. Execute request with transparent auto-relogin retry
        let response = decorator
            .execute_with_retry(|tokens| {
                VtopRequestFactory::create_form_request(
                    "vtop/examinations/StudentMarkView",
                    vec![("semesterSubId", semester_id.to_string())],
                    tokens,
                )
            })
            .await?;

        // 3. Extract HTML body and pass to domain parser
        let html = response.into_text()?;
        parse_marks_html(&html, semester_id)
    }
}
```

---

### Step 4: Expose Tauri IPC Command (`marks/commands.rs`)

```rust
use tauri::{AppHandle, State};
use crate::auth::store::AuthStore;
use super::service::MarksService;
use super::types::MarksResponse;

#[tauri::command]
pub async fn get_marks(
    app: AppHandle,
    store: State<'_, AuthStore>,
    semester_id: String,
) -> Result<MarksResponse, String> {
    MarksService::get_marks(&app, &store, &semester_id)
        .await
        .map_err(|e| e.to_string())
}
```

---

### Step 5: Register IPC Command in `main.rs`

Register the new command in `src-tauri/src/main.rs`:

```rust
tauri::Builder::default()
    .manage(init_auth_store(&app_handle))
    .invoke_handler(tauri::generate_handler![
        // Existing commands...
        crate::auth::commands::login,
        crate::attendance::commands::get_attendance,
        // NEW COMMAND ADDED HERE:
        crate::marks::commands::get_marks,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

---

## 🧩 2. Extensibility Checklist

When extending Deskly's backend, verify the following:

- [ ] **No Raw HTTP Calls**: Always execute network calls through `AutoReloginRetryDecorator`.
- [ ] **No Hardcoded URLs**: Use `VtopRequestFactory::endpoint_url` and `core::constants::VTOP_BASE_URL`.
- [ ] **No Sync Mutex Across Await**: Ensure `store.inner.lock()` is dropped before any `.await`.
- [ ] **Use Strong Types**: Model all VTOP responses with typed structs rather than returning untyped `serde_json::Value`.
- [ ] **Sanitize Legacy Errors**: Use `VtopPayloadAdapter` if new endpoints use novel error phrases.
