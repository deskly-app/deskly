use tauri::AppHandle;
use crate::attendance::types::AttendanceRecord;

#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WidgetPayload {
    percentage: f64,
    formatted_pct: String,
    attended: i32,
    total: i32,
    status: String,
    updated_at: i64,
}

#[cfg(target_os = "android")]
pub fn sync_attendance_widget(app: &AppHandle, records: &[AttendanceRecord]) {
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

    let payload = WidgetPayload {
        percentage,
        formatted_pct,
        attended: total_attended,
        total: total_classes,
        status: status.to_string(),
        updated_at: now,
    };

    if let Ok(json_str) = serde_json::to_string_pretty(&payload) {
        // Primary path: app_data_dir/widget_attendance.json
        if let Ok(app_dir) = app.path().app_data_dir() {
            let _ = std::fs::create_dir_all(&app_dir);
            let _ = std::fs::write(app_dir.join("widget_attendance.json"), &json_str);
        }

        // Direct sandbox path fallbacks
        for dir in ["/data/user/0/com.deskly.app/files", "/data/data/com.deskly.app/files"] {
            let path = std::path::Path::new(dir);
            if path.exists() {
                let _ = std::fs::write(path.join("widget_attendance.json"), &json_str);
            }
        }
    }
}

#[cfg(not(target_os = "android"))]
pub fn sync_attendance_widget(_app: &AppHandle, _records: &[AttendanceRecord]) {
    // No-op on non-Android platforms
}
