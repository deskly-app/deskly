# Features & Utilities Module

This module contains various general utilities and feature-specific components of the Deskly application, including Academic Calendar logs, Mess menu parsers, Laundry schedule tracking, Payment Receipt downloading, Course Syllabus lookup, Exam timetable scheduling, and Administrative CABIN details (HOD/Dean contact info).

## File Structure

- `types.rs`: Struct models representing calendar months/days, mess dishes, laundry bookings, contact profiles, curriculum nodes, syllabus downloads, exams, HODs, and receipt downloads.
- `parser.rs`: Parsers and scrapers for each featured component, converting HTML content from the VTOP system into structures.
- `commands/`:
  - `academic_calendar_get.rs`: Returns a list of month options available for querying.
  - `academic_calendar_get_view.rs`: Queries schedule data for a chosen month option.
  - `contact_info_get.rs`: Scrapes helpline/support email directories.
  - `curriculum_get.rs` & `curriculum_get_category_view.rs`: Obtains overall course categories and catalog lists.
  - `curriculum_download_syllabus.rs`: Handles syllabus download requests, showing a save dialog or default file location.
  - `exam_schedule_get.rs`: Fetches CAT and TEE schedules, rooms, and seat placements.
  - `hod_dean_details_get.rs`: Scrapes the school list to extract profiles, cabin locations, and emails.
  - `laundry_get_schedule.rs`: Reads hostel wash bookings.
  - `mess_get_menu.rs`: Fetches mess food menu calendars.
  - `payment_receipts_get.rs`: Manages fee payment records and receipts.
  - `mod.rs`: Exports commands submodules.
- `mod.rs`: Exports types, parsers, and command submodules.

## Exposed Tauri Commands

All commands are serialized with `camelCase` naming format for seamless JSON consumption on the TypeScript frontend.

### 1. `academic_calendar_get` / `academic_calendar_get_view`
- **Tauri Bindings**: `academic_calendar_get`, `academic_calendar_get_view`
- **Parameters**: 
  - `academic_calendar_get_view`: `date_value: String`
- **Return Types**: `CalendarOptionsResponse`, `CalendarViewResponse`

### 2. `mess_get_menu`
- **Tauri Binding**: `mess_get_menu`
- **Parameters**:
  - `mess_type`: `String` (e.g. "Veg-mens")
- **Return Type**: `MessResponse`

### 3. `laundry_get_schedule`
- **Tauri Binding**: `laundry_get_schedule`
- **Parameters**:
  - `block`: `String`
- **Return Type**: `LaundryResponse`

### 4. `contact_info_get`
- **Tauri Binding**: `contact_info_get`
- **Return Type**: `ContactResponse`

### 5. `payment_receipts_get`
- **Tauri Bindings**: `payment_receipts_get`
- **Return Types**: `ReceiptResponse`

### 6. `curriculum_get` / `curriculum_get_category_view` / `curriculum_download_syllabus`
- **Tauri Bindings**: `curriculum_get`, `curriculum_get_category_view`, `curriculum_download_syllabus`
- **Parameters**:
  - `curriculum_get_category_view`: `category_code: String`
  - `curriculum_download_syllabus`: `course_code: String`, `syllabus_id: String`
- **Return Types**: `CurriculumCategoriesResponse`, `CurriculumCoursesResponse`, `SyllabusResponse`

### 7. `exam_schedule_get`
- **Tauri Binding**: `exam_schedule_get`
- **Description**: Returns exam timetables grouped by exam type (e.g., CAT-1, CAT-2, TEE).
- **Return Type**: `ExamScheduleResponse`

### 8. `hod_dean_details_get`
- **Tauri Binding**: `hod_dean_details_get`
- **Description**: Scrapes list of administrative heads (HODs/Deans).
- **Return Type**: `HodDeanResponse`
