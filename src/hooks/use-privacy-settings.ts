import { useState, useCallback } from "react";

export interface PrivacySettings {
  hideCgpa: boolean;
  hideAttendance: boolean;
  hideGpa: boolean;
}

const SETTINGS_KEY = "deskly::settings::privacy";

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  hideCgpa: false,
  hideAttendance: false,
  hideGpa: false,
};

export function getPrivacySettings(): PrivacySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PRIVACY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_PRIVACY_SETTINGS;
  }
}

export function savePrivacySettings(partial: Partial<PrivacySettings>): PrivacySettings {
  const current = getPrivacySettings();
  const updated: PrivacySettings = { ...current, ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage write errors
  }
  return updated;
}

export function usePrivacySettings() {
  const [settings, setSettings] = useState<PrivacySettings>(getPrivacySettings);

  const toggleHideCgpa = useCallback(() => {
    setSettings((prev) => {
      const updated = savePrivacySettings({ hideCgpa: !prev.hideCgpa });
      return updated;
    });
  }, []);

  const toggleHideAttendance = useCallback(() => {
    setSettings((prev) => {
      const updated = savePrivacySettings({ hideAttendance: !prev.hideAttendance });
      return updated;
    });
  }, []);

  const toggleHideGpa = useCallback(() => {
    setSettings((prev) => {
      const updated = savePrivacySettings({ hideGpa: !prev.hideGpa });
      return updated;
    });
  }, []);

  return {
    hideCgpa: settings.hideCgpa,
    hideAttendance: settings.hideAttendance,
    hideGpa: settings.hideGpa,
    toggleHideCgpa,
    toggleHideAttendance,
    toggleHideGpa,
  };
}
