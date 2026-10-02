use super::types::{StudentOdDetails, StudentOdRecord};
use scraper::{ElementRef, Html, Selector};

fn clean_text(raw: &str) -> String {
    let unescaped = raw
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ");
    unescaped.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn text_of(element: &ElementRef<'_>) -> String {
    clean_text(&element.text().collect::<String>())
}

fn parse_u32(value: &str) -> u32 {
    value.trim().parse::<u32>().unwrap_or(0)
}

pub fn parse_student_od_details(html: &str, semester_id: &str) -> Result<StudentOdDetails, String> {
    let document = Html::parse_document(html);

    // Check for empty state alert
    let alert_selector = Selector::parse(".alert.alert-warning").map_err(|e| e.to_string())?;
    for alert in document.select(&alert_selector) {
        let text = text_of(&alert).to_lowercase();
        if text.contains("no records found") {
            return Ok(StudentOdDetails {
                total_count: 0,
                records: Vec::new(),
                semester_id: semester_id.to_string(),
            });
        }
    }

    // Try selecting table rows from #example1 tbody tr or fallback table tbody tr
    let row_selector = Selector::parse("table#example1 tbody tr")
        .or_else(|_| Selector::parse("table tbody tr"))
        .map_err(|e| format!("Invalid OD table row selector: {e}"))?;

    let mut records: Vec<StudentOdRecord> = Vec::new();

    for row in document.select(&row_selector) {
        let cols: Vec<_> = row
            .children()
            .filter_map(ElementRef::wrap)
            .filter(|el| el.value().name() == "td")
            .collect();

        if cols.len() >= 7 {
            let item = StudentOdRecord {
                sl_no: parse_u32(&text_of(&cols[0])),
                od_type: text_of(&cols[1]),
                reason: text_of(&cols[2]),
                basis: text_of(&cols[3]),
                date: text_of(&cols[4]),
                time: text_of(&cols[5]),
                remarks: text_of(&cols[6]),
            };
            records.push(item);
        }
    }

    // Parse Total Count badge, e.g. <span class="badge rounded-pill bg-primary fs-6 px-4 py-2">Total Count : 37</span>
    let badge_selector = Selector::parse(".badge").map_err(|e| e.to_string())?;
    let mut total_count = records.len() as u32;

    for badge in document.select(&badge_selector) {
        let text = text_of(&badge);
        if text.to_lowercase().contains("total count") {
            if let Some(num_str) = text.split(':').nth(1) {
                if let Ok(val) = num_str.trim().parse::<u32>() {
                    total_count = val;
                    break;
                }
            }
        }
    }

    Ok(StudentOdDetails {
        total_count,
        records,
        semester_id: semester_id.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_od_records() {
        let html = r#"
        <div id="Details">
            <table id="example1">
                <thead><tr><th>Sl.No</th><th>Type</th><th>Reason</th><th>Basis</th><th>Date</th><th>Time</th><th>Remarks</th></tr></thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>On Duty</td>
                        <td>Other Cultural Fests</td>
                        <td>Hours in a Day</td>
                        <td>09-Dec-2025 to 09-Dec-2025</td>
                        <td>14:00 Hrs to 19:30 Hrs</td>
                        <td>GLYTCH</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>On Duty</td>
                        <td>Technical Competitions</td>
                        <td>Hours in a Day</td>
                        <td>05-Feb-2026 to 05-Feb-2026</td>
                        <td>09:50 Hrs to 13:30 Hrs</td>
                        <td>Hackathon event</td>
                    </tr>
                </tbody>
            </table>
            <div class="card-header">
                <span class="badge rounded-pill bg-primary fs-6 px-4 py-2">Total Count : 37</span>
            </div>
        </div>
        "#;

        let res = parse_student_od_details(html, "CH20252605").unwrap();
        assert_eq!(res.records.len(), 2);
        assert_eq!(res.total_count, 37);
        assert_eq!(res.records[0].sl_no, 1);
        assert_eq!(res.records[0].remarks, "GLYTCH");
        assert_eq!(res.records[1].reason, "Technical Competitions");
    }

    #[test]
    fn test_parse_od_empty_state() {
        let html = r#"
        <div id="Details">
            <div class="alert alert-warning text-center">No records found.</div>
        </div>
        "#;

        let res = parse_student_od_details(html, "CH20252605").unwrap();
        assert_eq!(res.records.len(), 0);
        assert_eq!(res.total_count, 0);
    }
}

