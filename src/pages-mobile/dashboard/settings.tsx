import { useEffect, useState } from "react";
import { useNavigate, Link } from "@/router";
import { useAuth } from "@/hooks/useAuth";
import { useSemester } from "@/hooks/useSemester";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";
import { authGetTokens } from "@/lib/tauri-auth";
import { useTheme } from "@/components/theme-provider";
import {
  User,
  LogOut,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  ChevronRight,
  Palette,
  Calendar,
  Shield,
  ShieldCheck,
  Info,
  Bell,
  BellRing,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { DrawerSelect } from "@/components/ui/drawer-select";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { isNetworkError } from "@/lib/utils";
import settingsImg from "@/assets/settings.png";
import {
  getNotificationSettings,
  saveNotificationSettings,
  isPermissionGranted,
  requestPermission,
  sendTestNotification,
  NotificationSettings,
} from "@/lib/notifications";

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none 
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${checked ? "bg-primary" : "bg-muted"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-xs ring-0 
          transition duration-200 ease-in-out
          ${checked ? "translate-x-4" : "translate-x-0"}
        `}
      />
    </button>
  );
}

// ─── Skeleton Helper ──────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/65 ${className}`} />;
}

function SettingsSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4 animate-pulse font-saira">
      <div className="space-y-1">
        <Sk className="h-7 w-32" />
        <Sk className="h-3.5 w-48" />
      </div>

      <Sk className="h-20 w-full rounded-2xl" />

      <div className="space-y-3">
        <Sk className="h-4 w-28" />
        <Sk className="h-36 w-full rounded-2xl" />
      </div>

      <div className="space-y-3">
        <Sk className="h-4 w-32" />
        <Sk className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MobileSettings() {
  const { authState, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { currentSemester, semesters, loading: semesterLoading, error: semesterError, setSemester } = useSemester();
  const { theme, setTheme } = useTheme();

  // Keyring / credential status
  const { status: credStatus, loading: credLoading, refresh: refreshCred, error: credError } = useCredentialStatus();

  const isOnline = useOnlineStatus();

  // Session token (cookie) status
  const [hasCookies, setHasCookies] = useState<boolean | null>(null);
  const [cookiesLoading, setCookiesLoading] = useState(true);

  // Logout confirmation drawer state
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  async function loadTokenStatus() {
    setCookiesLoading(true);
    try {
      const tokens = await authGetTokens();
      setHasCookies(!!(tokens && tokens.cookies && tokens.cookies.length > 0));
    } catch {
      setHasCookies(false);
    } finally {
      setCookiesLoading(false);
    }
  }

  useEffect(() => {
    loadTokenStatus();
  }, []);

  function handleRefreshKeyring() {
    if (!isOnline) return;
    refreshCred();
    loadTokenStatus();
  }

  async function handleSemesterChange(semesterId: string) {
    if (!isOnline) return;
    const semester = semesters.find((item) => item.id === semesterId);
    if (!semester) return;
    await setSemester(semester);
  }

  // Notification Preferences States
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(getNotificationSettings);
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean | null>(null);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    isPermissionGranted().then(setHasNotificationPermission).catch(() => {});
  }, []);

  const handleToggleMaster = async (enabled: boolean) => {
    if (enabled && !hasNotificationPermission) {
      const granted = await requestPermission();
      setHasNotificationPermission(granted);
    }
    const updated = saveNotificationSettings({ enabled });
    setNotificationSettings(updated);
  };

  const handleToggleClassReminders = (classRemindersEnabled: boolean) => {
    const updated = saveNotificationSettings({ classRemindersEnabled });
    setNotificationSettings(updated);
  };

  const handleChangeLeadMins = (minsStr: string) => {
    const mins = parseInt(minsStr, 10) || 10;
    const updated = saveNotificationSettings({ classReminderLeadMins: mins });
    setNotificationSettings(updated);
  };

  const handleToggleDownloadAlerts = (downloadAlertsEnabled: boolean) => {
    const updated = saveNotificationSettings({ downloadAlertsEnabled });
    setNotificationSettings(updated);
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    setTestResult(null);
    try {
      const ok = await sendTestNotification();
      const granted = await isPermissionGranted();
      setHasNotificationPermission(granted);
      if (ok) {
        setTestResult("Test alert sent!");
      } else {
        setTestResult("Permission needed or blocked by OS.");
      }
    } catch {
      setTestResult("Failed to send test alert.");
    } finally {
      setIsTestingNotification(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  const credItems = [
    {
      icon: <User className="w-5 h-5 text-primary shrink-0 mt-0.5" />,
      label: "USERNAME / REG NO",
      value: credStatus?.userId ?? authState?.userId ?? "—",
      loading: credLoading,
    },
    {
      icon: <KeyRound className="w-5 h-5 text-primary shrink-0 mt-0.5" />,
      label: "PASSWORD (Keychain)",
      value: credStatus?.hasPasswordStored ? "Stored securely in system keyring" : "Not stored",
      loading: credLoading,
    },
    {
      icon: <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />,
      label: "SESSION COOKIES",
      value: hasCookies ? "Active session tokens present" : "No session cookies stored",
      loading: cookiesLoading,
    },
  ];

  if (authLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="w-full space-y-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* 3D Illustration Image absolute header */}
      <div className="absolute -top-4 right-0 w-[180px] h-[150px] pointer-events-none select-none z-0">
        <img
          src={settingsImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          style={{
            maskImage: "radial-gradient(ellipse at 40% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 40% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)"
          }}
          alt="Settings Illustration"
        />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-start gap-2.5">
        <SettingsIcon className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
            Settings
          </h1>
          <p className="text-xs text-muted-foreground/60 leading-none">
            Manage your account and app preferences
          </p>
        </div>
      </header>

      {/* ── Student Profile Card ────────────────────────────────────────────── */}
      <div
        onClick={() => navigate("/dashboard/profile")}
        className="relative z-10 p-4 bg-card/80 border border-border/40 rounded-2xl shadow-sm backdrop-blur-md flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/5 active:opacity-75 transition-all"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground border border-border/10 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-base font-bold text-foreground leading-snug truncate">
              Student
            </h2>
            <p className="text-xs font-mono font-medium text-muted-foreground/60 leading-none tracking-wide">
              {authState?.userId ?? "—"}
            </p>
          </div>
        </div>

        <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/40 shrink-0" />
      </div>

      {/* ── Preferences Section ─────────────────────────────────────────────── */}
      <section className="relative z-10 space-y-2.5">
        <h2 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none px-1">
          Preferences
        </h2>

        <div className="bg-card/80 border border-border/40 p-4 rounded-2xl shadow-sm backdrop-blur-md space-y-4">
          {/* Visual Theme Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Palette className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <h3 className="text-sm font-bold text-foreground leading-snug">Visual Theme</h3>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Select a theme light, dark, and system themes.
                </p>
              </div>
            </div>

            <DrawerSelect
              value={theme}
              onValueChange={(val) => setTheme(val as any)}
              title="Visual Theme"
              triggerClassName="w-[115px] h-8.5 rounded-lg text-xs"
              options={[
                { value: "light", label: <span className="flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" /> Light</span> },
                { value: "dark", label: <span className="flex items-center gap-1.5"><Moon className="w-3.5 h-3.5" /> Dark</span> },
                { value: "system", label: <span className="flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5" /> System</span> },
              ]}
            />
          </div>

          <div className="border-t border-border/15 pt-4">
            {/* Active Semester Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm font-bold text-foreground leading-snug">Active Semester</h3>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    Select the active semester to load relevant settings.
                  </p>
                  {semesterError && !isNetworkError(semesterError, isOnline) && (
                    <p className="text-xs text-destructive mt-1 font-semibold">{semesterError}</p>
                  )}
                </div>
              </div>

              <DrawerSelect
                value={currentSemester?.id || ""}
                onValueChange={handleSemesterChange}
                disabled={!isOnline || semesterLoading || semesters.length === 0}
                title="Active Semester"
                triggerClassName="w-[145px] h-8.5 rounded-lg text-xs"
                placeholder={
                  currentSemester?.name
                    ? currentSemester.name
                    : !isOnline
                      ? "Offline"
                      : semesterLoading
                        ? "Loading..."
                        : "Select"
                }
                options={semesters.map((semester) => ({ value: semester.id, label: semester.name }))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Notifications Section ───────────────────────────────────────────── */}
      <section className="relative z-10 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
            Notifications
          </h2>
          {hasNotificationPermission === true && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
              <CheckCircle2 className="w-3 h-3" />
              OS Allowed
            </span>
          )}
          {hasNotificationPermission === false && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500">
              <AlertCircle className="w-3 h-3" />
              Permission Needed
            </span>
          )}
        </div>

        <div className="bg-card/80 border border-border/40 p-4 rounded-2xl shadow-sm backdrop-blur-md space-y-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <h3 className="text-sm font-bold text-foreground leading-snug">Native Notifications</h3>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Enable device alerts for classes, downloads, and updates.
                </p>
              </div>
            </div>

            <ToggleSwitch
              checked={notificationSettings.enabled}
              onChange={handleToggleMaster}
            />
          </div>

          {/* Class Reminders */}
          <div className={`border-t border-border/15 pt-4 space-y-3 transition-opacity duration-200 ${!notificationSettings.enabled ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <BellRing className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm font-bold text-foreground leading-snug">Class Reminders</h3>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    Alert before each class starts with room and faculty.
                  </p>
                </div>
              </div>

              <ToggleSwitch
                checked={notificationSettings.classRemindersEnabled}
                onChange={handleToggleClassReminders}
                disabled={!notificationSettings.enabled}
              />
            </div>

            {notificationSettings.classRemindersEnabled && (
              <div className="ml-8 flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  <span className="text-xs text-muted-foreground/70 font-medium">Lead Time</span>
                </div>

                <DrawerSelect
                  value={String(notificationSettings.classReminderLeadMins)}
                  onValueChange={handleChangeLeadMins}
                  disabled={!notificationSettings.enabled}
                  title="Reminder Lead Time"
                  triggerClassName="w-[125px] h-8 rounded-lg text-xs"
                  options={[
                    { value: "5", label: "5 mins before" },
                    { value: "10", label: "10 mins before" },
                    { value: "15", label: "15 mins before" },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Download Alerts */}
          <div className={`border-t border-border/15 pt-4 flex items-center justify-between gap-3 transition-opacity duration-200 ${!notificationSettings.enabled ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Download className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <h3 className="text-sm font-bold text-foreground leading-snug">Download Alerts</h3>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Notify when syllabus or calendar exports finish.
                </p>
              </div>
            </div>

            <ToggleSwitch
              checked={notificationSettings.downloadAlertsEnabled}
              onChange={handleToggleDownloadAlerts}
              disabled={!notificationSettings.enabled}
            />
          </div>

          {/* Test Notification Row */}
          <div className="border-t border-border/15 pt-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                Test OS notification delivery and permissions.
              </p>
              {testResult && (
                <p className="text-[11px] text-primary mt-0.5 font-semibold">
                  {testResult}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleTestNotification}
              disabled={isTestingNotification}
              className="px-3 py-1.5 bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-border/20 shrink-0 active:scale-95"
            >
              {isTestingNotification && (
                <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
              )}
              Test Alert
            </button>
          </div>
        </div>
      </section>

      {/* ── Keyring Status Section ─────────────────────────────────────────── */}
      <section className="relative z-10 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
            Keyring Status
          </h2>
          <button
            onClick={handleRefreshKeyring}
            disabled={credLoading || cookiesLoading}
            className="w-7 h-7 rounded-full bg-muted/20 hover:bg-muted/30 border border-border/10 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40 transition-all"
            title="Refresh keyring status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(credLoading || cookiesLoading) ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Keyring Error Banner */}
        {(credError || credStatus?.keyringError) && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{credError ?? credStatus?.keyringError}</span>
          </div>
        )}

        <div className="bg-card/80 border border-border/40 p-4 rounded-2xl shadow-sm backdrop-blur-md space-y-3.5">
          {credItems.map((item, idx) => (
            <div key={item.label} className={idx > 0 ? "border-t border-border/15 pt-3.5" : ""}>
              <div className="flex items-start gap-3">
                {item.icon}
                <div className="min-w-0 space-y-0.5 flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider leading-none">
                    {item.label}
                  </p>
                  {item.loading ? (
                    <Sk className="h-3.5 w-32 mt-1" />
                  ) : (
                    <p className="text-xs font-bold text-foreground truncate leading-snug">
                      {item.value}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Info Sub-Card */}
          <div className="mt-3 p-3.5 bg-muted/15 border border-border/15 rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/60 leading-relaxed font-medium">
              Credentials are stored securely in your device's native keyring. Session cookies are held in memory and refreshed automatically.
            </p>
          </div>
        </div>
      </section>

      {/* ── Legal & Privacy Card ────────────────────────────────────────────── */}
      <Link
        to="/legal"
        className="relative z-10 p-4 bg-card/80 border border-border/40 rounded-2xl shadow-sm backdrop-blur-md flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/5 active:opacity-75 transition-all block text-left"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-bold text-foreground leading-snug">Legal &amp; Privacy</h3>
            <p className="text-xs text-muted-foreground/60 leading-none">View policies, terms and regulations.</p>
          </div>
        </div>
        <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/40 shrink-0" />
      </Link>

      {/* ── Sign Out Button ─────────────────────────────────────────────────── */}
      <div className="relative z-10 pt-2">
        <button
          onClick={() => setIsLogoutConfirmOpen(true)}
          className="w-full h-12 flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/15 text-destructive border border-destructive/20 text-sm font-bold rounded-2xl transition-all cursor-pointer shadow-sm active:opacity-80"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Sign Out Confirmation Drawer */}
      <Drawer open={isLogoutConfirmOpen} onOpenChange={setIsLogoutConfirmOpen} showSwipeHandle>
        <DrawerContent className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-background border-t border-border/10 rounded-t-[32px] flex flex-col font-saira max-h-[85vh]">
          {/* Header */}
          <div className="flex items-start gap-4 pt-2 pb-6 shrink-0 border-b border-border/5">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <h3 className="text-base font-bold text-foreground tracking-tight leading-none">Sign Out</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to sign out? Your cached student data will be cleared from this device.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-5 shrink-0">
            <button
              onClick={async () => {
                setIsLogoutConfirmOpen(false);
                try {
                  await logout();
                } catch (e) {
                  console.error("Logout error:", e);
                } finally {
                  navigate("/");
                }
              }}
              className="w-full h-11 flex justify-center items-center bg-destructive text-destructive-foreground text-sm font-semibold rounded-lg active:opacity-90 transition-opacity cursor-pointer border-0 font-saira"
            >
              Sign Out
            </button>
            <DrawerClose className="w-full h-11 flex justify-center items-center bg-muted text-muted-foreground text-sm font-semibold rounded-lg cursor-pointer border-0 hover:bg-muted/80 focus:outline-none transition-colors font-saira">
              Cancel
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
