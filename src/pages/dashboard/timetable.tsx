import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { invoke } from "@tauri-apps/api/core";

import { ErrorDisplay } from "@/components/error-display";
import CalendarExportPopover from "@/components/calendar-export-popover";
import SingleCourseExportModal from "@/components/single-course-export-modal";
import { motion } from "framer-motion";
import {
  Clock,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
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
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}
function CardSkeleton() {
  return (
    <div className="flex items-center gap-4 md:gap-6 py-4 px-3 border border-transparent border-b border-border/20 last:border-b-0 animate-pulse">
      <div className="w-[72px] shrink-0 flex flex-col items-end gap-1">
        <Sk className="h-3.5 w-14" />
        <Sk className="h-3 w-10" />
      </div>
      <div className="relative hidden md:flex flex-col items-center justify-center self-stretch shrink-0 w-6">
        <Sk className="h-3.5 w-3.5 rounded-full shrink-0" />
      </div>
      <div className="flex-1 flex items-start justify-between gap-4">
        <div className="space-y-2 pt-0.5 flex-1">
          <div className="flex gap-2">
            <Sk className="h-3.5 w-16" />
            <Sk className="h-3 w-12 rounded-full" />
          </div>
          <Sk className="h-4 w-48" />
          <Sk className="h-3 w-36" />
        </div>
        <Sk className="h-9 w-14 shrink-0 rounded-md" />
      </div>
    </div>
  );
}
function SidebarSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Current/Next skeleton */}
      <div className="space-y-3">
        <Sk className="h-3.5 w-16" />
        <div className="border-l-2 border-primary/20 pl-4 py-1.5 space-y-3">
          <Sk className="h-4 w-32" />
          <Sk className="h-5 w-48" />
          <div className="space-y-2 pt-1">
            <Sk className="h-3 w-36" />
            <Sk className="h-3 w-28" />
          </div>
        </div>
      </div>
      {/* Day summary skeleton */}
      <div className="space-y-4">
        <Sk className="h-3 w-24 border-b border-border/10 pb-2 w-full" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_,i) => (
            <div key={i} className="space-y-1.5">
              <Sk className="h-7 w-10" />
              <Sk className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>
      {/* Chart skeleton */}
      <div className="space-y-3">
        <Sk className="h-3 w-28 border-b border-border/10 pb-2 w-full" />
        <Sk className="h-32 w-full" />
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
  const textCls = p >= 75 ? "text-chart-2"
                : p >= 60 ? "text-chart-3"
                : "text-destructive";
  const barCls  = p >= 75 ? "bg-chart-2"
                : p >= 60 ? "bg-chart-3"
                : "bg-destructive";
  return (
    <div className="flex flex-col items-end gap-1 min-w-[64px]">
      <span className={`text-lg font-bold leading-none ${textCls}`}>{p}%</span>
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.min(p,100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground font-medium">{att.attendedClasses}/{att.totalClasses}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [selectedDay, setSelectedDay]   = useState(() => todayIdx());
  const [weekStart, setWeekStart]       = useState<Date>(() => {
    const n = new Date(), d = n.getDay();
    const mon = new Date(n.setDate(n.getDate() - d + (d === 0 ? -6 : 1)));
    mon.setHours(0,0,0,0); return mon;
  });
  const [schedule, setSchedule]         = useState<WeeklySchedule>(EMPTY);
  const [attendance, setAttendance]     = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string|null>(null);
  const [now, setNow]                   = useState(() => new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!authLoading && !isLoggedIn) navigate("/"); }, [isLoggedIn, authLoading]);

  // Load from Cache (SWR) first
  useEffect(() => {
    const cachedTt = localStorage.getItem("deskly::cache::timetable");
    const cachedAtt = localStorage.getItem("deskly::cache::timetable_attendance");
    if (cachedTt || cachedAtt) {
      try {
        let hasData = false;
        if (cachedTt) {
          const parsedTt = JSON.parse(cachedTt);
          if (parsedTt && Object.values(parsedTt).some((arr: any) => Array.isArray(arr) && arr.length > 0)) {
            setSchedule(parsedTt);
            hasData = true;
          }
        }
        if (cachedAtt) {
          const parsedAtt = JSON.parse(cachedAtt);
          if (parsedAtt && parsedAtt.length > 0) {
            setAttendance(parsedAtt);
            hasData = true;
          }
        }
        if (hasData) {
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached timetable/attendance", e);
      }
    }
  }, []);

  async function load() {
    try {
      setError(null);
      const isScheduleEmpty = Object.values(schedule).every(arr => arr.length === 0);
      setLoading(isScheduleEmpty);

      const [tt, att] = await Promise.all([
        invoke<ApiResult<WeeklySchedule>>("timetable_get_weekly", { semesterSubId: null }),
        invoke<AttendanceResponse>("attendance_get_current").catch(() => ({ success: false } as AttendanceResponse)),
      ]);
      
      let updatedTt = schedule;
      let updatedAtt = attendance;
      
      if (tt.success && tt.data) {
        setSchedule(tt.data);
        updatedTt = tt.data;
      } else if (tt.error) {
        setError(tt.error);
      }
      
      if (att.success && att.data) {
        setAttendance(att.data);
        updatedAtt = att.data;
      }
      
      // Save cache
      localStorage.setItem("deskly::cache::timetable", JSON.stringify(updatedTt));
      localStorage.setItem("deskly::cache::timetable_attendance", JSON.stringify(updatedAtt));
    } catch (e) { 
      setError(e instanceof Error ? e.message : String(e)); 
    } finally { 
      setLoading(false); 
    }
  }
  useEffect(() => { if (isLoggedIn) load(); }, [isLoggedIn]);

  const DAY_KEYS: (keyof WeeklySchedule)[] = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const DAY_FULL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  const weekDays = useMemo(() => DAY_SHORT.map((name, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    return { name, full: DAY_FULL[i], num: d.getDate(), month: d.toLocaleString("default",{month:"short"}), date: d };
  }), [weekStart]);

  const weekLabel = useMemo(() => {
    const s = weekDays[0], e = weekDays[6], sy = s.date.getFullYear(), ey = e.date.getFullYear();
    return sy === ey ? `${s.month} ${s.num} – ${e.month} ${e.num}, ${sy}` : `${s.month} ${s.num}, ${sy} – ${e.month} ${e.num}, ${ey}`;
  }, [weekDays]);

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

  // ── Skeleton pages ─────────────────────────────────────────────────────────
  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  const isScheduleEmpty = Object.values(schedule).every(arr => arr.length === 0);
  if (authLoading || (loading && isScheduleEmpty)) return shell(
    <div className="w-full xl:h-[calc(100vh-10rem)] xl:flex xl:flex-col xl:overflow-hidden space-y-6">
      <div className="flex justify-between pb-6 border-b border-border/40 shrink-0">
        <div className="space-y-2"><Sk className="h-7 w-36" /><Sk className="h-3 w-52" /></div>
        <Sk className="h-8 w-44 rounded-md" />
      </div>
      <div className="shrink-0">
        <Sk className="h-14 w-full rounded-md" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start min-h-0 flex-1 xl:overflow-hidden">
        <div className="xl:h-full xl:overflow-y-auto no-scrollbar pb-6 pr-2 space-y-2 w-full">
          {[...Array(5)].map((_,i) => <CardSkeleton key={i} />)}
        </div>
        <div className="hidden xl:block xl:space-y-8 xl:h-full xl:overflow-y-auto no-scrollbar pb-6 pr-2 xl:w-[320px]">
          <SidebarSkeleton />
        </div>
      </div>
    </div>
  );

  const hasSchedule = Object.values(schedule).some(arr => Array.isArray(arr) && arr.length > 0);

  if (error && !hasSchedule) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  const focused = classStatus.cur ?? classStatus.nxt;
  const focusedLabel = classStatus.cur ? "In Progress" : classStatus.nxt ? "Up Next" : null;

  return shell(
    <div className="w-full xl:h-[calc(100vh-10rem)] xl:flex xl:flex-col xl:overflow-hidden space-y-6">
      {error && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="truncate">Sync failed: {error} (Viewing cached data)</span>
          </div>
          <button 
            onClick={load}
            className="text-xs uppercase font-bold tracking-wider hover:underline focus:outline-none shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-border/40 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">My Timetable</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Weekly schedule with attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarExportPopover schedule={schedule} weekStartDate={weekStart} />
          <div className="flex items-center gap-2 border border-border/50 bg-muted/40 rounded-md px-3 py-1.5 text-sm text-muted-foreground font-medium">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span>{weekLabel}</span>
            <div className="flex items-center gap-0.5 ml-1.5 pl-1.5 border-l border-border/50">
              <button onClick={() => setWeekStart(p => { const d=new Date(p); d.setDate(p.getDate()-7); return d; })}
                className="p-0.5 rounded hover:text-foreground cursor-pointer transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={() => setWeekStart(p => { const d=new Date(p); d.setDate(p.getDate()+7); return d; })}
                className="p-0.5 rounded hover:text-foreground cursor-pointer transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Day tabs ───────────────────────────────────────────────────────── */}
      <div className="border-b border-border/20 pb-3 shrink-0">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const active = selectedDay === i;
            const isToday = i === todayIdx();
            const count = schedule[DAY_KEYS[i]]?.length || 0;
            return (
              <button key={d.full} onClick={() => setSelectedDay(i)}
                className={`relative flex flex-col items-center gap-1.5 py-2 rounded-md cursor-pointer transition-colors duration-200 ${
                  active ? "text-primary font-semibold animate-[pulse_0.15s_ease-out_1]" : "text-muted-foreground hover:text-foreground"
                }`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${active ? "opacity-90" : "opacity-55"}`}>{d.name}</span>
                <span className="text-xl font-bold leading-none">{d.num}</span>
                {/* today underline */}
                {isToday && !active && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary" />}
                {/* classes dot */}
                {count > 0 && <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${active ? "bg-primary" : "bg-chart-2"}`} />}
                
                {/* Animated underline */}
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

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start min-h-0 flex-1 xl:overflow-hidden">

        {/* Schedule list */}
        <div className="xl:h-full xl:overflow-y-auto no-scrollbar pb-6 pr-2 space-y-4 w-full">
          {/* List header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/20">
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">{weekDays[selectedDay].full}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{weekDays[selectedDay].date.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
            </div>
            {!loading && <span className="text-sm font-medium bg-muted text-muted-foreground px-3 py-1 rounded-full">{daySchedule.length} {daySchedule.length === 1 ? "class" : "classes"}</span>}
          </div>

          {/* Rows */}
          <div className="relative">
            {loading ? (
              <div className="space-y-2 pt-2">
                {[...Array(6)].map((_,i) => <CardSkeleton key={i} />)}
              </div>
            ) : daySchedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground/20" />
                <div>
                  <p className="text-sm font-bold text-foreground">No classes scheduled</p>
                  <p className="text-xs text-muted-foreground mt-1">Enjoy your day off!</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Continuous timeline vertical line on desktop */}
                <div className="absolute top-0 bottom-0 left-[131px] w-[2px] bg-border/15 hidden md:block" />

                <div className="space-y-1 pt-2">
                  {daySchedule.map((item, idx) => {
                    const isLab = item.courseType?.toLowerCase().includes("lab") || item.slot?.startsWith("L");
                    const isNow = classStatus.cur?.courseCode === item.courseCode && classStatus.cur?.slot === item.slot;
                    const att = getAtt(item.courseCode, item.slot);

                    return (
                      <div key={`${item.courseCode}-${item.slot}-${idx}`}
                        className={`relative flex flex-col md:flex-row md:items-center gap-4 md:gap-6 py-4 px-3 md:px-4 rounded-md transition-all duration-200 border border-transparent ${
                          isNow ? "bg-primary/[0.03] border-primary/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]" : "hover:bg-muted/20"
                        }`}>

                        {/* Time */}
                        <div className="w-[80px] shrink-0 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-1">
                          <span className="text-sm font-bold text-foreground leading-none">{item.startTime}</span>
                          <span className="text-xs text-muted-foreground font-medium leading-none md:mt-1.5">{item.endTime}</span>
                        </div>

                        {/* Timeline dot */}
                        <div className="relative hidden md:flex flex-col items-center justify-center self-stretch shrink-0 w-6">
                          <div className={`w-3.5 h-3.5 rounded-full border-2 border-background z-10 transition-all duration-300 ${
                            isNow ? "bg-primary ring-4 ring-primary/15 scale-110" : "bg-muted-foreground/35"
                          }`} />
                        </div>

                        {/* Course info */}
                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold tracking-wider text-primary uppercase">{item.courseCode}</span>
                              <span className={`text-xs font-medium ${
                                isLab ? "text-chart-2" : "text-primary"
                              }`}>{isLab ? "Lab" : "Theory"}</span>
                              {isNow && (
                                <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full leading-none">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Live
                                </span>
                              )}
                            </div>
                            <p className="text-base font-semibold text-foreground leading-snug truncate">{item.courseTitle}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium flex-wrap">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />{item.venue || "TBA"}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
                                <span className="truncate max-w-[130px]" title={item.faculty}>{item.faculty || "TBA"}</span>
                              </span>
                              <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">{item.slot}</span>
                              {att && (() => {
                                const h = attHint(att.attendedClasses, att.totalClasses);
                                if (!h) return null;
                                return (
                                  <span className={`text-xs font-medium ${
                                    h.type === "need"
                                      ? "text-destructive"
                                      : "text-chart-2"
                                  }`}>
                                    {h.type === "need" ? `↑ ${h.count} to attend` : `↓ ${h.count} can skip`}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Attendance & Export */}
                          <div className="shrink-0 flex items-center justify-end gap-3">
                            <SingleCourseExportModal entry={item} dayDate={weekDays[selectedDay].date} />
                            {att ? (
                              <AttPill att={att} />
                            ) : (
                              <div className="w-16 shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="hidden xl:block xl:space-y-8 xl:h-full xl:overflow-y-auto no-scrollbar pb-6 xl:sticky xl:top-0 pr-2 shrink-0 xl:w-[320px]">
          {loading ? <SidebarSkeleton /> : (
            <>
              {/* Current / Next class */}
              {focusedLabel && focused ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/10 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{focusedLabel}</p>
                    {classStatus.cur && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Live
                      </span>
                    )}
                  </div>

                  <div className="border-l-2 border-primary pl-4 py-1.5 space-y-2.5">
                    <div>
                      <p className="text-xs font-semibold text-primary tracking-wide uppercase">{focused.courseCode}</p>
                      <p className="text-base font-semibold text-foreground leading-snug">{focused.courseTitle}</p>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground pt-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                        <span className="font-medium text-foreground">{focused.startTime} – {focused.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                        <span className="font-medium">{focused.venue || "TBA"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                        <span className="truncate font-medium">{focused.faculty || "TBA"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance footer */}
                  {(() => {
                    const a = getAtt(focused.courseCode, focused.slot);
                    if (!a) return null;
                    const p = a.attendancePercentage;
                    const barCls = p >= 75 ? "bg-chart-2" : p >= 60 ? "bg-chart-3" : "bg-destructive";
                    const txtCls = p >= 75 ? "text-chart-2" : p >= 60 ? "text-chart-3" : "text-destructive";
                    const hint = attHint(a.attendedClasses, a.totalClasses);
                    return (
                      <div className="pl-4 pt-2 space-y-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.min(p,100)}%` }} />
                          </div>
                          <span className={`text-sm font-semibold shrink-0 ${txtCls}`}>{p}% · {a.attendedClasses}/{a.totalClasses}</span>
                        </div>
                        {hint && (
                          <p className={`text-xs font-medium ${
                            hint.type === "need" ? "text-destructive" : "text-chart-2"
                          }`}>
                            {hint.type === "need"
                              ? `↑ Attend ${hint.count} more class${hint.count > 1 ? "es" : ""} to reach 75%`
                              : `↓ Can skip ${hint.count} class${hint.count > 1 ? "es" : ""} and stay above 75%`}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/10 pb-2">Today</p>
                  <div className="flex items-center gap-3 py-1">
                    <div className="p-2 rounded-md bg-muted shrink-0"><Calendar className="w-4 h-4 text-muted-foreground/60" /></div>
                    <div>
                      <p className="text-base font-semibold text-foreground">All done for today</p>
                      <p className="text-sm text-muted-foreground mt-0.5">No more classes scheduled.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Day stats */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/10 pb-2">{DAY_FULL[selectedDay]}'s Summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
                  {([
                    { label:"Classes",  val: stats.total,  Icon: Calendar  },
                    { label:"Theory",   val: stats.th,     Icon: BookOpen  },
                    { label:"Lab",      val: stats.lab,    Icon: Monitor   },
                    { label:"Duration", val: stats.dur,    Icon: Clock     },
                  ] as const).map(({ label, val, Icon }) => (
                    <div key={label} className="space-y-1.5">
                      <p className="text-3xl font-bold text-foreground leading-none">{val}</p>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-65" />
                        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly chart */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/10 pb-2">Weekly Overview</p>
                <div className="h-36 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top:6, right:4, left:-28, bottom:0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:"var(--muted-foreground)", fontSize:12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill:"var(--muted-foreground)", fontSize:12 }} allowDecimals={false} />
                      <ReChartsTooltip
                        cursor={{ fill:"var(--accent)", opacity:0.12 }}
                        contentStyle={{ backgroundColor:"var(--card)", borderColor:"var(--border)", borderRadius:"10px", fontSize:"12px", color:"var(--foreground)" }}
                      />
                      <Bar dataKey="classes" fill="var(--primary)" radius={[4,4,0,0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Weekly totals */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/10 pb-2">Weekly Totals</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
                  {([
                    { label: "Classes",  val: weeklyStats.total, Icon: Calendar  },
                    { label: "Theory",   val: weeklyStats.th,    Icon: BookOpen  },
                    { label: "Lab",      val: weeklyStats.lab,   Icon: Monitor   },
                    { label: "Duration", val: weeklyStats.dur,   Icon: Clock     },
                  ] as const).map(({ label, val, Icon }) => (
                    <div key={label} className="space-y-1.5">
                      <p className="text-3xl font-bold text-foreground leading-none">{val}</p>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-65" />
                        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
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
