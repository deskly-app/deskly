import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { invoke } from "@tauri-apps/api/core";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import CalendarExportPopover from "@/components/calendar-export-popover";
import SingleCourseExportModal from "@/components/single-course-export-modal";
import { motion } from "framer-motion";
import {
  Clock,
  Calendar,
  User,
  BookOpen,
  MapPin,
  Monitor,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReChartsTooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScheduleEntry {
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
interface WeeklySchedule {
  monday: ScheduleEntry[];
  tuesday: ScheduleEntry[];
  wednesday: ScheduleEntry[];
  thursday: ScheduleEntry[];
  friday: ScheduleEntry[];
  saturday: ScheduleEntry[];
  sunday: ScheduleEntry[];
}
interface ApiResult<T> { success: boolean; data?: T; error?: string; }
interface AttendanceFaculty { id: string; name: string; school: string; }
interface AttendanceRecord {
  slNo: number; classId: string; courseCode: string; courseTitle: string;
  courseType: string; slot: string; faculty: AttendanceFaculty;
  attendanceType: string; registrationDate: string; attendanceDate: string;
  attendedClasses: number; totalClasses: number; attendancePercentage: number; status: string;
}
interface AttendanceResponse { success: boolean; data?: AttendanceRecord[]; semesterId?: string; error?: string; }

const EMPTY: WeeklySchedule = { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toMins(t: string): number {
  const c = t.trim().toUpperCase().split(" ");
  if (c.length < 2) return 0;
  const [h, m] = c[0].split(":").map(Number);
  let hr = h || 0;
  if (c[1] === "PM" && hr !== 12) hr += 12;
  if (c[1] === "AM" && hr === 12) hr = 0;
  return hr * 60 + (m || 0);
}
function todayIdx(): number { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />;
}
function CardSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 px-3 border-b border-border/10 last:border-b-0 animate-pulse">
      <div className="w-full sm:w-24 shrink-0 flex sm:flex-col justify-between sm:justify-center gap-1">
        <Sk className="h-3.5 w-16" />
        <Sk className="h-3 w-10" />
      </div>
      <div className="flex-grow flex items-start justify-between gap-4">
        <div className="space-y-2 pt-0.5 flex-1">
          <div className="flex gap-2">
            <Sk className="h-3.5 w-16" /><Sk className="h-3.5 w-12 rounded" />
          </div>
          <Sk className="h-4 w-full max-w-[220px]" />
          <Sk className="h-3 w-32" />
        </div>
        <Sk className="h-8 w-12 shrink-0 rounded" />
      </div>
    </div>
  );
}
function SidebarSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-3">
        <Sk className="h-3.5 w-20" />
        <div className="border-l-2 border-primary/20 pl-4 py-1.5 space-y-3">
          <Sk className="h-4 w-32" /><Sk className="h-5 w-48" />
          <div className="space-y-2 pt-1">
            <Sk className="h-3 w-36" /><Sk className="h-3 w-28" />
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-4 border-t border-border/10">
        <Sk className="h-3.5 w-28" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_,i) => (
            <div key={i} className="space-y-1.5">
              <Sk className="h-6 w-10" /><Sk className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Attendance bar pill ───────────────────────────────────────────────────────
function attHint(attended: number, total: number) {
  const need = Math.ceil(3 * total - 4 * attended);
  const canSkip = Math.floor((4 * attended - 3 * total) / 3);
  if (need > 0) return { type: "need" as const, count: need };
  if (canSkip > 0) return { type: "skip" as const, count: canSkip };
  return null;
}

function AttPill({ att }: { att: AttendanceRecord }) {
  const p = att.attendancePercentage;
  const textCls = p >= 75 ? "text-emerald-500" : "text-destructive";
  const barCls  = p >= 75 ? "bg-emerald-500" : "bg-destructive";
  const h = attHint(att.attendedClasses, att.totalClasses);
  return (
    <div className="flex flex-col items-end gap-1.5 min-w-[56px] sm:min-w-[72px]">
      <span className={`text-base sm:text-lg font-bold leading-none ${textCls}`}>{p}%</span>
      <div className="w-12 sm:w-16 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.min(p,100)}%` }} />
      </div>
      <span className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-none">
        {att.attendedClasses}/{att.totalClasses}
      </span>
      {h && (
        <span className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap leading-none mt-0.5 ${
          h.type === "need" ? "text-destructive" : "text-emerald-500"
        }`}>
          {h.type === "need" ? `↑ ${h.count} to attend` : `↓ ${h.count} can skip`}
        </span>
      )}
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────
export default function TimetablePage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [selectedDay, setSelectedDay]   = useState(() => todayIdx());
  const [weekStart] = useState<Date>(() => {
    const n = new Date(), d = n.getDay();
    const mon = new Date(n.setDate(n.getDate() - d + (d === 0 ? -6 : 1)));
    mon.setHours(0,0,0,0); return mon;
  });

  const {
    data: timetableRaw,
    loading: timetableLoading,
    error: timetableError,
    retry: retryTimetable,
  } = useOfflineData<WeeklySchedule>({
    cacheKey: "deskly::cache::timetable",
    fetcher: async () => {
      const res = await invoke<ApiResult<WeeklySchedule>>("timetable_get_weekly", { semesterSubId: null });
      return { success: res.success, data: res.data, error: res.error };
    },
    enabled: isLoggedIn && !authLoading,
    isEmpty: (val) => Object.values(val).every((arr) => arr.length === 0),
  });
  const schedule = timetableRaw || EMPTY;

  const {
    data: attendanceRaw,
    loading: attendanceLoading,
    retry: retryAttendance,
  } = useOfflineData<AttendanceRecord[]>({
    cacheKey: "deskly::cache::timetable_attendance",
    fetcher: async () => {
      const res = await invoke<AttendanceResponse>("attendance_get_current").catch(
        () => ({ success: false } as AttendanceResponse)
      );
      return { success: res.success, data: res.data, error: res.error };
    },
    enabled: isLoggedIn && !authLoading,
  });
  const attendance = attendanceRaw || [];

  const loading = timetableLoading || attendanceLoading;
  const error = timetableError;
  const [now, setNow] = useState(() => new Date());

  const load = () => {
    retryTimetable();
    retryAttendance();
  };

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!authLoading && !isLoggedIn) navigate("/"); }, [isLoggedIn, authLoading, navigate]);

  const DAY_KEYS: (keyof WeeklySchedule)[] = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const DAY_FULL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  const weekDays = useMemo(() => DAY_SHORT.map((name, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    return { name, full: DAY_FULL[i], num: d.getDate(), month: d.toLocaleString("default",{month:"short"}), date: d };
  }), [weekStart]);

  const daySchedule = useMemo(() => schedule[DAY_KEYS[selectedDay]] || [], [schedule, selectedDay]);
  const todaySchedule = useMemo(() => schedule[DAY_KEYS[todayIdx()]] || [], [schedule]);

  const classStatus = useMemo(() => {
    const nm = now.getHours()*60 + now.getMinutes();
    let cur: ScheduleEntry|null=null, nxt: ScheduleEntry|null=null;
    for (const e of todaySchedule) {
      const s=toMins(e.startTime), en=toMins(e.endTime);
      if (nm>=s && nm<en) cur=e;
      else if (nm<s && !nxt) nxt=e;
    }
    return { cur, nxt };
  }, [todaySchedule, now]);

  const stats = useMemo(() => {
    let th=0, lab=0, mins=0;
    daySchedule.forEach(it => {
      const isLab = it.courseType?.toLowerCase().includes("lab") || it.slot?.startsWith("L");
      if (isLab) lab++; else th++;
      const s=toMins(it.startTime), e=toMins(it.endTime);
      mins += e>s ? e-s : 50;
    });
    const h=Math.floor(mins/60), m=mins%60;
    return { total:daySchedule.length, th, lab, dur: h>0 ? `${h}h${m>0?` ${m}m`:""}` : m>0 ? `${m}m` : "0m" };
  }, [daySchedule]);

  const chartData = useMemo(() => DAY_KEYS.map((k,i) => ({ name:DAY_SHORT[i], classes:schedule[k]?.length||0 })), [schedule]);

  const weeklyStats = useMemo(() => {
    let total = 0, th = 0, lab = 0, mins = 0;
    for (const key of DAY_KEYS) {
      for (const item of (schedule[key] || [])) {
        total++;
        const isLab = item.courseType?.toLowerCase().includes("lab") || item.slot?.startsWith("L");
        if (isLab) lab++; else th++;
        const s = toMins(item.startTime), e = toMins(item.endTime);
        mins += e > s ? (e - s) : 50;
      }
    }
    const h = Math.floor(mins / 60), m = mins % 60;
    return { total, th, lab, dur: h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : m > 0 ? `${m}m` : "0m" };
  }, [schedule]);

  const attMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    for (const r of attendance) m.set(`${r.courseCode}::${r.courseType.toLowerCase().includes("lab")?"lab":"th"}`, r);
    return m;
  }, [attendance]);
  const getAtt = (code: string, slot: string) => attMap.get(`${code}::${slot.toUpperCase().startsWith("L")?"lab":"th"}`);

  const isScheduleEmpty = Object.values(schedule).every(arr => arr.length === 0);
  if (authLoading || (loading && isScheduleEmpty)) {
    return (
      <div className="w-full space-y-6 pb-10">
        <div className="flex items-center justify-between pb-6 border-b border-border/10">
          <div className="space-y-2"><Sk className="h-6 w-32" /><Sk className="h-3 w-48" /></div>
          <Sk className="h-8 w-24 rounded" />
        </div>
        <div className="grid grid-cols-7 gap-2">{[...Array(7)].map((_,i) => <Sk key={i} className="h-12 w-full" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
          <div className="space-y-2">{[...Array(4)].map((_,i) => <CardSkeleton key={i} />)}</div>
          <SidebarSkeleton />
        </div>
      </div>
    );
  }

  const hasSchedule = Object.values(schedule).some(arr => Array.isArray(arr) && arr.length > 0);
  if (error && !hasSchedule) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  const focused = classStatus.cur ?? classStatus.nxt;
  const focusedLabel = classStatus.cur ? "In Progress" : classStatus.nxt ? "Up Next" : null;

  return (
    <div className="w-full space-y-6 pb-10">
      {error && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="truncate">Sync failed: {error} (Viewing cached data)</span>
          </div>
          <button onClick={load} className="text-xs uppercase font-bold tracking-wider hover:underline focus:outline-none shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex flex-wrap sm:items-center justify-between gap-4 pb-6 border-b border-border/10">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">My Timetable</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Weekly schedule with attendance</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CalendarExportPopover schedule={schedule} weekStartDate={weekStart} />
        </div>
      </header>

      {/* ── Day tabs: scrollable flex row, no dot indicators at all ── */}
      <div className="border-b border-border/10 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full py-1 snap-x snap-mandatory">
          {weekDays.map((d, i) => {
            const active = selectedDay === i;
            return (
              <button
                key={d.full}
                onClick={() => setSelectedDay(i)}
                className={`relative flex flex-col items-center gap-1 py-2 px-3 rounded-md cursor-pointer transition-colors duration-200 shrink-0 snap-center min-w-[64px] flex-1 ${
                  active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${active ? "opacity-90" : "opacity-55"}`}>
                  {d.name}
                </span>
                <span className="text-lg sm:text-xl font-bold leading-none">{d.num}</span>
                {active && (
                  <motion.div
                    layoutId="activeDayTab"
                    className="absolute bottom-0 h-[2px] bg-primary rounded-full"
                    style={{ left: "15%", right: "15%" }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content grid: stacks below on small/medium, sidebar on right at lg+ ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
        
        {/* Left schedule list */}
        <div className="space-y-4 min-w-0 w-full">
          <div className="flex items-center justify-between pb-3 border-b border-border/10">
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">{weekDays[selectedDay].full}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {weekDays[selectedDay].date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {!loading && (
              <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 rounded-full shrink-0">
                {daySchedule.length} {daySchedule.length === 1 ? "class" : "classes"}
              </span>
            )}
          </div>

          <div className="space-y-1">
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_,i) => <CardSkeleton key={i} />)}</div>
            ) : daySchedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground/20" />
                <div>
                  <p className="text-sm font-bold text-foreground">No classes scheduled</p>
                  <p className="text-xs text-muted-foreground mt-1">Enjoy your day off!</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {daySchedule.map((item, idx) => {
                  const isLab = item.courseType?.toLowerCase().includes("lab") || item.slot?.startsWith("L");
                  const isNow = classStatus.cur?.courseCode === item.courseCode && classStatus.cur?.slot === item.slot;
                  const att = getAtt(item.courseCode, item.slot);

                  return (
                    <div
                      key={`${item.courseCode}-${item.slot}-${idx}`}
                      className={`flex flex-col sm:flex-row gap-3 sm:gap-6 py-4 px-3 sm:px-4 rounded-md transition-all duration-200 border border-transparent ${
                        isNow ? "bg-primary/[0.03] border-primary/15" : "hover:bg-muted/10"
                      }`}
                    >
                      {/* Time: horizontal wrap on mobile, vertical stacked on desktop */}
                      <div className="flex sm:flex-col items-baseline sm:items-start justify-between sm:justify-center gap-1 shrink-0 w-full sm:w-24 pb-2 sm:pb-0 border-b sm:border-b-0 border-border/10 text-left">
                        <span className="text-sm font-bold text-foreground leading-none">{item.startTime}</span>
                        <span className="text-xs text-muted-foreground font-medium leading-none sm:mt-1.5">{item.endTime}</span>
                      </div>

                      {/* Course details & exports */}
                      <div className="flex-grow min-w-0 flex flex-row items-center justify-between gap-4 w-full">
                        <div className="space-y-1.5 flex-grow min-w-0">
                          {/* Course code, type, slot */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 flex-wrap">
                            <span className="font-bold text-foreground uppercase tracking-wider">{item.courseCode}</span>
                            <span>·</span>
                            <span className="uppercase">{isLab ? "Lab" : "Theory"}</span>
                            <span>·</span>
                            <span className="font-semibold uppercase text-foreground/80">{item.slot}</span>
                            {isNow && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full leading-none ml-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Ongoing
                              </span>
                            )}
                          </div>

                          <p className="text-base font-bold text-foreground tracking-tight leading-snug truncate">
                            {item.courseTitle}
                          </p>

                          {/* Venue & Faculty */}
                          <div className="flex items-center gap-3.5 text-xs text-muted-foreground/50 font-medium flex-wrap pt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              <span className="truncate max-w-[120px]">{item.venue || "TBA"}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              <span className="truncate max-w-[120px]" title={item.faculty}>{item.faculty || "TBA"}</span>
                            </span>
                          </div>
                        </div>

                        {/* Export & attendance pill */}
                        <div className="shrink-0 flex items-center gap-3 sm:gap-4 self-center">
                          <SingleCourseExportModal entry={item} dayDate={weekDays[selectedDay].date} />
                          {att ? <AttPill att={att} /> : <div className="w-12 sm:w-16 shrink-0" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: stacks below on small/medium, sticky on lg+ */}
        <div className="w-full lg:w-[300px] shrink-0 space-y-6 pt-6 lg:pt-0 lg:border-l lg:border-border/10 lg:pl-8 lg:sticky lg:top-6">
          {loading ? <SidebarSkeleton /> : (
            <>
              {/* Live Status */}
              {focusedLabel && focused && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/10 pb-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/45">{focusedLabel}</p>
                    {classStatus.cur && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Ongoing
                      </span>
                    )}
                  </div>
                  <div className="border-l-2 border-primary pl-4 py-1.5 space-y-2.5">
                    <div>
                      <p className="text-[10px] font-bold text-primary tracking-wider uppercase">{focused.courseCode}</p>
                      <p className="text-sm font-semibold text-foreground leading-snug">{focused.courseTitle}</p>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="font-semibold text-foreground">{focused.startTime} – {focused.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="font-medium">{focused.venue || "TBA"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="truncate font-medium">{focused.faculty || "TBA"}</span>
                      </div>
                    </div>
                  </div>
                  {/* Attendance hint */}
                  {(() => {
                    const a = getAtt(focused.courseCode, focused.slot);
                    if (!a) return null;
                    const p = a.attendancePercentage;
                    const barCls = p >= 75 ? "bg-emerald-500" : "bg-destructive";
                    const txtCls = p >= 75 ? "text-emerald-500" : "text-destructive";
                    const hint = attHint(a.attendedClasses, a.totalClasses);
                    return (
                      <div className="pl-4 pt-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.min(p,100)}%` }} />
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${txtCls}`}>{p}% · {a.attendedClasses}/{a.totalClasses}</span>
                        </div>
                        {hint && (
                          <p className={`text-[10px] font-bold ${hint.type === "need" ? "text-destructive" : "text-emerald-500"}`}>
                            {hint.type === "need"
                              ? `↑ Attend ${hint.count} more class${hint.count > 1 ? "es" : ""} to reach 75%`
                              : `↓ Can skip ${hint.count} class${hint.count > 1 ? "es" : ""} and stay above 75%`}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Day's Summary */}
              <div className="space-y-4 pt-4 border-t border-border/10">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/45">
                  {DAY_FULL[selectedDay]}'s Summary
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {([
                    { label:"Classes",  val: stats.total,  Icon: Calendar  },
                    { label:"Theory",   val: stats.th,     Icon: BookOpen  },
                    { label:"Lab",      val: stats.lab,    Icon: Monitor   },
                    { label:"Duration", val: stats.dur,    Icon: Clock     },
                  ] as const).map(({ label, val, Icon }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-2xl font-black text-foreground leading-none">{val}</p>
                      <div className="flex items-center gap-1.5 text-muted-foreground/50">
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly overview chart */}
              <div className="space-y-3 pt-4 border-t border-border/10">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/45">Weekly Overview</p>
                <div className="h-32 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top:6, right:4, left:-28, bottom:0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:"var(--muted-foreground)", fontSize:11, opacity:0.6 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill:"var(--muted-foreground)", fontSize:11, opacity:0.6 }} allowDecimals={false} />
                      <ReChartsTooltip
                        cursor={{ fill:"var(--accent)", opacity:0.08 }}
                        contentStyle={{ backgroundColor:"var(--card)", borderColor:"var(--border)", borderRadius:"8px", fontSize:"11px", color:"var(--foreground)" }}
                      />
                      <Bar dataKey="classes" fill="var(--primary)" radius={[3,3,0,0]} maxBarSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Weekly totals */}
              <div className="space-y-4 pt-4 border-t border-border/10">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/45">Weekly Totals</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {([
                    { label: "Classes",  val: weeklyStats.total, Icon: Calendar  },
                    { label: "Theory",   val: weeklyStats.th,    Icon: BookOpen  },
                    { label: "Lab",      val: weeklyStats.lab,   Icon: Monitor   },
                    { label: "Duration", val: weeklyStats.dur,   Icon: Clock     },
                  ] as const).map(({ label, val, Icon }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-2xl font-black text-foreground leading-none">{val}</p>
                      <div className="flex items-center gap-1.5 text-muted-foreground/50">
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
