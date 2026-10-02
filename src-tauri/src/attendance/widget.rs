use tauri::AppHandle;
use crate::attendance::types::AttendanceRecord;

#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WidgetPayload {
    pub percentage: f64,
    pub formatted_pct: String,
    pub attended: i32,
    pub total: i32,
    #[serde(default)]
    pub od_hours: i32,
    pub status: String,
    pub updated_at: i64,
}

#[cfg(target_os = "android")]
pub fn sync_attendance_widget(app: &AppHandle, records: &[AttendanceRecord], od_hours: Option<i32>) {
    let total_attended: i32 = records.iter().map(|r| r.attended_classes).sum();
    let total_classes: i32 = records.iter().map(|r| r.total_classes).sum();
    let percentage = if total_classes > 0 {
        (total_attended as f64 / total_classes as f64) * 100.0
    } else {
        0.0
    };
    let formatted_pct = format!("{:.1}%", percentage);
    let status = if percentage >= 75.0 { "safe" } else { "warning" };
    let now = chrono::Utc::now().timestamp_millis();

    let existing = read_existing_widget_data(app);
    let final_od_hours = od_hours.unwrap_or_else(|| {
        existing.as_ref().map(|p| p.od_hours).unwrap_or(0)
    });

    let payload = WidgetPayload {
        percentage,
        formatted_pct,
        attended: total_attended,
        total: total_classes,
        od_hours: final_od_hours,
        status: status.to_string(),
        updated_at: now,
    };

    save_widget_data(app, &payload);
}

#[cfg(target_os = "android")]
pub fn sync_od_widget(app: &AppHandle, od_hours: i32) {
    let mut payload = read_existing_widget_data(app).unwrap_or_default();
    payload.od_hours = od_hours;
    payload.updated_at = chrono::Utc::now().timestamp_millis();
    save_widget_data(app, &payload);
}

#[cfg(target_os = "android")]
fn read_existing_widget_data(app: &AppHandle) -> Option<WidgetPayload> {
    if let Ok(app_dir) = app.path().app_data_dir() {
        let path = app_dir.join("widget_attendance.json");
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(payload) = serde_json::from_str::<WidgetPayload>(&data) {
                return Some(payload);
            }
        }
    }
    for dir in ["/data/user/0/com.deskly.app/files", "/data/data/com.deskly.app/files"] {
        let path = std::path::Path::new(dir).join("widget_attendance.json");
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(payload) = serde_json::from_str::<WidgetPayload>(&data) {
                return Some(payload);
            }
        }
    }
    None
}

#[cfg(target_os = "android")]
fn save_widget_data(app: &AppHandle, payload: &WidgetPayload) {
    if let Ok(json_str) = serde_json::to_string_pretty(payload) {
        if let Ok(app_dir) = app.path().app_data_dir() {
            let _ = std::fs::create_dir_all(&app_dir);
            let _ = std::fs::write(app_dir.join("widget_attendance.json"), &json_str);
        }

        for dir in ["/data/user/0/com.deskly.app/files", "/data/data/com.deskly.app/files"] {
            let path = std::path::Path::new(dir);
            if path.exists() {
                let _ = std::fs::write(path.join("widget_attendance.json"), &json_str);
            }
        }
    }
}

#[cfg(not(target_os = "android"))]
pub fn sync_attendance_widget(_app: &AppHandle, _records: &[AttendanceRecord], _od_hours: Option<i32>) {}

#[cfg(not(target_os = "android"))]
pub fn sync_od_widget(_app: &AppHandle, _od_hours: i32) {}
