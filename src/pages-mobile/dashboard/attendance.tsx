import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentAttendance, AttendanceRecord } from "@/lib/attendance";
import { isNetworkError, fetchWithTimeout } from "@/lib/utils";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { Separator } from "@/components/ui/separator";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Outlet, useMatch, useNavigate } from "react-router-dom";
import {
  UserCheck,
  CalendarDays,
  User,
  School,
  Hash,
  LayoutGrid,
  Trophy,
  TrendingUp,
  Clock,
  GraduationCap,
  ArrowRight,
  ChevronRight,
  X,
} from "lucide-react";
import { DrawerSelect } from "@/components/ui/drawer-select";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatCourseType(type: string) {
  const t = type.toLowerCase();
  let formatted = type;
  if (t.includes("embedded theory") || t.includes("theory")) formatted = "Theory Only";
  else if (t.includes("embedded lab") || t.includes("lab")) formatted = "Lab Only";
  
  return formatted.trim().length > 15 ? formatted.trim().slice(0, 12) + "..." : formatted.trim();
}

// ─── Circular Progress for stats ──────────────────────────────────────────────

function StatCircularProgress({
  percentage,
  size = 56,
  strokeWidth = 5,
  icon: Icon,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  icon: React.ElementType;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0 select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 block">
        <circle
          className="text-muted/20 stroke-current"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${getCircleStrokeColor(percentage)} transition-all duration-700 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-primary pointer-events-none">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

// ─── Circular Progress for list rows ──────────────────────────────────────────

function ListCircularProgress({ percentage, size = 48 }: { percentage: number; size?: number }) {
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
      <span className="absolute text-xs font-extrabold text-foreground leading-none">{Math.round(percentage)}%</span>
    </div>
  );
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/65 ${className}`} />;
}

function AttendanceSkeleton() {
  return (
    <div className="space-y-6 px-2 py-4 animate-pulse font-saira">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sk className="w-6 h-6 rounded-md" />
            <Sk className="h-7 w-40" />
          </div>
        </div>
      </div>
      <Sk className="h-28 w-full rounded-xl" />
      <div className="space-y-3 pt-2">
        <Sk className="h-5 w-36" />
        {[...Array(5)].map((_, i) => (
          <Sk key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Attendance Row Component ──────────────────────────────────────────────────

function AttendanceRow({
  item,
  onSelect,
}: {
  item: AttendanceRecord;
  onSelect: () => void;
}) {
  const pct = item.attendancePercentage;

  return (
    <div
      onClick={onSelect}
      className="p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md flex items-center justify-between gap-4 active:opacity-75 hover:bg-muted/5 transition-all cursor-pointer"
    >
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <ListCircularProgress percentage={pct} size={48} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 font-medium flex-nowrap overflow-hidden">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide leading-none shrink-0">
              {item.courseCode}
            </span>
            <span className="shrink-0">&bull;</span>
            <span className="font-mono shrink-0 leading-none">{item.slot}</span>
          </div>
          <p className="text-sm font-bold text-foreground leading-snug truncate">
            {item.courseTitle}
          </p>
        </div>

        <div className="shrink-0 text-right space-y-1">
          <p className="text-sm font-bold text-foreground leading-none tabular-nums">
            {item.courseType.toLowerCase().includes("lab") ? item.attendedClasses / 2 : item.attendedClasses}{" "}
            <span className="text-muted-foreground/45 text-xs font-normal">
              / {item.courseType.toLowerCase().includes("lab") ? item.totalClasses / 2 : item.totalClasses}
            </span>
          </p>
          <div className="w-14 h-1 bg-muted/30 rounded-full overflow-hidden ml-auto">
            <div
              className={`h-full rounded-full ${getBarBgColor(pct)}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
    </div>
  );
}

// ─── Detail Drawer Component ──────────────────────────────────────────────────

function AttendanceDrawer({
  item,
  open,
  onOpenChange,
  onViewDetail,
}: {
  item: AttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewDetail: () => void;
}) {
  if (!item) return null;

  const pct = item.attendancePercentage;
  const displayType = formatCourseType(item.courseType);

  const details = [
    { icon: Hash,          label: "Course Code",   value: item.courseCode },
    { icon: LayoutGrid,    label: "Slot",          value: item.slot },
    { icon: GraduationCap, label: "Course Type",   value: item.courseType },
    { icon: User,          label: "Faculty",       value: item.faculty?.name ?? "—" },
    { icon: School,        label: "School",        value: item.faculty?.school ?? "—" },
    { icon: CalendarDays,  label: "Registered On", value: item.registrationDate || "—" },
    { icon: Clock,         label: "Last Updated",  value: item.attendanceDate || "—" },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-8 font-saira max-h-[92vh]">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-6">
          
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <ListCircularProgress percentage={pct} size={54} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 leading-none flex-wrap">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
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
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
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
                <AttendanceHint attended={item.attendedClasses} total={item.totalClasses} courseType={item.courseType} />
              </div>
              <span className="font-mono tabular-nums whitespace-nowrap shrink-0 text-right text-muted-foreground/75">
                {item.courseType.toLowerCase().includes("lab") ? item.attendedClasses / 2 : item.attendedClasses} /{" "}
                {item.courseType.toLowerCase().includes("lab") ? item.totalClasses / 2 : item.totalClasses}{" "}
                {item.courseType.toLowerCase().includes("lab") ? "labs" : "classes"} attended
              </span>
            </div>
 
            {/* View Full Details button */}
            <button
              onClick={onViewDetail}
              className="w-full flex items-center justify-between mt-3 px-4 py-3 rounded-lg bg-card/80 border border-border/40 text-xs font-bold text-foreground hover:bg-muted/10 active:opacity-85 transition-all cursor-pointer backdrop-blur-md shadow-sm"
            >
              <span>View Detailed Session Log</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </button>
          </div>
 
          {/* Course Information Details */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
              Course Information
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

        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isDetailRoute = useMatch("/dashboard/attendance/:classId");
  const isOnline = useOnlineStatus();

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const cached = localStorage.getItem("deskly::cache::attendance");
      if (cached) {
        const parsed = JSON.parse(cached) as AttendanceRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(attendance.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [filterType, setFilterType] = useState("all");

  async function load() {
    if (authLoading || !isLoggedIn) return;
    setError(null);
    const hasCache = attendance.length > 0;
    setLoading(!hasCache);
    try {
      const res = await fetchWithTimeout(getCurrentAttendance(), 15000);
      if (res.success && res.data) {
        setAttendance(res.data);
        const sem = res.semesterId ?? "";
        localStorage.setItem("deskly::cache::attendance", JSON.stringify(res.data));
        localStorage.setItem("deskly::cache::attendance_semester", sem);
      } else {
        if (!hasCache) {
          setError(res.error ?? "Failed to fetch attendance.");
        }
      }
    } catch (e) {
      if (!hasCache) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, authLoading]);

  const stats = useMemo(() => {
    let totalAttended = 0;
    let totalClasses = 0;
    attendance.forEach((r) => {
      totalAttended += r.attendedClasses ?? 0;
      totalClasses += r.totalClasses ?? 0;
    });
    return {
      totalCourses: attendance.length,
      totalAttended,
      totalClasses,
      overallPercentage: totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0,
    };
  }, [attendance]);

  const filteredAttendance = useMemo(() => {
    if (filterType === "theory") {
      return attendance.filter((item) => {
        const t = item.courseType.toLowerCase();
        return t.includes("theory") && !t.includes("lab");
      });
    }
    if (filterType === "lab") {
      return attendance.filter((item) => item.courseType.toLowerCase().includes("lab"));
    }
    return attendance;
  }, [attendance, filterType]);

  if (isDetailRoute) {
    return <Outlet />;
  }

  const showOffline = attendance.length === 0 && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) {
    return <OfflineDisplay onRetry={load} />;
  }

  if (authLoading || (loading && attendance.length === 0)) {
    return <AttendanceSkeleton />;
  }

  if (error && attendance.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-saira">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button onClick={load} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-2">
        <UserCheck className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none">
          My Attendance
        </h1>
      </header>

      {/* Stats Card */}
      <div className="p-4 sm:p-5 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
        
        {/* Left Stat - Attendance % */}
        <div className="flex items-center justify-center gap-3 min-w-0">
          <StatCircularProgress percentage={stats.overallPercentage} icon={TrendingUp} size={56} strokeWidth={5} />
          <div className="flex flex-col items-center justify-center text-center min-w-0 flex-1">
            <div className="flex items-baseline justify-center gap-0.5 min-w-0">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums leading-none">
                {stats.overallPercentage}
              </span>
              <span className="text-base sm:text-lg font-bold text-foreground leading-none">%</span>
            </div>
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground/75 mt-1.5 whitespace-nowrap">
              Attendance
            </span>
          </div>
        </div>

        {/* Vertical Separator Line */}
        <Separator orientation="vertical" className="h-12 sm:h-14 bg-border/20 shrink-0 self-center mx-1" />

        {/* Right Stat - Classes Attended */}
        <div className="flex items-center justify-center gap-3 min-w-0">
          <StatCircularProgress percentage={Math.round((stats.totalAttended / (stats.totalClasses || 1)) * 100)} icon={CalendarDays} size={56} strokeWidth={5} />
          <div className="flex flex-col items-center justify-center text-center min-w-0 flex-1">
            <div className="flex items-baseline justify-center gap-1 min-w-0">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums leading-none">
                {stats.totalAttended}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground/60 tabular-nums leading-none">
                / {stats.totalClasses}
              </span>
            </div>
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground/75 mt-1.5 whitespace-nowrap">
              Classes Attended
            </span>
          </div>
        </div>

      </div>

      {/* Course List Section */}
      <section className="space-y-4 pt-1">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
              Course Attendance
            </h2>
            <p className="text-xs text-muted-foreground/60 font-semibold">{filteredAttendance.length} courses</p>
          </div>

          <DrawerSelect
            value={filterType}
            onValueChange={setFilterType}
            title="Filter Courses"
            triggerClassName="h-8 px-3"
            options={[
              { value: "all", label: "All Courses" },
              { value: "theory", label: "Theory Only" },
              { value: "lab", label: "Lab Only" },
            ]}
          />
        </div>

        {filteredAttendance.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md">
            <UserCheck className="w-8 h-8 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-foreground leading-none">No records found</p>
            <p className="text-xs text-muted-foreground">Check filter settings or reload.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredAttendance.map((item, idx) => (
              <AttendanceRow
                key={`${item.classId}-${idx}`}
                item={item}
                onSelect={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Motivation Section */}
      <div className="pt-1">
        <div className="p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-bold text-foreground leading-none">Keep it up!</p>
              <p className="text-xs text-muted-foreground/60 leading-tight">
                Maintain 75%+ overall attendance.
              </p>
            </div>
          </div>
          <div className="w-14 h-7 shrink-0 flex items-center justify-center">
            <svg width="50" height="20" viewBox="0 0 50 20" fill="none">
              <path
                d="M1 17 C 12 17, 12 4, 25 8 C 38 12, 38 2, 49 2"
                stroke="currentColor"
                className="text-primary"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="48" cy="2" r="2" fill="currentColor" className="text-primary" />
            </svg>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <AttendanceDrawer
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          item={selected}
          onViewDetail={() => {
            setSelected(null);
            navigate(`/dashboard/attendance/${selected.classId}`, { state: { record: selected } });
          }}
        />
      )}
    </div>
  );
}
