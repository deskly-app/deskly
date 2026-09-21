# 06. Native Notifications & Scheduling LLD

This document specifies the Low-Level Design (LLD) for Deskly's native OS notification subsystem and automated class reminder engine. It covers notification lifecycles, event decoupling, scheduling evaluation, anti-spam deduplication, and cross-platform notification dispatch.

---

## 1. Architectural Scope & Problem Statement

Desktop and mobile users require timely system-level feedback outside the active application viewport:
1. **Asynchronous File Downloads**: Long-running operations like syllabus document retrieval, academic calendar exports, and auto-updater chunk downloads must notify the student when complete, even if Deskly is minimized or behind other windows.
2. **Upcoming Class Reminders**: Students need proactive alerts before their scheduled classes commence (e.g. 5, 10, or 15 minutes before the lecture/lab starts), with accurate course titles, classroom/venue numbers, and faculty details.
3. **Anti-Spam & Deduplication**: Timetable evaluation ticks must never trigger repeated duplicate notifications for the same class session on the same day.
4. **User Sovereignty & Permission Management**: Users must have granular control over notification categories, lead times, and global opt-outs in Settings, adhering to OS-level notification permissions (Windows Action Center, macOS NotificationCenter, Linux D-Bus `org.freedesktop.Notifications`, Android NotificationManager).

---

## 2. UML Class Diagram

The following diagram defines the component architecture, data contracts, and structural relationships of the notification engine:

```mermaid
classDiagram
    direction TB

    class NotificationSettings {
        +enabled: boolean
        +classRemindersEnabled: boolean
        +classReminderLeadMins: number
        +downloadAlertsEnabled: boolean
        +fromLocalStorage() NotificationSettings$
        +save(settings: Partial~NotificationSettings~) void$
    }

    class NotificationService {
        <<facade>>
        +isPermissionGranted() Promise~boolean~$
        +requestPermission() Promise~boolean~$
        +notifyDownloadCompleted(title: string, filename: string) Promise~boolean~$
        +notifyDownloadFailed(title: string, error: string) Promise~boolean~$
        +notifyUpcomingClass(entry: ScheduleEntry, minsRemaining: number) Promise~boolean~$
        +notifyGeneral(title: string, body: string) Promise~boolean~$
    }

    class ClassReminderScheduler {
        -intervalId: Timer | null
        -dedupStore: NotificationDeduplicator
        +start() void
        +stop() void
        +tick() void
        -evaluateTodaySchedule(timetable: WeeklySchedule, leadMins: number) void
        -calculateMinutesUntilStart(startTime: string) number
    }

    class NotificationDeduplicator {
        -dispatchedMap: Map~string, number~
        +hasBeenNotified(dateKey: string, courseCode: string, slot: string) boolean
        +markNotified(dateKey: string, courseCode: string, slot: string) void
        +pruneExpired() void
    }

    class ScheduleEntry {
        +day: string
        +startTime: string
        +endTime: string
        +courseCode: string
        +courseTitle: string
        +courseType: string
        +slot: string
        +venue: string
        +faculty: string
    }

    class WeeklySchedule {
        +monday: ScheduleEntry[]
        +tuesday: ScheduleEntry[]
        +wednesday: ScheduleEntry[]
        +thursday: ScheduleEntry[]
        +friday: ScheduleEntry[]
        +saturday: ScheduleEntry[]
        +sunday: ScheduleEntry[]
    }

    class TauriNotificationPlugin {
        <<native-bridge>>
        +isPermissionGranted() Promise~boolean~
        +requestPermission() Promise~PermissionResponse~
        +sendNotification(options: Options) void
    }

    %% Relationships
    NotificationService ..> NotificationSettings : reads preferences
    NotificationService ..> TauriNotificationPlugin : delegates to OS API
    ClassReminderScheduler *-- NotificationDeduplicator : contains
    ClassReminderScheduler ..> NotificationService : dispatches alerts
    ClassReminderScheduler ..> WeeklySchedule : inspects
    WeeklySchedule *-- ScheduleEntry : contains
```

---

## 3. Detailed UML Sequence Diagrams

### 3.1 Download Completion Notification Sequence

This sequence models the asynchronous download of a curriculum syllabus and the resulting native OS banner:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Curriculum Page
    participant Service as FeaturesService (Rust)
    participant FS as Local Filesystem
    participant Notify as NotificationService
    participant OS as Native OS Notification Daemon

    User->>UI: Clicks "Download Syllabus" (e.g. CSE1001)
    UI->>UI: Prompts save dialog & captures path
    UI->>Service: invoke('curriculum_download_syllabus', { courseCode })
    Note over Service: Downloads binary via AutoReloginRetryDecorator
    Service->>FS: Writes PDF bytes to destination
    Service-->>UI: Ok(SyllabusResponse { savedPath })

    UI->>Notify: notifyDownloadCompleted("Syllabus Saved", "CSE1001.pdf")
    Notify->>Notify: Check settings.downloadAlertsEnabled
    alt Notifications Enabled & Permitted
        Notify->>OS: sendNotification({ title: "Syllabus Saved", body: "CSE1001 syllabus saved successfully" })
        OS-->>User: Displays Native Notification Banner
    else Notifications Disabled
        Notify-->>UI: No-op
    end
```

---

### 3.2 Upcoming Class Reminder Scheduling Sequence

This sequence illustrates the periodic evaluation cycle detecting an approaching lecture:

```mermaid
sequenceDiagram
    autonumber
    participant Ticker as 60s Interval Timer
    participant Scheduler as ClassReminderScheduler
    participant Cache as localStorage ("deskly::cache::timetable")
    participant Dedup as NotificationDeduplicator
    participant Notify as NotificationService
    participant OS as Native OS Notification Daemon

    Ticker->>Scheduler: tick()
    Scheduler->>Scheduler: Check settings.classRemindersEnabled
    Scheduler->>Cache: Read cached WeeklySchedule
    Cache-->>Scheduler: WeeklySchedule data

    Scheduler->>Scheduler: Get current day of week and current clock minutes
    Note over Scheduler: Current Time = 08:50 AM (530 mins)<br/>Next Class = 09:00 AM (540 mins)<br/>Lead Time = 10 mins

    Scheduler->>Scheduler: minsUntilStart = 540 - 530 = 10 mins
    Note over Scheduler: 10 mins matches lead window (<= 10 and >= 0)

    Scheduler->>Dedup: hasBeenNotified("2026-09-22", "CSE1001", "A1")
    alt Not Yet Notified Today
        Dedup-->>Scheduler: false
        Scheduler->>Notify: notifyUpcomingClass(entry, 10)
        Notify->>OS: sendNotification({ title: "Upcoming Class in 10m", body: "CSE1001 in SJT-401 with Dr. Smith" })
        OS-->>Scheduler: Notification Displayed
        Scheduler->>Dedup: markNotified("2026-09-22", "CSE1001", "A1")
    else Already Notified
        Dedup-->>Scheduler: true
        Note over Scheduler: Suppressed to prevent duplicate notification
    end
```

---

## 4. State Machine Diagram: Class Reminder Lifecycle

The following state machine tracks the lifecycle of an individual scheduled class on any given calendar date:

```mermaid
stateDiagram-v2
    [*] --> Scheduled: Timetable loaded into cache

    state Scheduled {
        [*] --> WaitingForDate
        WaitingForDate --> ActiveToday: Current date matches class day
        ActiveToday --> OutsideLeadWindow: Time until class > Lead Time
    }

    OutsideLeadWindow --> InLeadWindow: Time until start <= Lead Time (e.g. 10 mins)
    
    state InLeadWindow {
        [*] --> CheckDedup
        CheckDedup --> DispatchNotification: Not in Deduplicator Cache
        CheckDedup --> Suppressed: Already in Deduplicator Cache
        DispatchNotification --> NotificationSent: OS Notification API succeeded
        NotificationSent --> Suppressed: Key recorded in Deduplicator Cache
    }

    InLeadWindow --> ClassInProgress: Current Time >= Start Time and <= End Time
    ClassInProgress --> ClassFinished: Current Time > End Time
    ClassFinished --> [*]
```

---

## 5. Design Patterns Applied

### 5.1 Facade Pattern (`NotificationService`)
- **Intent**: Provide a unified, high-level interface over low-level Tauri notification bindings and browser fallback mechanisms.
- **Benefits**: Callers (Curriculum page, Calendar exporter, Updater, Class scheduler) do not need to check raw OS permissions, parse error strings, or verify JSON settings independently.

### 5.2 Scheduler Pattern (`ClassReminderScheduler`)
- **Intent**: Decouple periodic evaluation of time-based triggers from the user interface rendering lifecycle.
- **Benefits**: Operates via a root-mounted background hook in `_app.tsx`. Consumes negligible CPU (<0.01% on an idle 60-second timer) and does not trigger React component re-renders unless state changes.

### 5.3 Idempotency & Deduplication Pattern (`NotificationDeduplicator`)
- **Intent**: Guarantee exactly-once delivery of notifications for any single discrete academic session.
- **Mechanism**: Keys entries as `${YYYY-MM-DD}_${courseCode}_${slot}`. Retains a rolling 24-hour expiration buffer to discard stale keys automatically upon date rollover.

---

## 6. Extensibility: Adding Future Notification Triggers

The notification architecture is open for extension without modifying existing notification dispatch logic:

1. **Exam Schedule Reminders**:
   - Ingest `deskly::cache::exams`.
   - Add `evaluateUpcomingExams()` to check for exams scheduled within 24 hours.
   - Dispatch via `NotificationService::notifyGeneral("Upcoming Exam Tomorrow", body)`.
2. **Attendance Low Threshold Warnings**:
   - When attendance records sync from VTOP, inspect if any course drops below 75%.
   - Trigger alert: `NotificationService::notifyGeneral("Attendance Warning", "CSE1001 dropped to 74%")`.
3. **Grade Publication Alerts**:
   - On background auto-relogin or session restore, compare cached grades count with fresh grades count.
   - Trigger alert if new course grades have been published.
