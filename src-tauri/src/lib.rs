use tauri::Manager;

pub mod attendance;
pub mod auth;
pub mod content;
pub mod core;
pub mod features;
pub mod feedback;
pub mod grades;
pub mod marks;
pub mod profile;
pub mod system;
pub mod timetable;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // Disable DMA-BUF renderer to prevent EGL_BAD_PARAMETER crashes on NVIDIA/Wayland Linux systems
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let auth_store = auth::init_auth_store(&app.handle());
            app.manage(auth_store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            system::greet,
            system::test_backend,
            system::save_calendar_file,
            system::get_install_format,
            auth::auth_login,
            auth::auth_logout,
            auth::auth_get_state,
            auth::auth_get_credential_status,
            auth::auth_restore_session,
            auth::auth_set_tokens,
            auth::auth_get_tokens,
            auth::auth_clear_tokens,
            auth::auth_get_semester,
            auth::auth_set_semester,
            auth::auth_clear_semester,
            auth::auth_get_semesters,
            auth::auth_auto_relogin,
            auth::auth_keyring_set,
            auth::auth_keyring_get,
            auth::auth_keyring_delete,
            content::get_content_page,
            content::get_cgpa_page,
            attendance::attendance_get_semesters,
            attendance::attendance_get_current,
            attendance::attendance_get_detail,
            marks::marks_get_student_mark_view,
            features::academic_calendar_get,
            features::academic_calendar_get_view,
            features::contact_info_get,
            features::payment_receipts_get,
            features::curriculum_get,
            features::curriculum_get_category_view,
            features::curriculum_download_syllabus,
            features::exam_schedule_get,
            features::hod_dean_details_get,
            timetable::timetable_get_courses,
            timetable::timetable_get_weekly,
            profile::profile_get_student_profile,
            grades::grades_get_history,
            grades::grades_get_student_grade_view,
            feedback::feedback_get_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
