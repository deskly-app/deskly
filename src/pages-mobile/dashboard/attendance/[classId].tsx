import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useParams, useNavigate } from "@/router";
import { getAttendanceDetail, AttendanceDetailRecord, AttendanceRecord } from "@/lib/attendance";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import { Calendar, WifiOff, CheckCircle2, XCircle, Clock, User, BarChart3, Award } from "lucide-react";
import { OfflineDisplay } from "@/components/offline-display";
import { useOnlineStatus } from "@/hooks/use-online-status";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatCourseType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("embedded theory") || t.includes("theory")) return "Theory";
  if (t.includes("embedded lab") || t.includes("lab")) return "Lab";
  return type.trim();
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
      <div className="grid grid-cols-6 gap-6 py-6 border-y border-border/10">
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
    data: detailsData,
    loading,
    error,
    retry: load,
  } = useOfflineData<AttendanceDetailRecord[]>({
    cacheKey: `deskly::cache::attendance_detail_${classId}`,
    fetcher: () => getAttendanceDetail(classId!, record!.slot),
    enabled: !!classId && !!record,
  });

  const details = detailsData || [];
  const isRetrying = loading;

  if (loading && !record) {
    return <DetailSkeleton />;
  }

  if (!record) {
    if (!isOnline || isNetworkError(error, isOnline)) {
      return <OfflineDisplay onRetry={load} />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
        <p className="text-muted-foreground text-sm">No course data found.</p>
        <button
          onClick={() => navigate("/dashboard/attendance")}
          className="text-xs font-semibold text-primary underline underline-offset-2 bg-transparent border-none cursor-pointer"
        >
          Go back to Attendance
        </button>
      </div>
    );
  }

  const isLab = record.courseType.toLowerCase().includes("lab");
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

  const totalSlots = details.length > 0 ? details.length : Math.ceil(record.totalClasses / multiplier);
  const attendedSlots = details.length > 0 ? (presentSlots + odSlots) : Math.ceil(record.attendedClasses / multiplier);
  const normalPresentSlots = details.length > 0 ? presentSlots : Math.max(0, attendedSlots - odSlots);
  const calculatedAbsentSlots = details.length > 0 ? absentSlots : Math.max(0, totalSlots - attendedSlots);

  const need = Math.ceil(3 * record.totalClasses - 4 * record.attendedClasses);
  const canSkip = Math.floor((4 * record.attendedClasses - 3 * record.totalClasses) / 3);

  const needSlots = need > 0 ? Math.ceil(need / multiplier) : 0;
  const canSkipSlots = canSkip > 0 ? Math.floor(canSkip / multiplier) : 0;

  return (
    <div className="w-full space-y-6 px-2 py-4 select-none relative">
      
      {/* ── Header ── */}
      <header className="pb-4">

        {/* Header content: Stacks vertically on mobile */}
        <div className="flex flex-col items-center justify-between gap-6 w-full">
          <div className="min-w-0 space-y-1.5 text-left w-full">
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
          <div className="shrink-0 flex flex-col items-center gap-1 self-center">
            <BigCircularProgress percentage={record.attendancePercentage} />
            <p className="text-[10px] text-muted-foreground/45 font-bold uppercase tracking-wider">Attendance</p>
          </div>
        </div>
      </header>

      {/* ── Summary Stats Grid (2 horizontal rows on mobile: Row 1 has 3 items, Row 2 has 2 items) ── */}
      <div className="grid grid-cols-6 py-6 border-t border-border/10 gap-y-6">
        
        {/* Total Slots */}
        <div className="col-span-2 flex flex-col gap-1.5 pl-2">
          <span className="text-2xl font-black text-foreground leading-none">{totalSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Slots</span>
          </div>
        </div>

        {/* Present */}
        <div className="col-span-2 flex flex-col gap-1.5 pl-4 border-l border-border/10">
          <span className="text-2xl font-black text-foreground leading-none">{normalPresentSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Present</span>
          </div>
        </div>

        {/* OD Slots */}
        <div className="col-span-2 flex flex-col gap-1.5 pl-4 border-l border-border/10">
          <span className="text-2xl font-black text-primary leading-none">{odSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <Award className="w-3.5 h-3.5 text-primary shrink-0 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider">OD Slots</span>
          </div>
        </div>

        {/* Absent */}
        <div className="col-span-3 flex flex-col gap-1.5 pt-4 pl-2 border-t border-border/10">
          <span className="text-2xl font-black text-foreground leading-none">{calculatedAbsentSlots}</span>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Absent</span>
          </div>
        </div>

        {/* Can Miss / Need to Attend */}
        <div className="col-span-3 flex flex-col gap-1.5 pt-4 pl-4 border-t border-l border-border/10">
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

      {/* ── Session Log Section ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/10">
          <div>
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">Session Log</h2>
            <p className="text-xs text-muted-foreground/60 font-semibold">{details.length} sessions recorded</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Sk key={i} className="h-16 w-full rounded" />
            ))}
          </div>
        ) : details.length === 0 ? (
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
                className="flex items-center gap-3 py-3 px-1 rounded-md transition-colors hover:bg-muted/5 duration-150"
              >
                {/* Serial */}
                <span className="text-xs font-bold text-muted-foreground/35 tabular-nums w-5 shrink-0 leading-none">
                  {row.serialNo ?? i + 1}
                </span>

                {/* Date & Time */}
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                  <span className="text-[13px] font-bold text-foreground truncate leading-none">{row.date}</span>
                  {row.dayAndTime && (
                    <span className="text-[10px] font-medium text-muted-foreground truncate leading-none">{row.dayAndTime.replace(",", ", ").replace("-", " - ")}</span>
                  )}
                </div>

                {/* Slot */}
                <div className="shrink-0 w-14 flex items-center">
                  <span className="font-mono text-xs font-bold text-foreground/80 leading-none">
                    {row.slot}
                  </span>
                </div>

                {/* Status badge */}
                <div className="shrink-0 ml-auto flex items-center">
                  <StatusBadge status={row.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
