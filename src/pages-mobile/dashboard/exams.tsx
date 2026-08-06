import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { invoke } from "@tauri-apps/api/core";

import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError, fetchWithTimeout } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  MapPin,
  FileText,
  CalendarRange,
  ChevronRight,
  Hash,
  LayoutGrid,
  Award,
  X,
} from "lucide-react";
import { generateExamGroupIcs } from "@/lib/calendar-export-utils";
import examsImg from "@/assets/exams.png";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExamScheduleEntry {
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

interface ExamScheduleGroup {
  examType: string;
  schedules: ExamScheduleEntry[];
}

interface ExamScheduleResponse {
  success: boolean;
  data?: ExamScheduleGroup[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDateStr(str: string): Date | null {
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

function getCalendarDayDifference(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

function formatExamTypeLabel(type: string): string {
  const clean = type.trim().toUpperCase();
  if (clean === "CAT1") return "CAT 1";
  if (clean === "CAT2") return "CAT 2";
  if (clean === "FAT") return "FAT";
  return type;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

function ExamSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4 animate-pulse font-saira">
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <Sk className="h-7 w-32" />
          <Sk className="h-3.5 w-48" />
        </div>
        <Sk className="h-8 w-20 rounded-md" />
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        <Sk className="h-14 w-28 rounded-lg shrink-0" />
        <Sk className="h-14 w-28 rounded-lg shrink-0" />
        <Sk className="h-14 w-28 rounded-lg shrink-0" />
      </div>
      <div className="space-y-3">
        <Sk className="h-5 w-40" />
        <div className="bg-muted/10 border border-border/10 rounded-lg divide-y divide-border/10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Sk className="w-11 h-11 rounded-md shrink-0" />
                <div className="space-y-2 flex-1">
                  <Sk className="h-4 w-24" />
                  <Sk className="h-4 w-40" />
                  <Sk className="h-3.5 w-32" />
                </div>
              </div>
              <Sk className="w-8 h-8 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExamSchedulePage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();

  const initialExams = useMemo(() => {
    try {
      const cached = localStorage.getItem("deskly::cache::exams");
      if (cached) {
        const parsed = JSON.parse(cached) as ExamScheduleGroup[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  }, []);

  const [groups, setGroups] = useState<ExamScheduleGroup[]>(initialExams);
  const [selectedTab, setSelectedTab] = useState<string>(initialExams[0]?.examType ?? "");
  const [loading, setLoading] = useState(initialExams.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamScheduleEntry | null>(null);

  // Load fresh from backend
  async function load() {
    try {
      if (!isLoggedIn && !authLoading) return;
      setError(null);
      if (authLoading) return;

      const hasCache = groups.length > 0;
      setLoading(!hasCache);

      const res = await fetchWithTimeout(invoke<ExamScheduleResponse>("exam_schedule_get", { semesterSubId: null }), 15000);
      if (res.success && res.data) {
        setGroups(res.data);
        localStorage.setItem("deskly::cache::exams", JSON.stringify(res.data));
        if (res.data.length > 0) {
          const tabNames = res.data.map(g => g.examType);
          if (!selectedTab || !tabNames.includes(selectedTab)) {
            setSelectedTab(res.data[0].examType);
          }
        } else {
          setGroups([]);
          localStorage.removeItem("deskly::cache::exams");
        }
      } else {
        const errMsg = res.error ?? "Failed to fetch exam schedule.";
        if (errMsg.includes("Could not find exam schedule table")) {
          setGroups([]);
          localStorage.removeItem("deskly::cache::exams");
          setError("Could not find exam schedule table");
        } else {
          if (!hasCache) setError(errMsg);
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes("Could not find exam schedule table")) {
        setGroups([]);
        localStorage.removeItem("deskly::cache::exams");
        setError("Could not find exam schedule table");
      } else {
        if (groups.length === 0) setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      load();
    }
  }, [isLoggedIn, authLoading]);

  // Select active schedules matching the current tab selection
  const activeSchedules = useMemo(() => {
    const group = groups.find((g) => g.examType === selectedTab);
    if (!group) return [];
    return [...group.schedules].sort((a, b) => {
      const da = parseDateStr(a.examDate);
      const db = parseDateStr(b.examDate);
      if (da && db) return da.getTime() - db.getTime();
      if (da) return -1;
      if (db) return 1;
      return a.serialNo - b.serialNo;
    });
  }, [groups, selectedTab]);

  // Flat list of exam schedules and gap elements to synchronize dividers
  const listItems = useMemo(() => {
    const items: Array<{ type: "exam"; data: ExamScheduleEntry } | { type: "gap"; days: number }> = [];
    activeSchedules.forEach((exam, idx) => {
      items.push({ type: "exam", data: exam });
      if (idx < activeSchedules.length - 1) {
        const nextExam = activeSchedules[idx + 1];
        const examDate = parseDateStr(exam.examDate);
        const nextDate = parseDateStr(nextExam.examDate);
        if (examDate && nextDate) {
          const dayDiff = getCalendarDayDifference(examDate, nextDate);
          if (dayDiff > 1) {
            items.push({ type: "gap", days: dayDiff - 1 });
          }
        }
      }
    });
    return items;
  }, [activeSchedules]);

  // Formatted Tabs list
  const tabsList = useMemo(() => {
    return groups.map((g) => {
      const label = formatExamTypeLabel(g.examType);
      const count = g.schedules.length;
      
      if (count === 0) return { id: g.examType, label, count, range: "" };
      
      const validDates = g.schedules
        .map(s => parseDateStr(s.examDate))
        .filter((d): d is Date => d !== null);

      if (validDates.length === 0) {
        return { id: g.examType, label, count, range: "Schedule Pending" };
      }

      const minDate = new Date(Math.min(...validDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
      
      const formatShort = (d: Date) => {
        const day = d.getDate();
        const mon = d.toLocaleString("en-US", { month: "short" });
        return `${day} ${mon}`;
      };
      
      const range = `${formatShort(minDate)} – ${formatShort(maxDate)}, ${minDate.getFullYear()}`;
      return { id: g.examType, label, count, range };
    });
  }, [groups]);

  const shell = (children: React.ReactNode) => <>{children}</>;

  const showOffline = groups.length === 0 && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline && !loading) {
    return shell(<OfflineDisplay onRetry={load} />);
  }

  if (authLoading || (loading && groups.length === 0)) {
    return shell(<ExamSkeleton />);
  }

  const isNotReleased = error?.includes("Could not find exam schedule table");

  if (error && groups.length === 0 && !isNotReleased) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full space-y-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[200px] h-[160px] pointer-events-none select-none z-0">
        <img
          src={examsImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          style={{
            maskImage: "radial-gradient(ellipse at 30% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)"
          }}
          alt="Exams Illustration"
        />
      </div>

      {/* Error banner */}
      {error && !isNotReleased && !isNetworkError(error, isOnline) && (
        <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button onClick={load} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-start justify-between gap-4 shrink-0">
        <div className="flex items-start gap-2 min-w-0">
          <div className="w-6 h-6 text-primary shrink-0 mt-0.5 flex items-center justify-center">
            {/* Calendar grid icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 14h.01" />
              <path d="M12 14h.01" />
              <path d="M16 14h.01" />
              <path d="M8 18h.01" />
              <path d="M12 18h.01" />
              <path d="M16 18h.01" />
            </svg>
          </div>
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none">
              My Exams
            </h1>
          </div>
        </div>
      </header>

      {/* ── Exam Type Tabs ────────────────────────────────────────────────────── */}
      {groups.length > 0 && (
        <div className="relative z-10 flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-2 px-2 shrink-0">
          {tabsList.map((tab) => {
            const active = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer border transition-all duration-150 shrink-0
                  ${active
                    ? "bg-primary border-primary text-primary-foreground shadow shadow-primary/10"
                    : "bg-muted/25 border-border/10 text-muted-foreground hover:bg-muted/35"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content View ────────────────────────────────────────────────────── */}
      {isNotReleased ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-20 gap-3 text-center bg-muted/15 dark:bg-[#0e0e0f]/20 border border-border/40 dark:border-border/10 rounded-lg">
          <CalendarRange className="w-8 h-8 text-muted-foreground/20" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Exams Not Uploaded</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs px-4">
              The university has not released or uploaded the exam schedule for this semester on VTOP yet.
            </p>
          </div>
        </div>
      ) : activeSchedules.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-20 gap-3 text-center bg-muted/15 dark:bg-[#0e0e0f]/20 border border-border/40 dark:border-border/10 rounded-lg">
          <FileText className="w-8 h-8 text-muted-foreground/20" />
          <div>
            <p className="text-sm font-bold text-foreground">No exam schedules loaded</p>
            <p className="text-xs text-muted-foreground mt-1">Select a semester or check VTOP records.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 leading-none uppercase tracking-wider">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 14h.01" />
                <path d="M12 14h.01" />
                <path d="M16 14h.01" />
              </svg>
              {formatExamTypeLabel(selectedTab)} Schedule
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {listItems.map((item, idx) => {
              if (item.type === "gap") {
                return (
                  <div key={`gap-${idx}`} className="flex justify-center py-1 select-none">
                    <span className="text-[11px] font-bold text-muted-foreground/60 tracking-wider uppercase">
                      {item.days} {item.days === 1 ? "Day" : "Days"} Gap
                    </span>
                  </div>
                );
              }

              const exam = item.data;
              const examDate = parseDateStr(exam.examDate);
              const isScheduled = examDate !== null;

              const dayNum = isScheduled ? examDate.getDate() : "TBA";
              const weekDayStr = isScheduled ? examDate.toLocaleString("en-US", { weekday: "short" }).toUpperCase() : "";

              const displayExamTime = exam.examTime && exam.examTime !== "-" ? exam.examTime.split("-")[0].trim() : "Schedule Pending";
              const displayVenue = exam.venue && exam.venue !== "-" ? exam.venue : "Venue TBA";

              return (
                <div
                  key={`${exam.courseCode}-${idx}`}
                  onClick={() => setSelectedExam(exam)}
                  className="p-3.5 bg-background/50 backdrop-blur-xl border border-border/20 rounded-xl shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/15 active:opacity-80 transition-all duration-150"
                >
                  {/* Left: Date Text & Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Clean Date Text (No Badge Box) */}
                    <div className="w-9 flex flex-col items-center justify-center shrink-0 text-muted-foreground select-none">
                      <span className="text-sm font-black leading-none text-foreground">{dayNum}</span>
                      {isScheduled && <span className="text-[10px] font-bold uppercase leading-none mt-1 text-muted-foreground/60">{weekDayStr}</span>}
                    </div>

                    {/* Course Code, Title & Sub-line */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black tracking-widest text-primary uppercase leading-none">
                          {exam.courseCode}
                        </span>
                        {exam.slot && (
                          <span className="text-[11px] font-semibold text-muted-foreground/75 leading-none">
                            Slot {exam.slot}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate leading-snug">
                        {exam.courseTitle}
                      </h4>
                      {isScheduled && (
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 font-medium pt-0.5 truncate">
                          <span className="flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3 text-primary/70 shrink-0" />
                            <span>{displayExamTime}</span>
                          </span>
                          {displayVenue !== "Venue TBA" && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
                              <span className="truncate">{displayVenue}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Clean Seat Text & Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isScheduled && exam.seatNo && exam.seatNo !== "-" && (
                      <span className="text-xs font-semibold text-muted-foreground/80 leading-none">
                        Seat {exam.seatNo}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Slide-up Drawer for Details ─────────────────────────────────────── */}
      <Drawer
        open={selectedExam !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExam(null);
        }}
      >
        <DrawerContent className="pb-[calc(1.5rem+env(safe-area-inset-bottom))] font-saira max-h-[92vh] bg-background border-t border-border/10 rounded-t-[32px] flex flex-col">
          <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-6 flex-1">
            
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black uppercase bg-primary/10 text-primary border border-primary/10 tracking-wider">
                    {selectedExam?.courseCode}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black uppercase bg-muted text-muted-foreground tracking-wider">
                    {selectedExam?.courseType.trim()}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black uppercase bg-primary/10 text-primary border border-primary/10 tracking-wider">
                    {selectedExam?.examType}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-foreground leading-snug tracking-tight">
                  {selectedExam?.courseTitle}
                </h3>
              </div>
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedExam(null)}
                className="p-2 rounded-full bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground active:opacity-75 transition-all border-none cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Separator className="bg-border/10" />

            {/* Drawer Body details */}
            {selectedExam && (() => {
              const isExamScheduled = parseDateStr(selectedExam.examDate) !== null;
              const seatText = selectedExam.seatNo && selectedExam.seatNo !== "-" ? `Seat ${selectedExam.seatNo}` : "Seat TBA";
              const timingText = selectedExam.examTime && selectedExam.examTime !== "-" 
                ? `${selectedExam.examTime} (Reporting: ${selectedExam.reportingTime && selectedExam.reportingTime !== "-" ? selectedExam.reportingTime : "30 mins before schedule"})`
                : "Schedule Pending";
              const venueText = selectedExam.venue && selectedExam.venue !== "-"
                ? (selectedExam.seatLocation && selectedExam.seatLocation !== "-" ? `${selectedExam.venue} (Location: ${selectedExam.seatLocation})` : selectedExam.venue)
                : "Venue TBA";

              const detailsList = [
                { icon: Hash,          label: "Class ID",       value: selectedExam.classId || "N/A" },
                { icon: LayoutGrid,    label: "Slot",           value: selectedExam.slot || "N/A" },
                { icon: Award,         label: "Seat Number",    value: seatText },
                { icon: Clock,         label: "Exam Timing",    value: timingText },
                { icon: MapPin,        label: "Venue / Room",   value: venueText },
              ];
              return (
                <div className="space-y-6">
                  {/* 1. Details Grid */}
                  <div className="grid grid-cols-2 gap-y-5 gap-x-4 py-1">
                    {detailsList.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="space-y-1 col-span-2 sm:col-span-1">
                        <span className="text-xs font-bold text-muted-foreground/45 uppercase tracking-widest leading-none block">
                          {label}
                        </span>
                        <div className="flex items-center gap-2 pt-0.5">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-foreground truncate">{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calendar Add Button */}
                  <button
                    disabled={!isExamScheduled}
                    onClick={async () => {
                      if (!isExamScheduled) return;
                      const icsContent = generateExamGroupIcs([selectedExam]);
                      const filename = `${selectedExam.courseCode}_Exam.ics`;
                      try {
                        await invoke("save_calendar_file", {
                          content: icsContent,
                          filename,
                        });
                      } catch (e) {
                        console.error("Failed to save calendar file", e);
                      }
                    }}
                    className="w-full py-3 bg-primary hover:opacity-90 active:opacity-75 transition-all text-primary-foreground font-black text-sm rounded-lg flex items-center justify-center gap-2 border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarRange className="w-4 h-4 shrink-0" />
                    <span>{isExamScheduled ? "Add to Calendar" : "Calendar Export Unavailable (TBA)"}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
