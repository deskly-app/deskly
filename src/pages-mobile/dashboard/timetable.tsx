import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { invoke } from "@tauri-apps/api/core";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { ErrorDisplay } from "@/components/error-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import SingleCourseExportModal from "@/components/single-course-export-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  Clock,
  Calendar,
  User,
  MapPin,

  Hash,
  LayoutGrid,
  ChevronRight,
  X,
} from "lucide-react";

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

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

interface AttendanceFaculty {
  id: string;
  name: string;
  school: string;
}

interface AttendanceRecord {
  slNo: number;
  classId: string;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  slot: string;
  faculty: AttendanceFaculty;
  attendanceType: string;
  registrationDate: string;
  attendanceDate: string;
  attendedClasses: number;
  totalClasses: number;
  attendancePercentage: number;
  status: string;
}

interface AttendanceResponse {
  success: boolean;
  data?: AttendanceRecord[];
  semesterId?: string;
  error?: string;
  [key: string]: unknown;
}

const EMPTY: WeeklySchedule = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIdx(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function getPercentageColor(pct: number) {
  if (pct >= 75) return "text-emerald-500";
  return "text-destructive";
}

function getCircleStrokeColor(pct: number) {
  if (pct >= 75) return "stroke-emerald-500";
  return "stroke-destructive";
}

function getBarBgColor(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  return "bg-destructive";
}

// ─── Attendance Hint ──────────────────────────────────────────────────────────

function AttendanceHint({ attended, total, courseType }: { attended: number; total: number; courseType?: string }) {
  if (total === 0) {
    return <span className="text-xs font-medium text-muted-foreground">No classes conducted yet</span>;
  }
  const isLab = courseType?.toLowerCase().includes("lab") ?? false;
  const factor = isLab ? 2 : 1;
  const unit = isLab ? "lab" : "class";
  const unitPlural = isLab ? "labs" : "classes";

  const rawNeed = 3 * total - 4 * attended;
  const need = Math.ceil(rawNeed / factor);

  const rawCanSkip = Math.floor((4 * attended - 3 * total) / 3);
  const canSkip = Math.floor(rawCanSkip / factor);

  if (need > 0) {
    return (
      <span className="text-xs font-medium text-destructive">
        Attend {need} more {need === 1 ? unit : unitPlural} to reach 75%
      </span>
    );
  }
  if (canSkip === 0) {
    const nextSkipNeed = isLab 
      ? Math.ceil((3 * total - 4 * attended + 6) / 2)
      : (3 * total - 4 * attended + 3);
    return (
      <span className="text-xs font-medium text-emerald-500">
        Can skip 1 if you attend {nextSkipNeed} more {nextSkipNeed === 1 ? unit : unitPlural}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-emerald-500">
      Can skip {canSkip} more {canSkip === 1 ? unit : unitPlural}
    </span>
  );
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function ListCircularProgress({ percentage, size = 46 }: { percentage: number; size?: number }) {
  const radius = (size - 5) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle className="text-muted/15 stroke-current" strokeWidth="3" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className={`${getCircleStrokeColor(percentage)} transition-all duration-500`}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-foreground leading-none">{Math.round(percentage)}%</span>
    </div>
  );
}

function EmptyCircularProgress() {
  return (
    <div className="w-[46px] h-[46px] rounded-full bg-muted/10 flex items-center justify-center text-muted-foreground shrink-0 border border-border/5">
      <Calendar className="w-5 h-5 text-muted-foreground/60" />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimetableSkeleton() {
  return (
    <div className="space-y-6 px-2 py-4 animate-pulse font-saira">
      {/* Header: title + refresh */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="w-6 h-6 rounded-md" />
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      </div>

      {/* Day chip strip: 7 columns */}
      <div className="grid grid-cols-7 gap-2">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>

      <Separator />

      {/* Active day info: class count */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Class rows: circle + slot chip + code/title + time + venue */}
      <div className="divide-y divide-border/10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4">
            <Skeleton className="w-[46px] h-[46px] rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-8 rounded" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-4 w-12 rounded ml-auto" />
              </div>
              <Skeleton className="h-3 w-full max-w-[180px]" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Drawer Component ──────────────────────────────────────────────────

function TimetableDrawer({
  item,
  open,
  onOpenChange,
  attendanceRecord,
  dayDate,
}: {
  item: ScheduleEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendanceRecord: AttendanceRecord | undefined;
  dayDate: Date;
}) {
  if (!item) return null;

  const hasAtt = !!attendanceRecord;
  const pct = attendanceRecord ? attendanceRecord.attendancePercentage : 0;
  const displayType = item.courseType.toLowerCase().includes("lab") ? "Lab Only" : "Theory Only";

  const details = [
    { icon: Hash,          label: "Course Code",  value: item.courseCode },
    { icon: LayoutGrid,    label: "Slot",         value: item.slot },
    { icon: Clock,         label: "Class Time",   value: `${item.startTime} - ${item.endTime}` },
    { icon: MapPin,        label: "Venue / Room", value: item.venue || "TBA" },
    { icon: User,          label: "Faculty",      value: item.faculty || "TBA" },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-8 font-saira max-h-[92vh]">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-7 pt-5">
          
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 leading-none flex-wrap">
                <span className="text-xs font-bold tracking-wider text-primary uppercase">
                  {item.courseCode}
                </span>
                <span className="text-xs font-medium text-muted-foreground/60">
                  ({displayType})
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground leading-snug tracking-tight break-words">
                {item.courseTitle}
              </h2>
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground active:opacity-75 transition-all border-none cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Attendance Status block */}
          {hasAtt && (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none">
                Attendance Status
              </p>
              
              <div className="flex items-center gap-4">
                <span className={`text-3xl font-extrabold leading-none ${getPercentageColor(pct)}`}>
                  {pct}%
                </span>
                <div className="h-2.5 flex-1 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${getBarBgColor(pct)}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground leading-snug pt-0.5 flex-wrap">
                <div className="flex-1 min-w-0">
                  <AttendanceHint attended={attendanceRecord.attendedClasses} total={attendanceRecord.totalClasses} courseType={item.courseType} />
                </div>
                <span className="font-mono tabular-nums whitespace-nowrap shrink-0 text-right text-muted-foreground/75">
                  {item.courseType.toLowerCase().includes("lab") ? attendanceRecord.attendedClasses / 2 : attendanceRecord.attendedClasses} /{" "}
                  {item.courseType.toLowerCase().includes("lab") ? attendanceRecord.totalClasses / 2 : attendanceRecord.totalClasses}{" "}
                  {item.courseType.toLowerCase().includes("lab") ? "labs" : "classes"} attended
                </span>
              </div>
            </div>
          )}

          {/* Course Details List */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none">
              Class Schedule Details
            </p>

            <div className="divide-y divide-border/15 border-t border-b border-border/15">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide leading-none">{label}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground text-right break-words min-w-0 max-w-[65%]">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action: Export Modal inside the drawer */}
          <div className="pt-2">
            <SingleCourseExportModal entry={item} dayDate={dayDate} fullWidth />
          </div>

        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function TimetablePage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();

  const [selectedDay, setSelectedDay] = useState(() => todayIdx());
  const [weekStart] = useState<Date>(() => {
    const n = new Date(),
      d = n.getDay();
    const mon = new Date(n.setDate(n.getDate() - d + (d === 0 ? -6 : 1)));
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  const {
    data: scheduleData,
    loading: scheduleLoading,
    error: scheduleError,
    retry: loadSchedule
  } = useOfflineData<WeeklySchedule>({
    cacheKey: "deskly::cache::timetable",
    fetcher: () => invoke<ApiResult<WeeklySchedule>>("timetable_get_weekly", { semesterSubId: null }),
    enabled: isLoggedIn && !authLoading,
  });

  const {
    data: attendanceData,
    loading: attendanceLoading,
    error: attendanceError,
    retry: loadAttendance
  } = useOfflineData<AttendanceRecord[]>({
    cacheKey: "deskly::cache::timetable_attendance",
    fetcher: () => invoke<AttendanceResponse>("attendance_get_current").catch(() => ({ success: false } as AttendanceResponse)),
    enabled: isLoggedIn && !authLoading,
  });

  const schedule = scheduleData || EMPTY;
  const attendance = attendanceData || [];
  const loading = scheduleLoading || attendanceLoading;
  const error = scheduleError || attendanceError;
  const [selected, setSelected] = useState<ScheduleEntry | null>(null);

  const load = () => {
    loadSchedule();
    loadAttendance();
  };

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/");
  }, [isLoggedIn, authLoading, navigate]);



  const DAY_KEYS: (keyof WeeklySchedule)[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const weekDays = useMemo(() => {
    return DAY_SHORT.map((name, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return {
        name,
        full: DAY_FULL[i],
        num: d.getDate(),
        month: d.toLocaleString("default", { month: "short" }),
        date: d,
      };
    });
  }, [weekStart]);



  const daySchedule = useMemo(() => schedule[DAY_KEYS[selectedDay]] || [], [schedule, selectedDay]);

  const attMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    for (const r of attendance) {
      m.set(`${r.courseCode}::${r.courseType.toLowerCase().includes("lab") ? "lab" : "th"}`, r);
    }
    return m;
  }, [attendance]);

  const getAtt = (code: string, courseType: string) => {
    const isLab = courseType.toLowerCase().includes("lab");
    return attMap.get(`${code}::${isLab ? "lab" : "th"}`);
  };

  const isScheduleEmpty = Object.values(schedule).every((arr) => arr.length === 0);
  const showOffline = isScheduleEmpty && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) {
    return <OfflineDisplay onRetry={load} />;
  }

  if (authLoading || (loading && isScheduleEmpty)) {
    return <TimetableSkeleton />;
  }

  if (error && isScheduleEmpty) {
    return (
      <div className="flex h-full items-center justify-center font-saira">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 px-2 py-4 font-saira select-none overscroll-y-contain">
      {/* Google Font Saira Injection */}
      <style>{`
        .font-saira {
          font-family: 'Saira', sans-serif !important;
        }
      `}</style>

      {/* Sync Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md gap-4 shrink-0">
          <p className="truncate">Sync failed: {error}</p>
          <button onClick={load} className="text-xs uppercase font-bold tracking-wider hover:underline shrink-0 border-none bg-transparent text-destructive">
            Retry
          </button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary shrink-0" />
            <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none truncate">
              My Timetable
            </h1>
          </div>
          <p className="text-xs text-muted-foreground leading-none pt-0.5">
            Stay on track with your classes
          </p>
        </div>

      </header>

      {/* ── Calendar Days Horizontally Scrollable / Slidable Row ────────────────── */}
      <div className="pb-4 overflow-hidden">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar w-full py-1 snap-x snap-mandatory">
          {weekDays.map((d, i) => {
            const active = selectedDay === i;

            return (
              <button
                key={d.full}
                onClick={() => setSelectedDay(i)}
                className={`relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-md transition-all duration-200 cursor-pointer border-none min-w-[72px] shrink-0 snap-center ${
                  active
                    ? "bg-primary/10 border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground bg-transparent"
                }`}
              >
                <span className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-primary" : "opacity-55"}`}>
                  {d.name}
                </span>
                
                <span className={`text-lg font-semibold leading-none ${active ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                  {d.num}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* ── Active Day Info ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-1">
        <div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight leading-none">
            {weekDays[selectedDay].full}
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-none">
            {weekDays[selectedDay].date.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {!loading && (
          <span className="text-xs font-semibold bg-muted/20 text-muted-foreground px-3 py-1 rounded-full shrink-0">
            {daySchedule.length} {daySchedule.length === 1 ? "Class" : "Classes"}
          </span>
        )}
      </div>

      {/* ── Class List (Clean, Separator-divided layout like attendance page) ─── */}
      <div className="pt-2">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md w-full" />
            ))}
          </div>
        ) : daySchedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-foreground leading-none">No classes scheduled</p>
            <p className="text-xs text-muted-foreground">Enjoy your day off!</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {daySchedule.map((item, idx) => {
              const att = getAtt(item.courseCode, item.courseType);
              
              const attendancePct = att ? att.attendancePercentage : 0;
              const hasAttendance = !!att;
              
              return (
                <button
                  key={`${item.courseCode}-${item.slot}-${idx}`}
                  onClick={() => setSelected(item)}
                  className="w-full flex items-center gap-4 py-4 px-3 text-left border-none bg-transparent hover:bg-muted/5 active:bg-muted/15 rounded-md transition-all cursor-pointer"
                >
                  {/* Left: Circular progress */}
                  {hasAttendance ? (
                    <ListCircularProgress percentage={attendancePct} size={48} />
                  ) : (
                    <EmptyCircularProgress />
                  )}

                  {/* Middle: Spacious details column */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    {/* First line: Course Code & Slot */}
                    <div className="flex items-center gap-2 leading-none">
                      <span className="text-sm font-semibold tracking-wide text-foreground uppercase">
                        {item.courseCode}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground/60 font-mono leading-none">
                        ({item.slot})
                      </span>
                    </div>

                    {/* Second line: Course Title */}
                    <p className="text-xs text-muted-foreground truncate leading-none">
                      {item.courseTitle}
                    </p>

                    {/* Third line: Time Range with Clock Icon */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-mono leading-none">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                      <span>{item.startTime} - {item.endTime}</span>
                    </div>
                  </div>

                  {/* Right: Attendance fraction details & Chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    {hasAttendance && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground leading-none tabular-nums">
                          {item.courseType.toLowerCase().includes("lab") ? att.attendedClasses / 2 : att.attendedClasses}{" "}
                          <span className="text-muted-foreground/45 text-xs font-normal">
                            / {item.courseType.toLowerCase().includes("lab") ? att.totalClasses / 2 : att.totalClasses}
                          </span>
                        </p>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground/35 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ────────────────────────────────────────────────────── */}
      {selected && (
        <TimetableDrawer
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          item={selected}
          attendanceRecord={getAtt(selected.courseCode, selected.courseType)}
          dayDate={weekDays[selectedDay].date}
        />
      )}
    </div>
  );
}
