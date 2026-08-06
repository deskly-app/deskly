import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "@/router";
import { openUrl } from "@tauri-apps/plugin-opener";

import { ModeToggle } from "@/components/theme-toggle";
import {
  Semester,
  authGetSemester,
  authSetSemester,
  authGetSemesters,
} from "@/lib/tauri-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  Calendar, 
  LogOut, 
  SunMoon, 
  ArrowUpCircle, 
  Scale,
  Loader2,
  ExternalLink
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { showNotification } from "@/lib/notifications";
import { invoke } from "@tauri-apps/api/core";

export default function SettingsPage() {
  const { isLoggedIn, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const initialSemesters = useState<Semester[]>(() => {
    try {
      const cached = localStorage.getItem("deskly::cache::semesters");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  })[0];

  const initialActiveSem = useState<Semester | null>(() => {
    try {
      const cached = localStorage.getItem("deskly::cache::current_semester");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  })[0];

  const [semesters, setSemesters] = useState<Semester[]>(initialSemesters);
  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(initialActiveSem);

  // Software Update States
  const [currentVersion, setCurrentVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "upToDate" | "available" | "downloading" | "finished" | "error">("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total?: number; percent?: number } | null>(null);
  const [activeUpdate, setActiveUpdate] = useState<any>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  // "windows", "macos", "appimage", "linux-manual", "unknown"
  const [installFormat, setInstallFormat] = useState<string>("unknown");

  // Load version and detect install format on mount
  useEffect(() => {
    async function loadVersion() {
      try {
        const ver = await getVersion();
        setCurrentVersion(ver);
      } catch (err) {
        console.warn("Failed to get app version:", err);
      }
    }
    async function detectInstallFormat() {
      try {
        const format = await invoke<string>("get_install_format");
        setInstallFormat(format);
      } catch (err) {
        console.warn("Failed to detect install format:", err);
        setInstallFormat("unknown");
      }
    }
    loadVersion();
    detectInstallFormat();
  }, []);

  const handleUpdateCheck = async () => {
    setUpdateStatus("checking");
    setUpdateError(null);
    try {
      const update = await check();
      if (!update) {
        setUpdateStatus("upToDate");
        return;
      }
      setLatestVersion(update.version);
      setActiveUpdate(update);
      setUpdateStatus("available");
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setUpdateError(err instanceof Error ? err.message : String(err));
      setUpdateStatus("error");
    }
  };

  const handleInstallUpdate = async () => {
    if (!activeUpdate) return;
    setUpdateStatus("downloading");
    setDownloadProgress({ downloaded: 0 });
    
    let downloadedBytes = 0;
    let totalBytes: number | undefined = undefined;

    try {
      await activeUpdate.downloadAndInstall((event: any) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength;
          setDownloadProgress({ downloaded: 0, total: totalBytes, percent: 0 });
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : undefined;
          setDownloadProgress({ downloaded: downloadedBytes, total: totalBytes, percent });
        } else if (event.event === "Finished") {
          setUpdateStatus("finished");
        }
      });
      
      await showNotification(
        "Update Installed",
        "Update installed successfully. Please restart Deskly to apply changes."
      );
    } catch (err) {
      console.error("Failed to download and install update:", err);
      setUpdateError(err instanceof Error ? err.message : String(err));
      setUpdateStatus("error");
    }
  };

  // Redirect to login if not logged in
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, authLoading, navigate]);

  // Load configuration
  useEffect(() => {
    async function loadConfig() {
      try {
        const list = await authGetSemesters();
        if (list && list.length > 0) {
          setSemesters(list);
          localStorage.setItem("deskly::cache::semesters", JSON.stringify(list));
        }

        const active = await authGetSemester();
        if (active) {
          setSelectedSemester(active);
          localStorage.setItem("deskly::cache::current_semester", JSON.stringify(active));
        }
      } catch (err) {
        console.error("Failed to load settings configuration:", err);
      }
    }
    if (isLoggedIn) {
      loadConfig();
    }
  }, [isLoggedIn]);

  const handleSemesterChange = async (semId: string) => {
    const sem = semesters.find((s) => s.id === semId);
    if (sem) {
      try {
        await authSetSemester(sem);
        setSelectedSemester(sem);
      } catch (err) {
        console.error("Failed to set semester:", err);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  return shell(
    <div className="w-full space-y-8 px-2 sm:px-4">
      {/* Header */}
      <header className="pb-4 border-b border-border/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary shrink-0" />
            Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure application preferences, active semester, and hostel settings.
          </p>
        </div>
      </header>

      {/* Grid Layout - Two columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        
        {/* Left Column: Preferences */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/10 pb-2 mb-2">
              Preferences
            </h2>
            <div className="divide-y divide-border/10">
              
              {/* Theme Settings Row */}
              <div className="py-4 flex items-center justify-between gap-6">
                <div className="flex items-start gap-3">
                  <SunMoon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">Theme Mode</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Toggle between light and dark visual themes.
                    </p>
                  </div>
                </div>
                <ModeToggle />
              </div>

              {/* Academic Settings Row */}
              <div className="py-4 flex items-center justify-between gap-6">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">Active Semester</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Select active semester for grades, timetable, and marks.
                    </p>
                  </div>
                </div>
                <Select
                  value={selectedSemester?.id || ""}
                  onValueChange={handleSemesterChange}
                  disabled={semesters.length === 0}
                >
                  <SelectTrigger className="w-[160px] h-8 rounded-md bg-muted/20 hover:bg-muted/30 border-border/20 text-xs focus:ring-1 focus:ring-primary/20">
                    <SelectValue placeholder="Select Semester" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-border/20 bg-popover/95 backdrop-blur-md">
                    {semesters.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="rounded-md text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Maintenance & Account */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/10 pb-2 mb-2">
              System & Operations
            </h2>
            <div className="divide-y divide-border/10">
              
              {/* Software Update Row */}
              <div className="py-4 space-y-3">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-start gap-3">
                    <ArrowUpCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">Software Update</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {updateStatus === "idle" && `Current version: v${currentVersion}`}
                        {updateStatus === "checking" && "Checking for updates..."}
                        {updateStatus === "upToDate" && `System is up to date (v${currentVersion})`}
                        {updateStatus === "available" && `Update available! v${latestVersion} ready.`}
                        {updateStatus === "downloading" && `Downloading: ${downloadProgress?.percent ?? 0}%`}
                        {updateStatus === "finished" && "Restarting application..."}
                        {updateStatus === "error" && "Failed to check for updates."}
                      </p>
                    </div>
                  </div>
                  
                  <div className="shrink-0">
                    {/* Non-AppImage Linux installs: show manual download link instead */}
                    {installFormat === "linux-manual" ? (
                      <button
                        onClick={async () => {
                          try {
                            await openUrl("https://github.com/Vishal-770/deskly-tauri/releases/latest");
                          } catch (err) {
                            console.error("Failed to open download link:", err);
                          }
                        }}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer border-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Download
                      </button>
                    ) : (
                      <>
                        {(updateStatus === "idle" || updateStatus === "upToDate" || updateStatus === "error") && (
                          <button
                            onClick={handleUpdateCheck}
                            className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-md cursor-pointer transition-all"
                          >
                            Check
                          </button>
                        )}
                        {updateStatus === "checking" && (
                          <button
                            disabled
                            className="px-3 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-md flex items-center gap-1.5"
                          >
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                            Checking
                          </button>
                        )}
                        {updateStatus === "available" && (
                          <button
                            onClick={handleInstallUpdate}
                            className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-md cursor-pointer transition-all animate-pulse"
                          >
                            Install
                          </button>
                        )}
                        {updateStatus === "downloading" && (
                          <button
                            disabled
                            className="px-3 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-md flex items-center gap-1.5"
                          >
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                            Downloading
                          </button>
                        )}
                        {updateStatus === "finished" && (
                          <button
                            disabled
                            className="px-3 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-md"
                          >
                            Restarting
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
 
                {/* Non-AppImage notice */}
                {installFormat === "linux-manual" && (
                  <div className="pl-7 pt-1">
                    <p className="text-xs text-muted-foreground/60 leading-relaxed">
                      Auto-update is only supported for AppImage, Windows, and macOS installs. RPM/DEB users should download the new package manually from GitHub releases.
                    </p>
                  </div>
                )}

                {/* Inline Details */}
                {updateStatus === "available" && activeUpdate && activeUpdate.body && (
                  <div className="pl-7 pt-1">
                    <div className="p-3 bg-muted/10 border border-border/10 rounded-md text-xs text-muted-foreground max-h-24 overflow-y-auto no-scrollbar font-medium">
                      <p className="font-bold text-foreground/80 mb-1">Release Notes:</p>
                      <p className="whitespace-pre-wrap leading-relaxed">{activeUpdate.body}</p>
                    </div>
                  </div>
                )}

                {updateStatus === "downloading" && downloadProgress && (
                  <div className="pl-7 pt-1 space-y-2">
                    <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress.percent ?? 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground/60 font-semibold">
                      {downloadProgress.total 
                        ? `${(downloadProgress.downloaded / (1024 * 1024)).toFixed(2)} MB / ${(downloadProgress.total / (1024 * 1024)).toFixed(2)} MB`
                        : `${(downloadProgress.downloaded / (1024 * 1024)).toFixed(2)} MB downloaded`
                      }
                    </div>
                  </div>
                )}

                {updateStatus === "error" && updateError && (
                  <div className="pl-7 pt-1">
                    <p className="text-xs text-destructive bg-destructive/5 border border-destructive/10 p-2 rounded-md font-semibold leading-relaxed">
                      {updateError}
                    </p>
                  </div>
                )}
              </div>

              {/* Legal & Privacy Policy Row */}
              <div className="py-4 flex items-center justify-between gap-6">
                <div className="flex items-start gap-3">
                  <Scale className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">Legal &amp; Privacy Policy</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      View unofficial app disclaimers and data policies.
                    </p>
                  </div>
                </div>
                <Link
                  to="/legal"
                  className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-md cursor-pointer border border-border/10 shrink-0"
                >
                  View
                </Link>
              </div>

              {/* Account Settings (Logout) Row */}
              <div className="py-4 flex items-center justify-between gap-6">
                <div className="flex items-start gap-3">
                  <LogOut className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-destructive">Sign Out</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Logout and clear saved credentials from device.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold rounded-md cursor-pointer shrink-0"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
  );
}
