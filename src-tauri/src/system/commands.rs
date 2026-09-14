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
            let path = dir.join(&filename);
            match std::fs::write(&path, &content) {
                Ok(_) => {
                    let path_str = path.to_string_lossy().to_string();
                    let _ = app
                        .notification()
                        .builder()
                        .title("Calendar Exported")
                        .body(format!("Timetable successfully saved to: {}", filename))
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
