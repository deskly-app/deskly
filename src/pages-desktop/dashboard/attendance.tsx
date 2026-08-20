import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentAttendance, AttendanceRecord } from "@/lib/attendance";
import { isNetworkError } from "@/lib/utils";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { Outlet, useMatch, useNavigate } from "react-router-dom";
import { useOfflineData } from "@/hooks/use-offline-data";
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
  return pct >= 75 ? "stroke-emerald-500" : "stroke-destructive";
}

function formatCourseType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("embedded theory") || t.includes("theory")) return "Theory";
  if (t.includes("embedded lab") || t.includes("lab")) return "Lab";
  return type.trim();
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
      <span className="text-xs font-semibold text-destructive whitespace-nowrap">
        ↑ {need} more {need === 1 ? unit : unitPlural} to reach 75%
      </span>
    );
  }
  if (canSkip === 0) {
    const nextSkipNeed = isLab 
      ? Math.ceil((3 * total - 4 * attended + 6) / 2)
      : (3 * total - 4 * attended + 3);
    return (
      <span className="text-xs font-semibold text-emerald-500 whitespace-nowrap">
        Can skip 1 after {nextSkipNeed} {nextSkipNeed === 1 ? unit : unitPlural}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-emerald-500 whitespace-nowrap">
      ↓ {canSkip} {canSkip === 1 ? unit : unitPlural} can skip
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />;
}

function AttendanceSkeleton() {
  return (
    <div className="space-y-6 py-4 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sk className="w-6 h-6 rounded" />
            <Sk className="h-7 w-40" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-y border-border/10">
        {[...Array(4)].map((_, i) => (
          <Sk key={i} className="h-16 w-full rounded" />
        ))}
      </div>
      <div className="space-y-3 pt-2">
        <Sk className="h-5 w-36" />
        {[...Array(5)].map((_, i) => (
          <Sk key={i} className="h-16 w-full rounded" />
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
      className="py-4 px-3 rounded-md transition-colors duration-150 hover:bg-muted/10 cursor-pointer flex items-center justify-between gap-4"
    >
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <ListCircularProgress percentage={pct} size={48} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 flex-wrap">
            <span className="font-bold text-foreground uppercase tracking-wider leading-none">
              {item.courseCode}
            </span>
            <span>·</span>
            <span className="font-semibold uppercase tracking-wider leading-none text-foreground/80">{item.slot}</span>
            <span>·</span>
            <span className="uppercase leading-none">{formatCourseType(item.courseType)}</span>
          </div>
          <p className="text-base font-bold text-foreground tracking-tight leading-snug truncate">
            {item.courseTitle}
          </p>
          {item.faculty?.name && (
            <p className="text-xs text-muted-foreground/50 font-medium truncate flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
              <span>{item.faculty.name}</span>
            </p>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1 text-right">
          <p className="text-sm sm:text-base font-bold text-foreground leading-none tabular-nums">
            {isLab ? item.attendedClasses / 2 : item.attendedClasses}{" "}
            <span className="text-muted-foreground/45 text-xs font-normal">
              / {isLab ? item.totalClasses / 2 : item.totalClasses} {isLab ? "labs" : "classes"}
            </span>
          </p>
          <AttendanceHint attended={item.attendedClasses} total={item.totalClasses} courseType={item.courseType} />
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

  const {
    data: attendanceRaw,
    loading,
    error,
    retry,
  } = useOfflineData<AttendanceRecord[]>({
    cacheKey: "deskly::cache::attendance",
    fetcher: async () => {
      const res = await getCurrentAttendance();
      if (res.success && res.semesterId) {
        localStorage.setItem("deskly::cache::attendance_semester", res.semesterId);
      }
      return res;
    },
    enabled: isLoggedIn && !authLoading,
  });

  const attendance = useMemo(() => attendanceRaw || [], [attendanceRaw]);
  const [filterType, setFilterType] = useState("all");

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
    return <OfflineDisplay onRetry={retry} />;
  }

  if (authLoading || (loading && attendance.length === 0)) {
    return <AttendanceSkeleton />;
  }

  if (error && attendance.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-4 select-none relative">
      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button onClick={retry} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-2 pb-3 border-b border-border/10">
        <UserCheck className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">
          My Attendance
        </h1>
      </header>

      {/* ── 4 Stats Grid Header (2 rows on mobile/tablet, 4 columns on desktop lg+) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 lg:gap-y-0 py-6 border-y border-border/10">
        
        {/* Stat 1: Total Courses */}
        <div className="flex flex-col gap-1.5 pl-2">
          <span className="text-2xl font-black text-foreground leading-none">{stats.totalCourses}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <BookOpen className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Courses</span>
          </div>
        </div>

        {/* Stat 2: Classes Attended */}
        <div className="flex flex-col gap-1.5 pl-4 border-l border-border/10">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-2xl font-black text-foreground leading-none">{stats.totalAttended}</span>
            <span className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">/ {stats.totalClasses}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Attended</span>
          </div>
        </div>

        {/* Stat 3: Overall Percentage */}
        <div className="flex flex-col gap-1.5 pl-2 lg:pl-4 border-t lg:border-t-0 lg:border-l border-border/10 pt-4 lg:pt-0">
          <span className={`text-2xl font-black leading-none ${stats.overallPercentage >= 75 ? "text-emerald-500" : "text-destructive"}`}>
            {stats.overallPercentage}%
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <TrendingUp className={`w-3.5 h-3.5 shrink-0 opacity-60 ${stats.overallPercentage >= 75 ? "text-emerald-500" : "text-destructive"}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Overall</span>
          </div>
        </div>

        {/* Stat 4: Min Required */}
        <div className="flex flex-col gap-1.5 pl-4 border-t lg:border-t-0 border-l lg:border-l border-border/10 pt-4 lg:pt-0">
          <span className="text-2xl font-black text-foreground leading-none">75%</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Required</span>
          </div>
        </div>

      </div>

      {/* Course List Section */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border/10">
          <div className="space-y-0.5">
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
              Course Attendance
            </h2>
            <p className="text-xs text-muted-foreground/60 font-semibold">{filteredAttendance.length} courses</p>
          </div>

          <div className="flex gap-4">
            {[
              { id: "all", label: "All" },
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
          <div className="flex flex-col divide-y divide-border/10">
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
