import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentAttendance, AttendanceRecord } from "@/lib/attendance";
import { isNetworkError, fetchWithTimeout } from "@/lib/utils";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { Outlet, useMatch, useNavigate } from "react-router-dom";
import {
  UserCheck,
  CalendarDays,
  User,
  BookOpen,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCircleStrokeColor(pct: number) {
  if (pct >= 75) return "stroke-emerald-500";
  return "stroke-destructive";
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
  size = 52,
  strokeWidth = 4.5,
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
      <div className="grid grid-cols-4 gap-6 py-6 border-b border-border/10">
        {[...Array(4)].map((_, i) => (
          <Sk key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <div className="space-y-3 pt-2">
        <Sk className="h-5 w-36" />
        {[...Array(5)].map((_, i) => (
          <Sk key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Attendance Row / Card ────────────────────────────────────────────────────

function AttendanceCard({
  item,
  onSelect,
}: {
  item: AttendanceRecord;
  onSelect: () => void;
}) {
  const pct = item.attendancePercentage;
  const isLab = item.courseType.toLowerCase().includes("lab");

  return (
    <div
      onClick={onSelect}
      className="py-4 px-2 border-b border-border/10 hover:bg-muted/5 transition-colors cursor-pointer flex items-center justify-between gap-4"
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
            <span className="shrink-0">&bull;</span>
            <span className="text-xs font-medium shrink-0">{formatCourseType(item.courseType)}</span>
          </div>
          <p className="text-sm font-bold text-foreground leading-snug truncate">
            {item.courseTitle}
          </p>
          {item.faculty?.name && (
            <p className="text-xs text-muted-foreground/70 font-medium truncate flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              <span>{item.faculty.name}</span>
            </p>
          )}
        </div>

        <div className="shrink-0 text-right space-y-1">
          <p className="text-sm font-bold text-foreground leading-none tabular-nums">
            {isLab ? item.attendedClasses / 2 : item.attendedClasses}{" "}
            <span className="text-muted-foreground/45 text-xs font-normal">
              / {isLab ? item.totalClasses / 2 : item.totalClasses} {isLab ? "labs" : "classes"}
            </span>
          </p>
          <div className="mt-1">
            <AttendanceHint attended={item.attendedClasses} total={item.totalClasses} courseType={item.courseType} />
          </div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
    </div>
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
    <div className="w-full space-y-6 py-4 font-saira select-none overscroll-y-contain relative">
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
      <header className="flex items-center gap-2 pb-2 border-b border-border/10">
        <UserCheck className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none">
          My Attendance
        </h1>
      </header>

      {/* ── 4 Stats Grid Header ────────────────────────────────────────────── */}
      <div className="w-full grid grid-cols-2 lg:grid-cols-4 border-y border-border/10 py-5">
        
        {/* Stat 1: Total Courses */}
        <div className="flex items-center justify-start border-r border-b lg:border-b-0 border-border/10 pb-4 lg:pb-0 pr-4 lg:pr-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none">
                Courses
              </p>
              <p className="text-2xl lg:text-3xl font-black text-foreground tabular-nums leading-none">
                {stats.totalCourses}
              </p>
              <p className="text-[11px] text-muted-foreground/50 font-medium leading-none truncate">
                Active Registered
              </p>
            </div>
          </div>
        </div>

        {/* Stat 2: Classes Attended */}
        <div className="flex items-center justify-start border-b lg:border-b-0 lg:border-r border-border/10 pb-4 lg:pb-0 pl-4 lg:px-6">
          <div className="flex items-center gap-3.5">
            <StatCircularProgress percentage={Math.round((stats.totalAttended / (stats.totalClasses || 1)) * 100)} icon={CalendarDays} size={48} strokeWidth={4} />
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none">
                Attended
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl lg:text-3xl font-black text-foreground tabular-nums leading-none">
                  {stats.totalAttended}
                </span>
                <span className="text-xs text-muted-foreground/50 font-medium">
                  / {stats.totalClasses}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/50 font-medium leading-none truncate">
                Classes Conducted
              </p>
            </div>
          </div>
        </div>

        {/* Stat 3: Overall Percentage */}
        <div className="flex items-center justify-start border-r border-border/10 pt-4 lg:pt-0 pr-4 lg:px-6">
          <div className="flex items-center gap-3.5">
            <StatCircularProgress percentage={stats.overallPercentage} icon={TrendingUp} size={48} strokeWidth={4} />
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none">
                Overall
              </p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl lg:text-3xl font-black text-foreground tabular-nums leading-none">
                  {stats.overallPercentage}
                </span>
                <span className="text-sm font-bold text-foreground leading-none">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground/50 font-medium leading-none truncate">
                Average Attendance
              </p>
            </div>
          </div>
        </div>

        {/* Stat 4: Min Required */}
        <div className="flex items-center justify-start pt-4 lg:pt-0 pl-4 lg:pl-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none">
                Min. Required
              </p>
              <p className="text-2xl lg:text-3xl font-black text-foreground tabular-nums leading-none">
                75%
              </p>
              <p className="text-[11px] text-muted-foreground/50 font-medium leading-none truncate">
                Good Standing Limit
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Course List Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/10">
          <div className="space-y-0.5">
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
              Course Attendance
            </h2>
            <p className="text-xs text-muted-foreground/60 font-semibold">{filteredAttendance.length} courses</p>
          </div>

          <div className="flex gap-4">
            {[
              { id: "all", label: "All Courses" },
              { id: "theory", label: "Theory Only" },
              { id: "lab", label: "Lab Only" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`text-xs font-bold transition-all border-b-2 pb-1 cursor-pointer bg-transparent border-t-0 border-x-0 ${
                  filterType === tab.id
                    ? "text-primary border-primary"
                    : "text-muted-foreground/60 border-transparent hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredAttendance.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border-b border-border/10">
            <UserCheck className="w-8 h-8 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-foreground leading-none">No records found</p>
            <p className="text-xs text-muted-foreground">Check filter settings or reload.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredAttendance.map((item, idx) => (
              <AttendanceCard
                key={`${item.classId}-${idx}`}
                item={item}
                onSelect={() => navigate(`/dashboard/attendance/${item.classId}`, { state: { record: item } })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
