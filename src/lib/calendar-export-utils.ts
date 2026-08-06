// ─── Timetable Calendar Export Utilities ────────────────────────────────────────

export interface ScheduleEntry {
  day: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  slot: string;
  venue: string;
  faculty: string;
}

export interface WeeklySchedule {
  monday: ScheduleEntry[];
  tuesday: ScheduleEntry[];
  wednesday: ScheduleEntry[];
  thursday: ScheduleEntry[];
  friday: ScheduleEntry[];
  saturday: ScheduleEntry[];
  sunday: ScheduleEntry[];
}

const DAY_KEYS: (keyof WeeklySchedule)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Helper: Parse "08:30 AM" or "12:15 PM" to hours and minutes
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const clean = timeStr.trim().toUpperCase().split(" ");
  if (clean.length < 2) return { hours: 0, minutes: 0 };
  const [hStr, mStr] = clean[0].split(":");
  let hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;
  const period = clean[1];

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return { hours, minutes };
}

// Helper: Format Date to iCalendar local datetime string: YYYYMMDDTHHMMSS
function formatIcsLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

// Helper: Format Date to iCalendar UTC datetime string: YYYYMMDDTHHMMSSZ
function formatIcsUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

// Helper: Format Date to Google Calendar template datetime format: YYYYMMDDTHHMMSSZ
function formatGCalUtcDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Generates the raw string content of an iCalendar (.ics) file.
 * The events will repeat weekly starting on the day of the active week until untilDate.
 */
export function generateIcsFile(
  schedule: WeeklySchedule,
  weekStartDate: Date,
  untilDate: Date
): string {
  const lines: string[] = [];

  // VCALENDAR Headers
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Deskly//Timetable Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  const finalUntil = new Date(untilDate);
  finalUntil.setHours(23, 59, 59, 999);
  const rruleUntilStr = formatIcsUtcDate(finalUntil);
  const nowStr = formatIcsUtcDate(new Date());

  // Loop through each weekday column
  DAY_KEYS.forEach((key, dayIdx) => {
    const dayEntries = schedule[key] || [];

    // Calculate the start date for this specific weekday in the active week
    const dayDate = new Date(weekStartDate);
    dayDate.setDate(weekStartDate.getDate() + dayIdx);

    dayEntries.forEach((entry, idx) => {
      // Parse start and end times
      const { hours: sh, minutes: sm } = parseTime(entry.startTime);
      const eventStart = new Date(dayDate);
      eventStart.setHours(sh, sm, 0, 0);

      const { hours: eh, minutes: em } = parseTime(entry.endTime);
      const eventEnd = new Date(dayDate);
      eventEnd.setHours(eh, em, 0, 0);

      // Unique identifier for the event
      const uid = `deskly-${entry.courseCode}-${entry.slot}-${dayIdx}-${idx}@deskly.app`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowStr}`);
      lines.push(`DTSTART:${formatIcsLocalDate(eventStart)}`);
      lines.push(`DTEND:${formatIcsLocalDate(eventEnd)}`);
      lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${rruleUntilStr}`);
      lines.push(`SUMMARY:${entry.courseCode} - ${entry.courseTitle}`);
      lines.push(`LOCATION:${entry.venue || "TBA"}`);
      lines.push(
        `DESCRIPTION:Slot: ${entry.slot} | Type: ${entry.courseType} | Faculty: ${entry.faculty || "TBA"}`
      );
      lines.push("END:VEVENT");
    });
  });

  lines.push("END:VCALENDAR");

  // Join lines with standard iCalendar carriage return line breaks
  return lines.join("\r\n");
}

/**
 * Generates the raw string content of an iCalendar (.ics) file for a single course event.
 * The event will repeat weekly starting on the day of the active week until untilDate.
 */
export function generateSingleIcsFile(
  entry: ScheduleEntry,
  dayDate: Date,
  untilDate: Date
): string {
  const lines: string[] = [];

  // VCALENDAR Headers
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Deskly//Timetable Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  const finalUntil = new Date(untilDate);
  finalUntil.setHours(23, 59, 59, 999);
  const rruleUntilStr = formatIcsUtcDate(finalUntil);
  const nowStr = formatIcsUtcDate(new Date());

  // Parse start and end times
  const { hours: sh, minutes: sm } = parseTime(entry.startTime);
  const eventStart = new Date(dayDate);
  eventStart.setHours(sh, sm, 0, 0);

  const { hours: eh, minutes: em } = parseTime(entry.endTime);
  const eventEnd = new Date(dayDate);
  eventEnd.setHours(eh, em, 0, 0);

  // Unique identifier for the event
  const uid = `deskly-${entry.courseCode}-${entry.slot}-${dayDate.getDay()}@deskly.app`;

  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${uid}`);
  lines.push(`DTSTAMP:${nowStr}`);
  lines.push(`DTSTART:${formatIcsLocalDate(eventStart)}`);
  lines.push(`DTEND:${formatIcsLocalDate(eventEnd)}`);
  lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${rruleUntilStr}`);
  lines.push(`SUMMARY:${entry.courseCode} - ${entry.courseTitle}`);
  lines.push(`LOCATION:${entry.venue || "TBA"}`);
  lines.push(
    `DESCRIPTION:Slot: ${entry.slot} | Type: ${entry.courseType} | Faculty: ${entry.faculty || "TBA"}`
  );
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Generates a Google Calendar event template URL for a single course slot.
 */
export function getGoogleCalendarLink(
  entry: ScheduleEntry,
  dayDate: Date,
  untilDate: Date
): string {
  // Parse start and end times
  const { hours: sh, minutes: sm } = parseTime(entry.startTime);
  const eventStart = new Date(dayDate);
  eventStart.setHours(sh, sm, 0, 0);

  const { hours: eh, minutes: em } = parseTime(entry.endTime);
  const eventEnd = new Date(dayDate);
  eventEnd.setHours(eh, em, 0, 0);

  const finalUntil = new Date(untilDate);
  finalUntil.setHours(23, 59, 59, 999);

  const text = encodeURIComponent(`${entry.courseCode} - ${entry.courseTitle}`);
  const dates = `${formatGCalUtcDate(eventStart)}/${formatGCalUtcDate(eventEnd)}`;
  const location = encodeURIComponent(entry.venue || "TBA");
  const details = encodeURIComponent(
    `Slot: ${entry.slot} | Type: ${entry.courseType} | Faculty: ${entry.faculty || "TBA"}`
  );
  const recur = encodeURIComponent(`RRULE:FREQ=WEEKLY;UNTIL=${formatGCalUtcDate(finalUntil)}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&location=${location}&details=${details}&recur=${recur}`;
}

/**
 * Triggers a browser file download natively.
 */
export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Exam Calendar Export Utilities ───────────────────────────────────────────

export interface ExamScheduleEntry {
  examType: string;
  serialNo: number;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  classId: string;
  slot: string;
  examDate: string;
  examSession: string;
  reportingTime: string;
  examTime: string;
  venue: string;
  seatLocation: string;
  seatNo: string;
}

export function parseDateStr(str: string): Date | null {
  if (!str) return null;
  const cleanStr = str.trim();
  if (!cleanStr || cleanStr === "-" || cleanStr.toLowerCase() === "tba") return null;
  
  const parts = cleanStr.split(/[-/]/);
  if (parts.length < 3) return null;
  
  const day = parseInt(parts[0], 10);
  const monthPart = parts[1].trim();
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(year)) return null;
  
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  
  let month = 0;
  if (isNaN(Number(monthPart))) {
    const monthStr = monthPart.toLowerCase();
    month = months[monthStr.substring(0, 3)] ?? -1;
    if (month === -1) return null;
  } else {
    month = parseInt(monthPart, 10) - 1; // 1-indexed to 0-indexed
    if (isNaN(month) || month < 0 || month > 11) return null;
  }
  
  return new Date(year, month, day);
}

export function parseExamTime(examDate: Date, examTimeStr: string): Date {
  const d = new Date(examDate.getTime());
  const timeParts = examTimeStr.split("-");
  if (timeParts.length === 0) return d;
  
  const startPart = timeParts[0].trim();
  const match = startPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let hr = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    
    if (ampm === "PM" && hr !== 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    d.setHours(hr, min, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

export function parseExamEndTime(examDate: Date, examTimeStr: string): Date {
  const d = new Date(examDate.getTime());
  const timeParts = examTimeStr.split("-");
  if (timeParts.length < 2) {
    const startTime = parseExamTime(examDate, examTimeStr);
    return new Date(startTime.getTime() + 90 * 60 * 1000); // Default to 1.5 hours
  }
  
  const endPart = timeParts[1].trim();
  const match = endPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let hr = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    
    if (ampm === "PM" && hr !== 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    d.setHours(hr, min, 0, 0);
  } else {
    const startTime = parseExamTime(examDate, examTimeStr);
    return new Date(startTime.getTime() + 90 * 60 * 1000);
  }
  return d;
}

export function generateExamGroupIcs(exams: ExamScheduleEntry[]): string {
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Deskly//Exams Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  const nowStr = formatIcsUtcDate(new Date());

  exams.forEach((item) => {
    const examDate = parseDateStr(item.examDate);
    if (!examDate) return;
    const start = parseExamTime(examDate, item.examTime);
    const end = parseExamEndTime(examDate, item.examTime);

    const uid = `deskly-exam-${item.courseCode}-${item.slot}@deskly.app`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStr}`);
    lines.push(`DTSTART:${formatIcsLocalDate(start)}`);
    lines.push(`DTEND:${formatIcsLocalDate(end)}`);
    lines.push(`SUMMARY:Exam: ${item.courseCode} - ${item.courseTitle}`);
    lines.push(`LOCATION:${item.venue || "TBA"}`);
    lines.push(
      `DESCRIPTION:Exam Type: ${item.examType} | Slot: ${item.slot} | Seat No: ${item.seatNo} | Reporting Time: ${item.reportingTime}`
    );
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function getExamGoogleCalendarLink(item: ExamScheduleEntry): string {
  const examDate = parseDateStr(item.examDate);
  if (!examDate) return "#";
  const start = parseExamTime(examDate, item.examTime);
  const end = parseExamEndTime(examDate, item.examTime);

  const text = encodeURIComponent(`Exam: ${item.courseCode} - ${item.courseTitle}`);
  const dates = `${formatGCalUtcDate(start)}/${formatGCalUtcDate(end)}`;
  const location = encodeURIComponent(item.venue || "TBA");
  const details = encodeURIComponent(
    `Exam Type: ${item.examType} | Slot: ${item.slot} | Seat No: ${item.seatNo} | Reporting Time: ${item.reportingTime}`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&location=${location}&details=${details}`;
}

