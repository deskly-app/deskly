import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useParams, useNavigate } from "@/router";
import { getAttendanceDetail, AttendanceDetailRecord, AttendanceRecord } from "@/lib/attendance";
import { isNetworkError } from "@/lib/utils";
import { OfflineDisplay } from "@/components/offline-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { ErrorDisplay } from "@/components/error-display";
import { useOfflineData } from "@/hooks/use-offline-data";
import {
  ArrowLeft,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  BarChart3,
  WifiOff,
  Award,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatCourseType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("embedded theory") || t.includes("theory")) return "Theory";
  if (t.includes("embedded lab") || t.includes("lab")) return "Lab";
  return type.trim();
}

function formatDayAndTime(raw: string) {
  if (!raw) return "";
  const parts = raw.split(",");
  if (parts.length < 2) return raw;
  const dayRaw = parts[0].trim();
  const timeRaw = parts[1].trim();

  const day = dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1).toLowerCase();
  const times = timeRaw.split("-");
  if (times.length < 2) {
    return `${day} · ${timeRaw}`;
  }

  const formatTime = (t: string) => {
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mStr} ${ampm}`;
  };

  return `${day} · ${formatTime(times[0])} – ${formatTime(times[1])}`;
}

// ─── Circular Arc Progress ────────────────────────────────────────────────────
function BigCircularProgress({ percentage }: { percentage: number }) {
  const size = 80;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  const stroke = percentage >= 75 ? "text-emerald-500" : "text-destructive";

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle className="text-muted/20 stroke-current" strokeWidth="5.5" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className={`${stroke} stroke-current transition-all duration-700`}
          strokeWidth="5.5"
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
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full leading-none whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Present
      </span>
    );
  }
  if (isAbsent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive bg-destructive/10 px-3 py-1 rounded-full leading-none whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5" />
        Absent
      </span>
    );
  }
  if (isOd) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full leading-none whitespace-nowrap">
        <Award className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full leading-none whitespace-nowrap">
      <Clock className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="w-full space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-border/20">
        <Sk className="w-8 h-8 rounded" />
        <div className="space-y-2 flex-1">
          <Sk className="h-5 w-48" />
          <Sk className="h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-6 lg:grid-cols-5 gap-6 py-6 border-y border-border/10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="pl-2 space-y-2 border-l border-border/10 first:border-0">
            <Sk className="h-3 w-14" />
            <Sk className="h-6 w-10 mt-1" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5 pt-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Sk className="h-3 w-5" />
            <Sk className="h-3.5 w-24" />
            <Sk className="h-4 w-14 rounded" />
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

  const {
    data: detailsRaw,
    loading,
    error,
    retry: load,
  } = useOfflineData<AttendanceDetailRecord[]>({
    cacheKey: classId ? `deskly::cache::attendance_detail_${classId}` : "",
    fetcher: () => getAttendanceDetail(classId!, record!.slot),
    enabled: !!classId && !!record,
  });

  const details = useMemo(() => detailsRaw || [], [detailsRaw]);
  const isRetrying = loading && details.length > 0;

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
    <div className="w-full space-y-6">

      {/* ── Header ── */}
      <header className="pb-4 border-b border-border/10">
        <button
          onClick={() => navigate("/dashboard/attendance")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3 group cursor-pointer bg-transparent border-none p-0"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 duration-150 relative -translate-y-[0.5px]" />
          <span>Back to Attendance</span>
        </button>

        {/* Header content: Stacks vertically on mobile, side-by-side on desktop (md+) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
          <div className="min-w-0 space-y-1.5 text-left w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 flex-wrap">
              <span className="font-bold text-foreground uppercase tracking-wider">
                {record.courseCode}
              </span>
              <span>·</span>
              <span className="font-semibold uppercase text-foreground/80 leading-none">{record.slot}</span>
              <span>·</span>
              <span className="uppercase">{formatCourseType(record.courseType)}</span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-snug tracking-tight">
              {record.courseTitle}
            </h1>
            {record.faculty?.name && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
                <span className="text-xs text-muted-foreground/50 font-medium">
                  {record.faculty.name}
                  {record.faculty.school && (
                    <span className="text-muted-foreground/45 font-bold uppercase ml-1.5">· {record.faculty.school}</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Big circular progress aligned vertically/centered on mobile */}
          <div className="shrink-0 flex flex-col items-center gap-1 self-center md:self-auto">
            <BigCircularProgress percentage={record.attendancePercentage} />
            <p className="text-[10px] text-muted-foreground/45 font-bold uppercase tracking-wider">Attendance</p>
          </div>
        </div>
      </header>

      {/* ── Summary Stats Grid (2 horizontal rows on smaller screens, 5 columns on desktop lg+) ── */}
      <div className="grid grid-cols-6 lg:grid-cols-5 gap-y-6 py-6 border-y border-border/10">
        
        {/* Total Slots */}
        <div className="col-span-2 lg:col-span-1 flex flex-col gap-1.5 pl-2">
          <span className="text-2xl font-black text-foreground leading-none">{totalSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Slots</span>
          </div>
        </div>

        {/* Present */}
        <div className="col-span-2 lg:col-span-1 flex flex-col gap-1.5 pl-4 border-l border-border/10">
          <span className="text-2xl font-black text-foreground leading-none">{normalPresentSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Present</span>
          </div>
        </div>

        {/* OD Slots */}
        <div className="col-span-2 lg:col-span-1 flex flex-col gap-1.5 pl-4 border-l border-border/10">
          <span className="text-2xl font-black text-primary leading-none">{odSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <Award className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">OD Slots</span>
          </div>
        </div>

        {/* Absent */}
        <div className="col-span-3 lg:col-span-1 flex flex-col gap-1.5 pt-4 lg:pt-0 pl-2 lg:pl-6 border-t lg:border-t-0 lg:border-l border-border/10">
          <span className="text-2xl font-black text-foreground leading-none">{calculatedAbsentSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Absent</span>
          </div>
        </div>

        {/* Can Miss / Need to Attend */}
        <div className="col-span-3 lg:col-span-1 flex flex-col gap-1.5 pt-4 lg:pt-0 pl-4 lg:pl-6 border-t lg:border-t-0 border-l lg:border-l border-border/10">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className={`text-2xl font-black leading-none ${needSlots > 0 ? "text-destructive" : canSkipSlots > 0 ? "text-emerald-500" : "text-foreground"}`}>
              {needSlots > 0 ? needSlots : canSkipSlots > 0 ? canSkipSlots : 0}
            </span>
            {needSlots > 0 ? (
              <span className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider">to 75%</span>
            ) : canSkipSlots > 0 ? (
              <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-wider">to skip</span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {needSlots > 0 ? "Need to Attend" : "Can Miss"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Date-wise Log ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/10">
          <div>
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">Session Log</h2>
            <p className="text-xs text-muted-foreground/60 font-semibold">{details.length} sessions recorded</p>
          </div>
        </div>

        {details.length === 0 ? (
          !isOnline || isNetworkError(error, isOnline) ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <WifiOff className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm font-bold text-foreground">Session logs offline</p>
              <p className="text-xs text-muted-foreground">Connect to network to sync detailed logs.</p>
              <button
                onClick={() => load()}
                disabled={isRetrying || loading || !isOnline}
                className="mt-1 min-w-[144px] h-9 px-4 py-2 rounded-md bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-all border border-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center text-center shrink-0"
              >
                {isRetrying ? "Connecting..." : !isOnline ? "Offline" : "Retry Connection"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-sm font-bold text-foreground">No sessions</p>
              <p className="text-xs text-muted-foreground">Detailed log hasn't been synced.</p>
            </div>
          )
        ) : (
          <div className="flex flex-col divide-y divide-border/10">
            {details.map((row, i) => (
              <div
                key={`${row.serialNo}-${i}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 px-1 rounded-md transition-colors hover:bg-muted/5 duration-150"
              >
                {/* Top line (mobile) / Left part (desktop) */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Serial */}
                  <span className="text-xs font-bold text-muted-foreground/35 tabular-nums w-5 shrink-0 text-right leading-none">
                    {row.serialNo ?? i + 1}
                  </span>

                  {/* Date */}
                  <div className="min-w-0 w-24 sm:w-28 shrink-0">
                    <span className="text-xs font-bold text-foreground truncate block leading-none">{row.date}</span>
                  </div>

                  {/* Slot */}
                  <div className="shrink-0 w-14 sm:w-16">
                    <span className="font-mono text-xs font-bold text-foreground/80 block leading-none">
                      {row.slot}
                    </span>
                  </div>

                  {/* Day & Time (desktop) */}
                  <div className="flex-1 min-w-0 hidden sm:block">
                    <span className="text-xs text-muted-foreground/50 font-medium truncate block leading-none">
                      {formatDayAndTime(row.dayAndTime)}
                    </span>
                  </div>
                </div>

                {/* Bottom line (mobile only) / Right part (desktop) */}
                <div className="flex items-center justify-between sm:justify-end gap-4 pl-8 sm:pl-0 shrink-0">
                  {/* Day & Time (mobile) */}
                  <span className="text-xs text-muted-foreground/50 font-medium sm:hidden leading-none">
                    {formatDayAndTime(row.dayAndTime)}
                  </span>
                  
                  {/* Status badge */}
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
