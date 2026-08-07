use scraper::{ElementRef, Html, Selector};

use super::types::{
    CalendarDay, CalendarMonthOption, ContactDetail, CurriculumCategory, CurriculumCourse,
    ExamScheduleEntry, HodDeanDetail, MonthlySchedule, Receipt,
};

fn clean_text(raw: &str) -> String {
    raw.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn text_of(element: &ElementRef<'_>) -> String {
    clean_text(&element.text().collect::<String>())
}

fn parse_i32(value: &str) -> i32 {
    value.trim().parse::<i32>().unwrap_or(0)
}

fn parse_f64(value: &str) -> f64 {
    value.trim().parse::<f64>().unwrap_or(0.0)
}

pub fn parse_calendar_options(html: &str) -> Result<Vec<CalendarMonthOption>, String> {
    let document = Html::parse_document(html);
    let a_selector = Selector::parse("a").map_err(|_| "Invalid link selector".to_string())?;

    let mut options = Vec::new();
    for a in document.select(&a_selector) {
        let onclick = a.value().attr("onclick").unwrap_or("");
        if onclick.contains("processViewCalendar") {
            let label = text_of(&a);

            // Extract '01-DEC-2025' from javascript:processViewCalendar('01-DEC-2025');
            let date_value = if let Some(start) = onclick.find('\'') {
                let rest = &onclick[start + 1..];
                if let Some(end) = rest.find('\'') {
                    rest[..end].to_string()
                } else {
                    "".to_string()
                }
            } else {
                "".to_string()
            };

            if !label.is_empty() && !date_value.is_empty() {
                options.push(CalendarMonthOption { label, date_value });
            }
        }
    }

    Ok(options)
}

pub fn parse_calendar_view(html: &str) -> Result<MonthlySchedule, String> {
    let document = Html::parse_document(html);

    let month_selector = Selector::parse("h4").map_err(|_| "Invalid month selector".to_string())?;
    let cell_selector = Selector::parse("table.calendar-table tr td")
        .map_err(|_| "Invalid calendar cell selector".to_string())?;
    let span_selector = Selector::parse("span").map_err(|_| "Invalid span selector".to_string())?;

    let month = document
        .select(&month_selector)
        .next()
        .map(|el| text_of(&el))
        .unwrap_or_default();

    let mut days = Vec::new();
    for cell in document.select(&cell_selector) {
        let spans: Vec<_> = cell.select(&span_selector).collect();
        if spans.is_empty() {
            continue;
        }

        let date_text = text_of(&spans[0]);
        if date_text.is_empty() {
            continue;
        }

        let mut content = Vec::new();
        for span in spans.iter().skip(1) {
            let txt = text_of(span);
            if !txt.is_empty() {
                content.push(txt);
            }
        }

        days.push(CalendarDay {
            date: parse_i32(&date_text),
            content,
        });
    }

    Ok(MonthlySchedule { month, days })
}

pub fn parse_contact_details(html: &str) -> Result<Vec<ContactDetail>, String> {
    let document = Html::parse_document(html);
    let card_selector = Selector::parse(".col .card.rounded-3")
        .map_err(|_| "Invalid contact card selector".to_string())?;
    let header_selector = Selector::parse(".card-header strong")
        .map_err(|_| "Invalid contact header selector".to_string())?;
    let p_selector = Selector::parse(".card-body p")
        .map_err(|_| "Invalid contact paragraph selector".to_string())?;
    let email_selector = Selector::parse(".card-body p.text-success")
        .map_err(|_| "Invalid contact email selector".to_string())?;

    let mut contacts = Vec::new();
    for card in document.select(&card_selector) {
        let department = card
            .select(&header_selector)
            .next()
            .map(|el| text_of(&el))
            .unwrap_or_default();
        let description = card
            .select(&p_selector)
            .next()
            .map(|el| text_of(&el))
            .unwrap_or_default();
        let email = card
            .select(&email_selector)
            .next()
            .map(|el| text_of(&el))
            .unwrap_or_default();

        if !department.is_empty() || !email.is_empty() {
            contacts.push(ContactDetail {
                department,
                description,
                email,
            });
        }
    }

    Ok(contacts)
}

pub fn parse_receipts(html: &str) -> Result<Vec<Receipt>, String> {
    let document = Html::parse_document(html);
    let table_selector =
        Selector::parse("table").map_err(|_| "Invalid table selector".to_string())?;
    let row_selector = Selector::parse("tr").map_err(|_| "Invalid row selector".to_string())?;
    let td_selector = Selector::parse("td").map_err(|_| "Invalid td selector".to_string())?;
    let input_selector =
        Selector::parse("input").map_err(|_| "Invalid input selector".to_string())?;
    let button_selector =
        Selector::parse("button").map_err(|_| "Invalid button selector".to_string())?;

    let mut receipts = Vec::new();

    for table in document.select(&table_selector) {
        if !table.text().collect::<String>().contains("RECEIPT NUMBER") {
            continue;
        }

        for row in table.select(&row_selector) {
            let cols: Vec<_> = row.select(&td_selector).collect();
            if cols.len() < 5 {
                continue;
            }

            let receipt_number = text_of(&cols[0]);
            let date = text_of(&cols[1]);
            let amount = parse_f64(&text_of(&cols[2]));
            let campus_code = text_of(&cols[3]);
            if receipt_number.is_empty() {
                continue;
            }

            let mut appl_no = String::new();
            let mut reg_no = String::new();
            for input in cols[4].select(&input_selector) {
                if let Some(name) = input.value().attr("name") {
                    let value = input.value().attr("value").unwrap_or("").to_string();
                    if name == "applno" {
                        appl_no = value.clone();
                    }
                    if name == "regno" {
                        reg_no = value;
                    }
                }
            }

            let mut receipt_id = String::new();
            if let Some(button) = cols[4].select(&button_selector).next() {
                if let Some(onclick) = button.value().attr("onclick") {
                    let needle = "doDuplicateReceipt('";
                    if let Some(start) = onclick.find(needle) {
                        let rest = &onclick[start + needle.len()..];
                        if let Some(end) = rest.find('\'') {
                            receipt_id = rest[..end].to_string();
                        }
                    }
                }
            }

            receipts.push(Receipt {
                receipt_number,
                date,
                amount,
                campus_code,
                receipt_id,
                appl_no,
                reg_no,
            });
        }
    }

    Ok(receipts)
}

pub fn parse_curriculum_categories(html: &str) -> Result<Vec<CurriculumCategory>, String> {
    let document = Html::parse_document(html);
    let card_selector = Selector::parse(".categoty-card")
        .map_err(|_| "Invalid curriculum card selector".to_string())?;
    let code_selector = Selector::parse(".symbol-label > div")
        .map_err(|_| "Invalid curriculum code selector".to_string())?;
    let name_selector = Selector::parse(".col-6 span")
        .map_err(|_| "Invalid curriculum name selector".to_string())?;

    let mut categories = Vec::new();
    for card in document.select(&card_selector) {
        let code = card
            .select(&code_selector)
            .next()
            .map(|el| text_of(&el))
            .unwrap_or_default();
        if code.is_empty() {
            continue;
        }

        let name = card
            .select(&name_selector)
            .next()
            .map(|el| text_of(&el))
            .unwrap_or_default();

        let body_text = text_of(&card);
        let mut credits = 0;
        let mut max_credits = 0;

        if let Some(idx) = body_text.find("Credit:") {
            let slice = &body_text[idx + 7..];
            credits = slice
                .split_whitespace()
                .next()
                .and_then(|v| v.parse::<i32>().ok())
                .unwrap_or(0);
        }
        if let Some(idx) = body_text.find("Max. Credit:") {
            let slice = &body_text[idx + 12..];
            max_credits = slice
                .split_whitespace()
                .next()
                .and_then(|v| v.parse::<i32>().ok())
                .unwrap_or(0);
        }

        categories.push(CurriculumCategory {
            code,
            name,
            credits,
            max_credits,
        });
    }

    Ok(categories)
}

pub fn parse_curriculum_courses(html: &str) -> Result<Vec<CurriculumCourse>, String> {
    let document = Html::parse_document(html);
    let row_selector = Selector::parse("table.example tbody tr")
        .map_err(|_| "Invalid curriculum course row selector".to_string())?;
    let td_selector = Selector::parse("td").map_err(|_| "Invalid td selector".to_string())?;
    let span_selector = Selector::parse("span").map_err(|_| "Invalid span selector".to_string())?;

    let mut rows = Vec::new();
    for row in document.select(&row_selector) {
        let cols: Vec<_> = row.select(&td_selector).collect();
        if cols.len() < 5 {
            continue;
        }

        let code = cols[1]
            .select(&span_selector)
            .next()
            .map(|el| text_of(&el))
            .unwrap_or_else(|| text_of(&cols[1]));

        rows.push(CurriculumCourse {
            serial_no: parse_i32(&text_of(&cols[0])),
            code,
            title: text_of(&cols[2]),
            course_type: text_of(&cols[3]),
            credits: parse_f64(&text_of(&cols[4])),
        });
    }

    Ok(rows)
}

pub fn parse_exam_schedule(html: &str) -> Result<Vec<ExamScheduleEntry>, String> {
    let document = Html::parse_document(html);
    let table_selector = Selector::parse("table.customTable").map_err(|_| "Invalid table selector".to_string())?;
    let tr_selector = Selector::parse("tr").map_err(|_| "Invalid row selector".to_string())?;
    let td_selector = Selector::parse("td").map_err(|_| "Invalid cell selector".to_string())?;

    let table = document
        .select(&table_selector)
        .next()
        .ok_or_else(|| "Could not find exam schedule table".to_string())?;

    let mut entries = Vec::new();
    let mut current_exam_type = "Unknown".to_string();

    for row in table.select(&tr_selector) {
        let cells: Vec<_> = row.select(&td_selector).collect();
        if cells.is_empty() {
            continue;
        }

        if cells.len() == 1 {
            let class_attr = cells[0].value().attr("class").unwrap_or("");
            if class_attr.contains("panelHead-secondary") {
                current_exam_type = text_of(&cells[0]);
                continue;
            }
        }

        if cells.len() == 13 {
            let serial_no = parse_i32(&text_of(&cells[0]));
            let course_code = text_of(&cells[1]);
            if serial_no == 0 && course_code.is_empty() {
                continue;
            }
            if course_code.contains("Course Code") {
                continue;
            }

            let course_title = text_of(&cells[2]);
            let course_type = text_of(&cells[3]);
            let class_id = text_of(&cells[4]);
            let slot = text_of(&cells[5]);
            let exam_date = text_of(&cells[6]);
            let exam_session = text_of(&cells[7]);
            let reporting_time = text_of(&cells[8]);
            let exam_time = text_of(&cells[9]);
            let venue = text_of(&cells[10]);
            let seat_location = text_of(&cells[11]);
            let seat_no = text_of(&cells[12]);

            entries.push(ExamScheduleEntry {
                exam_type: current_exam_type.clone(),
                serial_no,
                course_code,
                course_title,
                course_type,
                class_id,
                slot,
                exam_date,
                exam_session,
                reporting_time,
                exam_time,
                venue,
                seat_location,
                seat_no,
            });
        }
    }

    Ok(entries)
}



fn parse_single_table(
    table: &ElementRef<'_>,
    role: String,
    tr_selector: &Selector,
    td_selector: &Selector,
    img_selector: &Selector,
) -> HodDeanDetail {
    let mut name = String::new();
    let mut school = String::new();
    let mut cabin = String::new();
    let mut email = String::new();
    let mut intercom = String::new();
    let mut photo = String::new();

    for row in table.select(tr_selector) {
        if let Some(img) = row.select(img_selector).next() {
            if let Some(src) = img.value().attr("src") {
                photo = src.to_string();
            }
        }

        let cells: Vec<_> = row.select(td_selector).collect();
        if cells.len() >= 2 {
            let key = text_of(&cells[0]).to_lowercase();
            let val = text_of(&cells[1]);

            if key.contains("name") && (key.contains("faculty") || key.contains("dean") || key.contains("hod") || key.contains("h.o.d.") || key.contains("head")) {
                name = val;
            } else if key.contains("designation") || key.contains("school") || key.contains("department") || key.contains("center") {
                school = val;
            } else if key.contains("cabin") {
                cabin = val;
            } else if key.contains("email") {
                email = val;
            } else if key.contains("intercom") {
                intercom = val;
            }
        }
    }

    HodDeanDetail {
        role,
        name,
        school,
        cabin,
        email,
        intercom,
        photo,
    }
}

fn find_role_for_table(table: &ElementRef<'_>, title_selector: &Selector) -> String {
    // 1. Try finding it inside the table itself
    if let Some(title_el) = table.select(title_selector).next() {
        return text_of(&title_el);
    }

    // 2. Try sibling elements preceding the table (e.g. sibling box-header/h3)
    let mut curr = table.prev_sibling();
    while let Some(node) = curr {
        if let Some(el) = ElementRef::wrap(node) {
            if let Some(title_el) = el.select(title_selector).next() {
                return text_of(&title_el);
            }
            let name = el.value().name();
            let has_title_class = el.value().attr("class").map_or(false, |c| c.contains("box-title") || c.contains("box-header"));
            if name == "h3" || has_title_class {
                return text_of(&el);
            }
        }
        curr = node.prev_sibling();
    }

    // 3. Try finding it inside the parent/grandparent
    if let Some(parent_node) = table.parent() {
        if let Some(parent_el) = ElementRef::wrap(parent_node) {
            if let Some(title_el) = parent_el.select(title_selector).next() {
                return text_of(&title_el);
            }
            if let Some(grandparent_node) = parent_el.parent() {
                if let Some(grandparent_el) = ElementRef::wrap(grandparent_node) {
                    if let Some(title_el) = grandparent_el.select(title_selector).next() {
                        return text_of(&title_el);
                    }
                }
            }
        }
    }
    "Unknown".to_string()
}

pub fn parse_hod_dean_details(html: &str) -> Result<Vec<HodDeanDetail>, String> {
    let document = Html::parse_document(html);
    let title_selector = Selector::parse(".box-title, h3").map_err(|_| "Invalid title selector".to_string())?;
    let table_selector = Selector::parse("table").map_err(|_| "Invalid table selector".to_string())?;
    let tr_selector = Selector::parse("tr").map_err(|_| "Invalid row selector".to_string())?;
    let td_selector = Selector::parse("td").map_err(|_| "Invalid cell selector".to_string())?;
    let img_selector = Selector::parse("img").map_err(|_| "Invalid img selector".to_string())?;

    let mut details = Vec::new();

    for table in document.select(&table_selector) {
        let table_text = table.text().collect::<String>().to_lowercase();
        let has_name = table_text.contains("name");
        let has_role_keyword = table_text.contains("faculty")
            || table_text.contains("dean")
            || table_text.contains("hod")
            || table_text.contains("h.o.d.")
            || table_text.contains("head");

        if !(has_name && has_role_keyword) {
            continue;
        }

        let role = find_role_for_table(&table, &title_selector);
        let parsed = parse_single_table(&table, role, &tr_selector, &td_selector, &img_selector);
        details.push(parsed);
    }

    Ok(details)
}
