/// Component trait for iCalendar generation using the Composite Pattern.
pub trait CalendarComponent: Send + Sync {
    fn render(&self) -> String;
}

/// Leaf node representing an individual calendar element (e.g. VEVENT, VALARM).
#[derive(Debug, Clone)]
pub struct CalendarLeaf {
    pub name: String,
    pub properties: Vec<(String, String)>,
}

impl CalendarLeaf {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            properties: Vec::new(),
        }
    }

    pub fn with_property(mut self, key: &str, value: &str) -> Self {
        self.properties.push((key.to_string(), value.to_string()));
        self
    }
}

impl CalendarComponent for CalendarLeaf {
    fn render(&self) -> String {
        let mut out = format!("BEGIN:{}\r\n", self.name);
        for (k, v) in &self.properties {
            out.push_str(&format!("{}:{}\r\n", k, v));
        }
        out.push_str(&format!("END:{}\r\n", self.name));
        out
    }
}

/// Composite node representing a calendar container (e.g. VCALENDAR)
/// containing multiple child components.
pub struct CalendarComposite {
    pub name: String,
    pub properties: Vec<(String, String)>,
    pub children: Vec<Box<dyn CalendarComponent>>,
}

impl CalendarComposite {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            properties: Vec::new(),
            children: Vec::new(),
        }
    }

    pub fn with_property(mut self, key: &str, value: &str) -> Self {
        self.properties.push((key.to_string(), value.to_string()));
        self
    }

    pub fn add_child(&mut self, child: Box<dyn CalendarComponent>) {
        self.children.push(child);
    }
}

impl CalendarComponent for CalendarComposite {
    fn render(&self) -> String {
        let mut out = format!("BEGIN:{}\r\n", self.name);
        for (k, v) in &self.properties {
            out.push_str(&format!("{}:{}\r\n", k, v));
        }
        for child in &self.children {
            out.push_str(&child.render());
        }
        out.push_str(&format!("END:{}\r\n", self.name));
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calendar_composite_rendering() {
        let mut calendar = CalendarComposite::new("VCALENDAR")
            .with_property("VERSION", "2.0")
            .with_property("PRODID", "-//Deskly//EN");

        let event = CalendarLeaf::new("VEVENT")
            .with_property("SUMMARY", "Software Engineering")
            .with_property("UID", "course-123@deskly");

        calendar.add_child(Box::new(event));

        let rendered = calendar.render();
        assert!(rendered.starts_with("BEGIN:VCALENDAR\r\n"));
        assert!(rendered.contains("VERSION:2.0\r\n"));
        assert!(rendered.contains("BEGIN:VEVENT\r\n"));
        assert!(rendered.contains("SUMMARY:Software Engineering\r\n"));
        assert!(rendered.contains("END:VEVENT\r\n"));
        assert!(rendered.ends_with("END:VCALENDAR\r\n"));
    }
}
