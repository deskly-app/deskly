import { useEffect, useRef } from "react";
import {
  getNotificationSettings,
  notifyUpcomingClass,
} from "@/lib/notifications";
import type { WeeklySchedule } from "@/lib/calendar-export-utils";

const TIMETABLE_CACHE_KEY = "deskly::cache::timetable";

const DAY_MAP: Record<number, keyof WeeklySchedule> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

/**
 * Parses time format (e.g. "08:00 AM", "02:30 PM") into minutes from midnight.
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().toUpperCase().split(" ");
  if (parts.length < 2) return 0;

  const [hoursStr, minsStr] = parts[0].split(":");
  let hours = parseInt(hoursStr, 10) || 0;
  const mins = parseInt(minsStr, 10) || 0;
  const modifier = parts[1];

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + mins;
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) for deduplication partitioning.
 */
function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Hook that periodically evaluates today's class schedule and dispatches
 * native notifications prior to lecture / lab start times.
 */
export function useClassReminders(): void {
  // Set of class keys notified today: `${todayKey}_${courseCode}_${slot}_${startTime}`
  const notifiedSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function evaluateSchedule(): void {
      const settings = getNotificationSettings();
      if (!settings.enabled || !settings.classRemindersEnabled) {
        return;
      }

      let timetable: WeeklySchedule | null = null;
      try {
        const raw = localStorage.getItem(TIMETABLE_CACHE_KEY);
        if (raw) {
          timetable = JSON.parse(raw) as WeeklySchedule;
        }
      } catch (err) {
        console.warn("[useClassReminders] Failed to parse timetable cache:", err);
        return;
      }

      if (!timetable) return;

      const now = new Date();
      const dayOfWeek = now.getDay();
      const dayKey = DAY_MAP[dayOfWeek];
      const todayClasses = timetable[dayKey];

      if (!todayClasses || !Array.isArray(todayClasses) || todayClasses.length === 0) {
        return;
      }

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todayDateKey = getTodayDateKey();
      const leadMinutes = settings.classReminderLeadMins || 10;

      for (const entry of todayClasses) {
        if (!entry.startTime || !entry.courseCode) continue;

        const startMinutes = parseTimeToMinutes(entry.startTime);
        const minutesUntilStart = startMinutes - currentMinutes;

        // Check if class is within the reminder window (e.g. within leadMinutes and hasn't started yet)
        if (minutesUntilStart <= leadMinutes && minutesUntilStart >= 0) {
          const dedupKey = `${todayDateKey}_${entry.courseCode}_${entry.slot || "NOSLOT"}_${entry.startTime}`;

          if (!notifiedSetRef.current.has(dedupKey)) {
            notifiedSetRef.current.add(dedupKey);
            const remaining = Math.max(1, minutesUntilStart);
            notifyUpcomingClass(entry, remaining).catch((err) => {
              console.error("[useClassReminders] Failed to dispatch class reminder:", err);
            });
          }
        }
      }
    }

    // Evaluate immediately on mount
    evaluateSchedule();

    // Re-evaluate every 30 seconds
    const intervalId = setInterval(evaluateSchedule, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);
}
