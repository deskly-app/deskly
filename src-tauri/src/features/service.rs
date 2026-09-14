use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Utc;
use tauri::{AppHandle, State};

use crate::auth::store::AuthStore;
use crate::auth::strategies::resolve_semester_id;
use crate::core::client::factory::VtopRequestFactory;
use crate::core::client::template::VtopQueryTemplate;
use crate::core::error::BackendError;
use crate::features::parser::{
    parse_calendar_options, parse_calendar_view, parse_contact_details,
    parse_curriculum_categories, parse_curriculum_courses, parse_exam_schedule,
    parse_hod_dean_details, parse_receipts,
};
use crate::features::types::{
    CalendarOptionsResponse, CalendarViewResponse, ContactResponse, CurriculumCategoriesResponse,
    CurriculumCoursesResponse, ExamScheduleGroup, ExamScheduleResponse, HodDeanResponse,
    ReceiptResponse, SyllabusData, SyllabusResponse,
};

pub struct FeaturesService;

impl FeaturesService {
    pub async fn academic_calendar_get(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<CalendarOptionsResponse, BackendError> {
        let sem_id = resolve_semester_id(None, app, store).await?;

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let mut req = VtopRequestFactory::create_form_request(
                    "/vtop/getDateForSemesterPreview",
                    vec![
                        ("paramReturnId", "getDateForSemesterPreview".to_string()),
                        ("semSubId", sem_id.clone()),
                    ],
                    tokens,
                );
                if let crate::core::client::VtopRequest::Form { ref mut headers, .. } = req {
                    headers.push(("X-Requested-With", "XMLHttpRequest".to_string()));
                }
                req
            },
            |html| parse_calendar_options(html),
        )
        .await?;

        Ok(CalendarOptionsResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn academic_calendar_get_view(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        cal_date: String,
    ) -> Result<CalendarViewResponse, BackendError> {
        let sem_id = resolve_semester_id(None, app, store).await?;

        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let mut req = VtopRequestFactory::create_form_request(
                    "/vtop/processViewCalendar",
                    vec![
                        ("calDate", cal_date.clone()),
                        ("semSubId", sem_id.clone()),
                        ("classGroupId", "COMB".to_string()),
                    ],
                    tokens,
                );
                if let crate::core::client::VtopRequest::Form { ref mut headers, .. } = req {
                    headers.push(("X-Requested-With", "XMLHttpRequest".to_string()));
                }
                req
            },
            |html| parse_calendar_view(html),
        )
        .await?;

        Ok(CalendarViewResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn contact_info_get(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<ContactResponse, BackendError> {
        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let nocache = format!("@{}", Utc::now().timestamp_millis());
                let mut req = VtopRequestFactory::create_form_request(
                    "/vtop/hrms/contactDetails",
                    vec![("verifyMenu", "true".to_string()), ("nocache", nocache)],
                    tokens,
                );
                if let crate::core::client::VtopRequest::Form { ref mut headers, .. } = req {
                    headers.push(("X-Requested-With", "XMLHttpRequest".to_string()));
                    // Override content type to match VTOP expectation
                    for (k, v) in headers.iter_mut() {
                        if *k == "Content-Type" {
                            *v = "application/x-www-form-urlencoded; charset=UTF-8".to_string();
                        }
                    }
                }
                req
            },
            |html| parse_contact_details(html),
        )
        .await?;

        Ok(ContactResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn payment_receipts_get(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<ReceiptResponse, BackendError> {
        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let nocache = format!("@{}", Utc::now().timestamp_millis());
                let mut req = VtopRequestFactory::create_form_request(
                    "/vtop/p2p/getReceiptsApplno",
                    vec![("verifyMenu", "true".to_string()), ("nocache", nocache)],
                    tokens,
                );
                if let crate::core::client::VtopRequest::Form { ref mut headers, .. } = req {
                    headers.push(("X-Requested-With", "XMLHttpRequest".to_string()));
                }
                req
            },
            |html| parse_receipts(html),
        )
        .await?;

        Ok(ReceiptResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn curriculum_get(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<CurriculumCategoriesResponse, BackendError> {
        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let nocache = format!("@{}", Utc::now().timestamp_millis());
                VtopRequestFactory::create_form_request(
                    "/vtop/academics/common/Curriculum",
                    vec![("verifyMenu", "true".to_string()), ("nocache", nocache)],
                    tokens,
                )
            },
            |html| parse_curriculum_categories(html),
        )
        .await?;

        Ok(CurriculumCategoriesResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn curriculum_get_category_view(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        category_id: String,
    ) -> Result<CurriculumCoursesResponse, BackendError> {
        let data = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                let nocache = format!("@{}", Utc::now().timestamp_millis());
                VtopRequestFactory::create_form_request(
                    "/vtop/academics/common/curriculumCategoryView",
                    vec![
                        ("categoryId", category_id.clone()),
                        ("nocache", nocache),
                    ],
                    tokens,
                )
            },
            |html| parse_curriculum_courses(html),
        )
        .await?;

        Ok(CurriculumCoursesResponse {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    pub async fn curriculum_download_syllabus(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        course_code: String,
    ) -> Result<SyllabusResponse, BackendError> {
        let fallback = format!("syllabus_{}.zip", course_code);
        let result = VtopQueryTemplate::execute_download(
            app,
            store,
            move |tokens| {
                VtopRequestFactory::create_download_request(
                    "/vtop/courseSyllabusDownload1",
                    vec![("courseCode", course_code.clone())],
                    tokens,
                    &fallback,
                )
            },
        )
        .await;

        match result {
            Ok((filename, bytes)) => {
                let content_base64 = BASE64.encode(&bytes);
                Ok(SyllabusResponse {
                    success: true,
                    data: Some(SyllabusData {
                        filename,
                        save_path: String::new(),
                        content_base64: Some(content_base64),
                    }),
                    error: None,
                })
            }
            Err(e) => Ok(SyllabusResponse {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }),
        }
    }

    pub async fn exam_schedule_get(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
        semester_sub_id: Option<String>,
    ) -> Result<ExamScheduleResponse, BackendError> {
        let semester_id = resolve_semester_id(semester_sub_id, app, store).await?;

        let result = VtopQueryTemplate::execute_query(
            app,
            store,
            move |tokens| {
                VtopRequestFactory::create_multipart_request(
                    "/vtop/examinations/doSearchExamScheduleForStudent",
                    vec![("semesterSubId", semester_id.clone())],
                    tokens,
                )
            },
            |html| parse_exam_schedule(html),
        )
        .await;

        match result {
            Ok(entries) => {
                let mut grouped: Vec<ExamScheduleGroup> = Vec::new();
                for entry in entries {
                    if let Some(group) = grouped.iter_mut().find(|g| g.exam_type == entry.exam_type) {
                        group.schedules.push(entry);
                    } else {
                        grouped.push(ExamScheduleGroup {
                            exam_type: entry.exam_type.clone(),
                            schedules: vec![entry],
                        });
                    }
                }
                Ok(ExamScheduleResponse {
                    success: true,
                    data: Some(grouped),
                    error: None,
                })
            }
            Err(e) => Ok(ExamScheduleResponse {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }),
        }
    }

    pub async fn hod_dean_details_get(
        app: &AppHandle,
        store: &State<'_, AuthStore>,
    ) -> Result<HodDeanResponse, BackendError> {
        let result = VtopQueryTemplate::execute_query(
            app,
            store,
            |tokens| {
                let mut req = VtopRequestFactory::create_form_request(
                    "/vtop/hrms/viewHodDeanDetails",
                    vec![("verifyMenu", "true".to_string()), ("nocache", "".to_string())],
                    tokens,
                );
                if let crate::core::client::VtopRequest::Form { ref mut headers, .. } = req {
                    headers.push(("X-Requested-With", "XMLHttpRequest".to_string()));
                    for (k, v) in headers.iter_mut() {
                        if *k == "Content-Type" {
                            *v = "application/x-www-form-urlencoded; charset=UTF-8".to_string();
                        }
                    }
                }
                req
            },
            |html| parse_hod_dean_details(html),
        )
        .await;

        match result {
            Ok(data) => Ok(HodDeanResponse {
                success: true,
                data: Some(data),
                error: None,
            }),
            Err(e) => Ok(HodDeanResponse {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }),
        }
    }
}
