import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentAttendance, AttendanceRecord } from "@/lib/attendance";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
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
  return pct >= 75 ? "text-emerald-500" : "text-destructive";
}

function getCircleStrokeColor(pct: number) {
  return pct >= 75 ? "stroke-emerald-500" : "stroke-destructive";
}

function getBarBgColor(pct: number) {
  return pct >= 75 ? "bg-emerald-500" : "bg-destructive";
}

function formatCourseType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("embedded theory") || t.includes("theory")) return "Theory";
  if (t.includes("embedded lab") || t.includes("lab")) return "Lab";
  return type.trim();
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
      <span className="text-xs font-semibold text-destructive">
        ↑ {need} more {need === 1 ? unit : unitPlural} to reach 75%
      </span>
    );
  }
  if (canSkip === 0) {
    const nextSkipNeed = isLab 
      ? Math.ceil((3 * total - 4 * attended + 6) / 2)
      : (3 * total - 4 * attended + 3);
    return (
      <span className="text-xs font-semibold text-emerald-500">
        Can skip 1 after {nextSkipNeed} {nextSkipNeed === 1 ? unit : unitPlural}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-emerald-500">
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
    <div className="space-y-6 px-2 py-4 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sk className="w-6 h-6 rounded" />
            <Sk className="h-7 w-40" />
          </div>
        </div>
      </div>
      <Sk className="h-28 w-full rounded" />
      <div className="space-y-3 pt-2">
        <Sk className="h-5 w-36" />
        {[...Array(5)].map((_, i) => (
          <Sk key={i} className="h-20 w-full rounded" />
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
      className="py-4 px-3 rounded-md transition-colors duration-150 hover:bg-muted/10 cursor-pointer flex items-center justify-between gap-4"
    >
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <ListCircularProgress percentage={pct} size={48} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 flex-wrap">
            <span className="font-bold text-foreground uppercase tracking-wider">
              {item.courseCode}
            </span>
            <span>·</span>
            <span className="font-semibold uppercase text-foreground/80 leading-none">{item.slot}</span>
            <span>·</span>
            <span className="uppercase">{formatCourseType(item.courseType)}</span>
          </div>
          <p className="text-base font-bold text-foreground tracking-tight leading-snug truncate">
            {item.courseTitle}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5 text-right">
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
      <DrawerContent className="pb-8 max-h-[92vh]">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-6">
          
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <ListCircularProgress percentage={pct} size={54} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 leading-none flex-wrap text-xs text-muted-foreground/60">
                  <span className="font-bold text-foreground uppercase tracking-wider">
                    {item.courseCode}
                  </span>
                  <span>·</span>
                  <span className="uppercase">
                    {displayType}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-foreground leading-snug tracking-tight break-words">
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
            <p className="text-[10px] font-bold text-muted-foreground/45 uppercase tracking-widest leading-none">
              Attendance Status
            </p>
            
            <div className="flex items-center gap-4">
              <span className={`text-3xl font-extrabold leading-none ${getPercentageColor(pct)}`}>
                {pct}%
              </span>
              <div className="h-2 flex-1 bg-muted/30 rounded-full overflow-hidden">
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
                {item.courseType.toLowerCase().includes("lab") ? "labs" : "classes"}
              </span>
            </div>
  
            {/* View Full Details button */}
            <button
              onClick={onViewDetail}
              className="w-full flex items-center justify-between mt-3 px-4 py-3 rounded-md bg-muted/10 text-xs font-bold text-foreground hover:bg-muted/15 active:opacity-85 transition-all cursor-pointer border border-border/10"
            >
              <span>View Detailed Session Log</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </button>
          </div>
  
          {/* Course Information Details */}
          <div className="space-y-3 pt-1">
            <p className="text-[10px] font-bold text-muted-foreground/45 uppercase tracking-widest leading-none">
              Course Information
            </p>
 
            <div className="divide-y divide-border/10 border-y border-border/10">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex items-center gap-2 pt-0.5 shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="text-[10px] font-bold text-muted-foreground/45 uppercase tracking-wider leading-none">{label}</span>
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

  const { data: rawData, loading, error, retry: load } = useOfflineData<AttendanceRecord[]>({
    cacheKey: "deskly::cache::attendance",
    fetcher: getCurrentAttendance,
    enabled: isLoggedIn && !authLoading,
  });
  const attendance = rawData || [];

  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
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

  const showOffline = !rawData && !loading && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) {
    return <OfflineDisplay onRetry={load} />;
  }

  if (authLoading || (loading && !rawData)) {
    return <AttendanceSkeleton />;
  }

  if (error && !rawData) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 px-2 py-4 select-none relative">
      
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
      <header className="flex items-center gap-2 pb-3 border-b border-border/10">
        <UserCheck className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">
          My Attendance
        </h1>
      </header>

      {/* Stats Card (Clean borderless overview layout) */}
      <div className="py-5 border-y border-border/10 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        
        {/* Left Stat - Attendance % */}
        <div className="flex items-center justify-center gap-3 min-w-0">
          <StatCircularProgress percentage={stats.overallPercentage} icon={TrendingUp} size={56} strokeWidth={5} />
          <div className="flex flex-col items-center justify-center text-center min-w-0 flex-1">
            <div className="flex items-baseline justify-center gap-0.5 min-w-0">
              <span className="text-2xl font-black tracking-tight text-foreground tabular-nums leading-none">
                {stats.overallPercentage}
              </span>
              <span className="text-sm font-bold text-foreground leading-none">%</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground/45 uppercase tracking-wider mt-1.5 whitespace-nowrap">
              Attendance
            </span>
          </div>
        </div>

        {/* Vertical Separator Line */}
        <Separator orientation="vertical" className="h-10 bg-border/10 shrink-0 self-center" />

        {/* Right Stat - Classes Attended */}
        <div className="flex items-center justify-center gap-3 min-w-0">
          <StatCircularProgress percentage={Math.round((stats.totalAttended / (stats.totalClasses || 1)) * 100)} icon={CalendarDays} size={56} strokeWidth={5} />
          <div className="flex flex-col items-center justify-center text-center min-w-0 flex-1">
            <div className="flex items-baseline justify-center gap-1 min-w-0">
              <span className="text-2xl font-black tracking-tight text-foreground tabular-nums leading-none">
                {stats.totalAttended}
              </span>
              <span className="text-xs font-semibold text-muted-foreground/60 tabular-nums leading-none">
                / {stats.totalClasses}
              </span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground/45 uppercase tracking-wider mt-1.5 whitespace-nowrap">
              Attended
            </span>
          </div>
        </div>

      </div>

      {/* Course List Section */}
      <section className="space-y-4 pt-1">
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/10">
          <div className="space-y-0.5">
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
              Course Attendance
            </h2>
            <p className="text-xs text-muted-foreground/60 font-semibold">{filteredAttendance.length} courses</p>
          </div>

          <DrawerSelect
            value={filterType}
            onValueChange={setFilterType}
            title="Filter Courses"
            triggerClassName="h-8 px-3 text-xs font-bold"
            options={[
              { value: "all", label: "All Courses" },
              { value: "theory", label: "Theory Only" },
              { value: "lab", label: "Lab Only" },
            ]}
          />
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
      <div className="pt-2 border-t border-border/10">
        <div className="py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Trophy className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-bold text-foreground leading-none">Keep it up!</p>
              <p className="text-xs text-muted-foreground/50 font-medium leading-tight">
                Maintain 75%+ overall attendance.
              </p>
            </div>
          </div>
          <div className="w-14 h-7 shrink-0 flex items-center justify-center opacity-70">
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
