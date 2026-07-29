import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useParams, useNavigate } from "@/router";
import { getAttendanceDetail, AttendanceDetailRecord, AttendanceRecord } from "@/lib/attendance";
import { fetchWithTimeout, isNetworkError } from "@/lib/utils";
import { OfflineDisplay } from "@/components/offline-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { ErrorDisplay } from "@/components/error-display";
import {
  ArrowLeft,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  BarChart3,
  WifiOff,
} from "lucide-react";

// ─── Circular Arc Progress ────────────────────────────────────────────────────

function BigCircularProgress({ percentage }: { percentage: number }) {
  const size = 80;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  let stroke = "text-destructive";
  if (percentage >= 75) stroke = "text-chart-2";
  else if (percentage >= 50) stroke = "text-chart-3";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle className="text-muted/30 stroke-current" strokeWidth="5" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className={`${stroke} stroke-current transition-all duration-700`}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-xl font-black text-foreground leading-none block">{percentage}%</span>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.trim().toLowerCase();
  const isPresent = s === "present" || s === "p" || s === "1";
  const isAbsent = s === "absent" || s === "a" || s === "0";
  const isOd = s.includes("od") || s.includes("duty") || s === "on duty";

  if (isPresent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-chart-2 bg-chart-2/10 px-2 py-1 rounded-full leading-none">
        <CheckCircle2 className="w-3 h-3" />
        Present
      </span>
    );
  }
  if (isAbsent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full leading-none">
        <XCircle className="w-3 h-3" />
        Absent
      </span>
    );
  }
  if (isOd) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full leading-none">
        <span className="w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[7px] font-bold border border-primary/20 shrink-0">OD</span>
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-full leading-none">
      <Clock className="w-3 h-3" />
      {status}
    </span>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getCourseTypeColor(type: string): string {
  const c = type.trim().toUpperCase();
  if (c.includes("THEORY")) return "text-primary";
  if (c.includes("LAB")) return "text-chart-2";
  if (c.includes("ONLINE")) return "text-chart-1";
  if (c.includes("SKILL")) return "text-chart-4";
  return "text-muted-foreground";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="w-full space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-border/20">
        <Sk className="w-8 h-8 rounded-md" />
        <div className="space-y-2 flex-1">
          <Sk className="h-5 w-48" />
          <Sk className="h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 py-6 border-y border-border/10">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`pl-2 space-y-2 ${
              i === 0
                ? ""
                : i === 2 || i === 4
                ? "border-none sm:border-l sm:border-border/10"
                : "border-l border-border/10"
            } ${
              i === 4 ? "col-span-2 sm:col-span-1 border-t border-border/10 pt-4 sm:border-t-0 sm:pt-0" : ""
            }`}
          >
            <div className="flex justify-between items-center">
              <Sk className="h-3 w-14" />
              <Sk className="h-4 w-4 rounded" />
            </div>
            <Sk className="h-6 w-10 mt-1" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5 pt-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-md border border-transparent">
            <Sk className="h-3 w-5" />
            <Sk className="h-3.5 w-24" />
            <Sk className="h-4 w-14 rounded-md" />
            <Sk className="h-3 flex-1 hidden sm:block" />
            <Sk className="h-5 w-16 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttendanceDetailPage() {
  const { classId } = useParams("/dashboard/attendance/:classId");
  const location = useLocation();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [record, setRecord] = useState<AttendanceRecord | undefined>(location.state?.record);
  const [details, setDetails] = useState<AttendanceDetailRecord[]>(() => {
    if (!classId) return [];
    try {
      const cacheKey = `deskly::cache::attendance_detail_${classId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(details.length === 0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record && classId) {
      const cached = localStorage.getItem("deskly::cache::attendance");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AttendanceRecord[];
          const found = parsed.find((r) => String(r.classId) === String(classId));
          if (found) {
            setRecord(found);
          }
        } catch (e) {
          console.error("Failed to parse cached attendance for fallback", e);
        }
      }
    }
  }, [classId, record]);

  async function load(isManualRetry = false) {
    if (!classId || !record) return;
    if (isManualRetry && !isOnline) return;

    const hasCache = details.length > 0;
    if (isManualRetry) {
      setIsRetrying(true);
    } else {
      setLoading(!hasCache);
    }

    try {
      const cacheKey = `deskly::cache::attendance_detail_${classId}`;
      const res = await fetchWithTimeout(getAttendanceDetail(classId!, record!.slot), 15000);
      if (res.success && res.data) {
        setDetails(res.data);
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      } else {
        if (!hasCache) setError(res.error ?? "Failed to load attendance details.");
      }
    } catch (e) {
      if (!hasCache) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }

  useEffect(() => {
    load();
  }, [classId, record]);

  const isLab = record?.courseType.trim().toUpperCase().includes("LAB");
  const multiplier = isLab ? 2 : 1;

  const presentSlots = details.filter((d) => {
    const s = d.status.trim().toLowerCase();
    return s === "present" || s === "p" || s === "1";
  }).length;

  const absentSlots = details.filter((d) => {
    const s = d.status.trim().toLowerCase();
    return s === "absent" || s === "a" || s === "0";
  }).length;

  const odSlots = details.filter((d) => {
    const s = d.status.trim().toLowerCase();
    return s.includes("od") || s.includes("duty") || s === "on duty";
  }).length;

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (!record) {
    if (!isOnline || isNetworkError(error, isOnline)) {
      return shell(<OfflineDisplay onRetry={load} />);
    }
    return shell(
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground text-sm">No course data found.</p>
        <button
          onClick={() => navigate("/dashboard/attendance")}
          className="text-xs font-bold text-primary underline underline-offset-2"
        >
          Go back to Attendance
        </button>
      </div>
    );
  }

  if (loading && details.length === 0) {
    return shell(<DetailSkeleton />);
  }

  if (error && details.length === 0) {
    if (!isOnline || isNetworkError(error, isOnline)) {
      return shell(<OfflineDisplay onRetry={load} />);
    }
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  const need = Math.ceil(3 * record.totalClasses - 4 * record.attendedClasses);
  const canSkip = Math.floor((4 * record.attendedClasses - 3 * record.totalClasses) / 3);

  const totalSlots = details.length > 0 ? details.length : Math.ceil(record.totalClasses / multiplier);
  const attendedSlots = details.length > 0 ? (presentSlots + odSlots) : Math.ceil(record.attendedClasses / multiplier);
  const normalPresentSlots = details.length > 0 ? presentSlots : Math.max(0, attendedSlots - odSlots);
  const calculatedAbsentSlots = details.length > 0 ? absentSlots : Math.max(0, totalSlots - attendedSlots);

  const needSlots = need > 0 ? Math.ceil(need / multiplier) : 0;
  const canSkipSlots = canSkip > 0 ? Math.floor(canSkip / multiplier) : 0;

  return shell(
    <div className="w-full space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/20">
        <button
          onClick={() => navigate("/dashboard/attendance")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3 group cursor-pointer bg-transparent border-none p-0"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 duration-150 relative -translate-y-[0.5px]" />
          <span>Back to Attendance</span>
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-extrabold text-primary tracking-widest uppercase">
                {record.courseCode}
              </span>
              <span className="font-mono text-xs font-black text-muted-foreground/60 bg-muted/60 px-2 py-0.5 rounded-md">
                {record.slot}
              </span>
              <span className={`text-xs font-semibold ${getCourseTypeColor(record.courseType)}`}>
                {record.courseType}
              </span>
            </div>
            <h1 className="text-base font-bold text-foreground mt-1 leading-snug">
              {record.courseTitle}
            </h1>
            {record.faculty?.name && (
              <div className="flex items-center gap-1.5 mt-2">
                <User className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                <span className="text-xs text-muted-foreground/70 font-semibold">
                  {record.faculty.name}
                  {record.faculty.school && (
                    <span className="text-muted-foreground/45 font-bold uppercase ml-1.5">· {record.faculty.school}</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Big circular progress */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <BigCircularProgress percentage={record.attendancePercentage} />
            <p className="text-xs text-muted-foreground/60 font-semibold uppercase tracking-wider">Attendance</p>
          </div>
        </div>
      </header>

      {/* ── Summary Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 py-6 border-y border-border/10">
        
        {/* Total Slots */}
        <div className="flex flex-col gap-1.5 pl-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Slots</span>
          </div>
          <span className="text-2xl font-bold text-foreground leading-none mt-1">{totalSlots}</span>
        </div>

        {/* Present */}
        <div className="flex flex-col gap-1.5 pl-2 border-l border-border/10">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Present</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground leading-none">{normalPresentSlots}</span>
          </div>
        </div>

        {/* OD Slots */}
        <div className="flex flex-col gap-1.5 pl-2 border-none sm:border-l sm:border-border/10">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[7px] font-bold shrink-0 border border-primary/20">OD</span>
            <span className="text-xs font-bold uppercase tracking-wider">OD Slots</span>
          </div>
          <span className="text-2xl font-bold text-primary leading-none mt-1">{odSlots}</span>
        </div>

        {/* Absent */}
        <div className="flex flex-col gap-1.5 pl-2 border-l border-border/10">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Absent</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground leading-none">{calculatedAbsentSlots}</span>
          </div>
        </div>

        {/* Can Miss / Need */}
        <div className="flex flex-col gap-1.5 pl-2 border-none sm:border-l sm:border-border/10 col-span-2 sm:col-span-1 border-t border-border/10 pt-4 sm:border-t-0 sm:pt-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {needSlots > 0 ? "Need to Attend" : "Can Miss"}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
            {needSlots > 0 ? (
              <>
                <span className="text-2xl font-bold text-destructive leading-none">{needSlots}</span>
                <span className="text-xs text-muted-foreground/60 font-semibold">slots to reach 75%</span>
              </>
            ) : canSkipSlots > 0 ? (
              <>
                <span className="text-2xl font-bold text-chart-2 leading-none">{canSkipSlots}</span>
                <span className="text-xs text-muted-foreground/60 font-semibold">slots safely</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-foreground leading-none">0</span>
                <span className="text-xs text-muted-foreground/60 font-semibold">On track at 75%</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Date-wise Log ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/20 mb-1">
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">Session Log</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{details.length} sessions recorded</p>
          </div>
        </div>

        {details.length === 0 ? (
          !isOnline || isNetworkError(error, isOnline) ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <WifiOff className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm font-bold text-foreground">Session logs unavailable offline</p>
              <p className="text-xs text-muted-foreground">Connect to the internet to load detailed session logs for this class.</p>
              <button
                onClick={() => load(true)}
                disabled={isRetrying || loading || !isOnline}
                className="mt-1 min-w-[144px] h-9 px-4 py-2 rounded-md bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-all border border-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center text-center shrink-0"
              >
                {isRetrying ? "Connecting..." : !isOnline ? "Offline" : "Retry Connection"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-sm font-bold text-foreground">No session data available</p>
              <p className="text-xs text-muted-foreground">Detailed log hasn't been recorded yet.</p>
            </div>
          )
        ) : (
          <div className="space-y-1.5 pt-2">
            {details.map((row, i) => (
              <div
                key={`${row.serialNo}-${i}`}
                className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-md hover:bg-muted/10 transition-colors duration-150 border border-transparent hover:border-border/20"
              >
                {/* Serial */}
                <span className="text-xs font-bold text-muted-foreground/35 tabular-nums w-5 shrink-0 text-right">
                  {row.serialNo ?? i + 1}
                </span>

                {/* Date */}
                <div className="min-w-0 w-24 sm:w-28 shrink-0">
                  <p className="text-xs font-bold text-foreground truncate">{row.date}</p>
                </div>

                {/* Slot */}
                <div className="shrink-0 w-14 sm:w-16">
                  <span className="font-mono text-xs font-black text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-md leading-none">
                    {row.slot}
                  </span>
                </div>

                {/* Day & Time */}
                <div className="flex-1 min-w-0 hidden sm:block">
                  <p className="text-xs text-muted-foreground/70 font-medium truncate">{row.dayAndTime}</p>
                </div>

                {/* Status badge */}
                <div className="shrink-0 ml-auto">
                  <StatusBadge status={row.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
