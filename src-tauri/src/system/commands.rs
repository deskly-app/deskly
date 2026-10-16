use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub fn test_backend(app: tauri::AppHandle) -> String {
    // 1. Official Tauri cross-platform notification API
    let _ = app
        .notification()
        .builder()
        .title("Deskly Test Notification")
        .body("Backend connection active! Hello from the Tauri Rust backend.")
        .show();

    // 2. Linux development-time fallback
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("notify-send")
            .args([
                "Deskly Test Notification",
                "Backend connection active! Hello from the Tauri Rust backend.",
            ])
            .spawn();
    }

    "Backend connection active! Native OS popup notification sent.".to_string()
}

#[tauri::command]
pub fn get_install_format() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();

    #[cfg(target_os = "macos")]
    return "macos".to_string();

    #[cfg(target_os = "linux")]
    {
        if std::env::var("APPIMAGE").is_ok() {
            "appimage".to_string()
        } else {
            "linux-manual".to_string()
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown".to_string();
}

#[derive(Debug, Deserialize)]
struct TauriUpdateManifest {
    version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub has_update: bool,
}

fn normalize_update_version(version: &str) -> String {
    let mut normalized = version.trim();
    if normalized.len() >= 8 && normalized[..8].eq_ignore_ascii_case("android-") {
        normalized = &normalized[8..];
    }
    normalized = normalized.trim_start_matches(|character| character == 'v' || character == 'V');
    normalized.split('-').next().unwrap_or("").to_string()
}

fn update_version_parts(version: &str) -> Vec<u64> {
    normalize_update_version(version)
        .split('.')
        .map(|part| part.parse::<u64>().unwrap_or(0))
        .collect()
}

fn is_newer_update_version(latest: &str, current: &str) -> bool {
    let latest_parts = update_version_parts(latest);
    let current_parts = update_version_parts(current);
    let length = latest_parts.len().max(current_parts.len());

    for index in 0..length {
        let latest_part = latest_parts.get(index).copied().unwrap_or(0);
        let current_part = current_parts.get(index).copied().unwrap_or(0);
        if latest_part > current_part {
            return true;
        }
        if latest_part < current_part {
            return false;
        }
    }

    false
}

/// Checks updates via the official Tauri updater manifest endpoint (latest.json),
/// avoiding GitHub REST API rate limits completely.
#[tauri::command]
pub async fn check_mobile_update(current_version: String) -> Result<MobileUpdateInfo, String> {
    let current_version = if current_version.trim().is_empty() {
        env!("CARGO_PKG_VERSION").to_string()
    } else {
        current_version.trim().to_string()
    };

    let client = reqwest::Client::builder()
        .user_agent(format!("Deskly/{current_version}"))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Failed to prepare update check: {error}"))?;

    // Fetch the native Tauri updater endpoint
    let manifest_url = "https://github.com/deskly-app/deskly/releases/latest/download/latest.json";
    let manifest = client
        .get(manifest_url)
        .send()
        .await
        .map_err(|error| format!("Could not reach update service: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Update service returned an error: {error}"))?
        .json::<TauriUpdateManifest>()
        .await
        .map_err(|error| format!("Could not read update manifest: {error}"))?;

    let latest_version = normalize_update_version(&manifest.version);
    if latest_version.is_empty() {
        return Err("The release manifest has no valid version".to_string());
    }

    let download_url = format!(
        "https://github.com/deskly-app/deskly/releases/download/v{latest_version}/Deskly_{latest_version}_universal.apk"
    );

    Ok(MobileUpdateInfo {
        has_update: is_newer_update_version(&latest_version, &current_version),
        current_version,
        latest_version,
        download_url,
    })
}

#[tauri::command]
pub fn save_calendar_file(
    app: tauri::AppHandle,
    content: String,
    filename: String,
) -> Result<String, String> {
    #[cfg(mobile)]
    {
        use tauri::Manager;
        if let Ok(dir) = app.path().document_dir() {
            let safe_name = std::path::Path::new(&filename)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "calendar.ics".to_string());
            let path = dir.join(&safe_name);
            match std::fs::write(&path, &content) {
                Ok(_) => {
                    let path_str = path.to_string_lossy().to_string();
                    let _ = app
                        .notification()
                        .builder()
                        .title("Calendar Exported")
                        .body(format!("Timetable successfully saved to: {}", safe_name))
                        .show();
                    Ok(path_str)
                }
                Err(e) => Err(format!("Failed to write file: {}", e)),
            }
        } else {
            Err("Document directory not found".to_string())
        }
    }

    #[cfg(desktop)]
    {
        use rfd::FileDialog;

        let path = FileDialog::new()
            .set_file_name(&filename)
            .add_filter("iCalendar", &["ics"])
            .save_file();

        if let Some(path) = path {
            match std::fs::write(&path, &content) {
                Ok(_) => {
                    let saved_path_str = path.to_string_lossy().to_string();

                    // Try to trigger a native notification
                    let _ = app
                        .notification()
                        .builder()
                        .title("Calendar Exported")
                        .body(format!(
                            "Timetable successfully saved to: {}",
                            path.file_name().unwrap_or_default().to_string_lossy()
                        ))
                        .show();

                    // Linux development notification fallback
                    #[cfg(target_os = "linux")]
                    {
                        let _ = std::process::Command::new("notify-send")
                            .args([
                                "Calendar Exported",
                                &format!(
                                    "Timetable successfully saved to: {}",
                                    path.file_name().unwrap_or_default().to_string_lossy()
                                ),
                            ])
                            .spawn();
                    }

                    Ok(saved_path_str)
                }
                Err(e) => Err(format!("Failed to write file: {}", e)),
            }
        } else {
            Err("Save cancelled".to_string())
        }
    }
}
