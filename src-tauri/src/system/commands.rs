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
struct GitHubReleaseAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<GitHubReleaseAsset>,
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

/// Checks the Android release natively so mobile WebViews do not need direct
/// access to the GitHub API. The APK is intentionally opened for download by
/// the frontend; this command never downloads or installs an update.
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

    let releases = client
        .get("https://api.github.com/repos/deskly-app/deskly/releases?per_page=20")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|error| format!("Could not reach the update service: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Update service returned an error: {error}"))?
        .json::<Vec<GitHubRelease>>()
        .await
        .map_err(|error| format!("Could not read update information: {error}"))?;

    let release = releases
        .into_iter()
        .filter(|release| !release.draft && !release.prerelease)
        .filter_map(|release| {
            let apk_url = release
                .assets
                .iter()
                .find(|asset| asset.name.to_ascii_lowercase().ends_with(".apk"))
                .map(|asset| asset.browser_download_url.clone())?;
            Some((release, apk_url))
        })
        .max_by(|(left, _), (right, _)| {
            update_version_parts(&left.tag_name).cmp(&update_version_parts(&right.tag_name))
        })
        .ok_or_else(|| "No Android APK release is available yet".to_string())?;

    let latest_version = normalize_update_version(&release.0.tag_name);
    if latest_version.is_empty() {
        return Err("The latest Android release has no valid version".to_string());
    }

    Ok(MobileUpdateInfo {
        has_update: is_newer_update_version(&latest_version, &current_version),
        current_version,
        latest_version,
        download_url: release.1,
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
