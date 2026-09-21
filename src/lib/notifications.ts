import {
  isPermissionGranted as tauriIsPermissionGranted,
  requestPermission as tauriRequestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export interface ScheduleEntry {
  day?: string;
  startTime: string;
  endTime?: string;
  courseCode: string;
  courseTitle?: string;
  courseType?: string;
  slot?: string;
  venue?: string;
  faculty?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  classRemindersEnabled: boolean;
  classReminderLeadMins: number; // 5, 10, or 15
  downloadAlertsEnabled: boolean;
}

const SETTINGS_KEY = "deskly::settings::notifications";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  classRemindersEnabled: true,
  classReminderLeadMins: 10,
  downloadAlertsEnabled: true,
};

/**
 * Retrieves persisted notification preferences from localStorage.
 */
export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * Persists updated notification preferences to localStorage.
 */
export function saveNotificationSettings(
  partial: Partial<NotificationSettings>
): NotificationSettings {
  const current = getNotificationSettings();
  const updated: NotificationSettings = { ...current, ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save notification settings:", err);
  }
  return updated;
}

/**
 * Checks if native OS notification permission has been granted.
 */
export async function isPermissionGranted(): Promise<boolean> {
  try {
    return await tauriIsPermissionGranted();
  } catch (err) {
    console.warn("Failed to check notification permission:", err);
    return false;
  }
}

/**
 * Prompts the user for native OS notification permission.
 */
export async function requestPermission(): Promise<boolean> {
  try {
    const status = await tauriRequestPermission();
    return status === "granted";
  } catch (err) {
    console.error("Failed to request notification permission:", err);
    return false;
  }
}

/**
 * Dispatches a native OS notification if master enabled flag is on and permissions granted.
 */
export async function showNotification(
  title: string,
  body: string
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled) {
    return false;
  }

  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = await requestPermission();
    }

    if (granted) {
      await sendNotification({ title, body });
      return true;
    } else {
      console.warn("Notification permission not granted. Message suppressed:", title);
      return false;
    }
  } catch (err) {
    console.error("Failed to show native notification:", err);
    return false;
  }
}

/**
 * Fires a notification when a file download completes successfully.
 */
export async function notifyDownloadCompleted(
  label: string,
  filename: string
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.downloadAlertsEnabled) {
    return false;
  }

  return await showNotification(
    "Download Complete",
    `${label} (${filename}) saved successfully.`
  );
}

/**
 * Fires a notification when a file download encounters an error.
 */
export async function notifyDownloadFailed(
  label: string,
  error: string
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.downloadAlertsEnabled) {
    return false;
  }

  return await showNotification(
    "Download Failed",
    `Could not save ${label}: ${error}`
  );
}

/**
 * Fires an upcoming class reminder notification.
 */
export async function notifyUpcomingClass(
  entry: ScheduleEntry,
  minutesRemaining: number
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.classRemindersEnabled) {
    return false;
  }

  const course = entry.courseTitle || entry.courseCode;
  const venue = entry.venue ? ` in ${entry.venue}` : "";
  const slot = entry.slot ? ` [${entry.slot}]` : "";
  const faculty = entry.faculty ? ` (${entry.faculty})` : "";

  const title =
    minutesRemaining === 0
      ? "Class starting now"
      : `Class in ${minutesRemaining} min${minutesRemaining === 1 ? "" : "s"}`;
  const body = `${course}${slot}${venue}${faculty} at ${entry.startTime}.`;

  return await showNotification(title, body);
}

/**
 * Dispatches a test notification to verify OS integration.
 */
export async function sendTestNotification(): Promise<boolean> {
  return await showNotification(
    "Deskly Notifications",
    "Native OS notification system is active and functioning properly."
  );
}
