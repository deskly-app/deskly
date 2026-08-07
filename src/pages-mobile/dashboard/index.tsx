import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { invoke } from "@tauri-apps/api/core";
import { getStudentProfile, getFeedbackStatus, getStudentGradeView, ProfileData } from "@/lib/features";
import {
  BookOpen,
  Clock,
  FileText,
  ClipboardList,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import dashboardImg from "@/assets/dashboard.png";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStudentName(name: string | undefined) {
  if (!name) return "Student";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning,";
  if (hour >= 12 && hour < 17) return "Good afternoon,";
  return "Good evening,";
}

function parseFeedbackText(text: string) {
  const n = text.toLowerCase();
  const isGiven =
    (n.includes("given") && !n.includes("not given")) || n.includes("submitted");
  return { isGiven };
}

function getCubicBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) * 0.15;
    const cp1y = p1.y + (p2.y - p0.y) * 0.15;
    const cp2x = p2.x - (p3.x - p1.x) * 0.15;
    const cp2y = p2.y - (p3.y - p1.y) * 0.15;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CgpaData = {
  currentCgpa: number;
  earnedCredits: number;
  totalCreditsRequired: number;
  nonGradedCore: number;
};

type FeedbackStatus = {
  type: string;
  midSemester: string;
  teeSemester: string;
};

type GpaTrendPoint = {
  id: string;
  name: string;
  gpa: number;
};

// ─── API ──────────────────────────────────────────────────────────────────────

async function getCgpaPage(): Promise<{ success: boolean; cgpaData?: CgpaData; error?: string }> {
  try {
    return await invoke("get_cgpa_page");
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 px-1 py-2 animate-pulse font-saira">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>

      {/* CGPA block */}
      <div className="space-y-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-16 w-56" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>

      {/* Graph Skeleton */}
      <Skeleton className="h-44 w-full rounded-[28px]" />
    </div>
  );
}

function GpaTrendGraph({ points }: { points: GpaTrendPoint[] }) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(points.length - 1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      // Auto scroll to latest semester on mount/data change
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [points]);

  if (!points || points.length === 0) return null;

  const gpaValues = points.map((p) => p.gpa);
  const highestGpa = Math.max(...gpaValues);
  const avgGpa = gpaValues.reduce((a, b) => a + b, 0) / points.length;
  const latestGpa = points[points.length - 1].gpa;

  const minGpa = Math.max(0, Math.floor(Math.min(...gpaValues) - 0.8));
  const maxGpa = 10;
  const range = maxGpa - minGpa || 1;

  const pointSpacing = 65;
  const paddingX = 35;
  const paddingY = 24;
  
  const width = Math.max(340, paddingX * 2 + (points.length - 1) * pointSpacing);
  const height = 150;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2 - 15; // reserve space for bottom label

  const coords = points.map((pt, i) => {
    const x = paddingX + (i / Math.max(1, points.length - 1)) * chartWidth;
    const y = paddingY + chartHeight - ((pt.gpa - minGpa) / range) * chartHeight;
    const prevGpa = i > 0 ? points[i - 1].gpa : null;
    const diff = prevGpa !== null ? pt.gpa - prevGpa : null;
    return { x, y, pt, diff };
  });

  const smoothLinePath = getCubicBezierPath(coords.map((c) => ({ x: c.x, y: c.y })));
  const activeIdx = activePointIndex !== null && coords[activePointIndex] ? activePointIndex : coords.length - 1;
  const active = coords[activeIdx];

  return (
    <div className="bg-gradient-to-br from-card/90 to-card/45 border border-border/15 p-5 rounded-[28px] shadow-sm space-y-4 font-saira">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4.5 h-4.5 text-primary shrink-0" />
          <h3 className="text-base font-bold text-foreground leading-none">
            GPA History
          </h3>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted/40 border border-border/30 rounded-full px-2 py-0.5">
          {points.length} Semesters
        </span>
      </div>

      {/* Hero Metrics Row */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 border border-border/30 rounded-lg">
        <div className="text-center space-y-0.5">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Latest</span>
          <span className="text-sm font-black text-foreground">{latestGpa.toFixed(2)}</span>
        </div>
        <div className="text-center space-y-0.5 border-x border-border/30">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Peak</span>
          <span className="text-sm font-black text-primary">{highestGpa.toFixed(2)}</span>
        </div>
        <div className="text-center space-y-0.5">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Average</span>
          <span className="text-sm font-black text-foreground">{avgGpa.toFixed(2)}</span>
        </div>
      </div>

      {/* Selected Node Details Bar */}
      {active && (
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-semibold text-muted-foreground truncate">{active.pt.name}</span>
          <div className="flex items-center gap-2 font-bold shrink-0">
            <span className="text-foreground">{active.pt.gpa.toFixed(2)} GPA</span>
            {active.diff !== null && (
              <span className={active.diff >= 0 ? "text-emerald-500" : "text-rose-500"}>
                {active.diff >= 0 ? `(+${active.diff.toFixed(2)})` : `(${active.diff.toFixed(2)})`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Horizontally Scrollable SVG Graph */}
      <div ref={scrollContainerRef} className="relative w-full pt-1 px-1 overflow-x-auto no-scrollbar scroll-smooth">
        <div style={{ width: `${width}px` }} className="h-[150px]">
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="w-full h-full overflow-visible">
            {/* Dashed Gridlines */}
            {[10, 8, 6].filter((v) => v >= minGpa && v <= maxGpa).map((val) => {
              const y = paddingY + chartHeight - ((val - minGpa) / range) * chartHeight;
              return (
                <g key={val}>
                  <line
                    x1={paddingX - 15}
                    y1={y}
                    x2={width - paddingX + 15}
                    y2={y}
                    stroke="var(--border)"
                    strokeOpacity="0.4"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text x={paddingX - 18} y={y + 3} textAnchor="end" className="text-[10px] font-semibold fill-muted-foreground">
                    {val}.0
                  </text>
                </g>
              );
            })}

            {/* Clean Line Path (No gradient fill underneath) */}
            <path
              d={smoothLinePath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Point Nodes */}
            {coords.map((c, i) => {
              const isSelected = activeIdx === i;
              return (
                <g key={c.pt.id} onClick={() => setActivePointIndex(i)} className="cursor-pointer">
                  {isSelected && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="8"
                      fill="var(--primary)"
                      fillOpacity="0.15"
                    />
                  )}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isSelected ? "4.5" : "3"}
                    fill={isSelected ? "var(--background)" : "var(--primary)"}
                    stroke="var(--primary)"
                    strokeWidth={isSelected ? "2.5" : "0"}
                    className="transition-all duration-150"
                  />
                  <text
                    x={c.x}
                    y={c.y - 9}
                    textAnchor="middle"
                    className={`text-xs font-bold transition-colors ${
                      isSelected ? "fill-primary text-xs" : "fill-foreground/80"
                    }`}
                  >
                    {c.pt.gpa.toFixed(2)}
                  </text>
                  
                  {/* Inline Semester Label under each point */}
                  <text
                    x={c.x}
                    y={height - 8}
                    textAnchor="middle"
                    className={`text-[8.5px] font-extrabold tracking-tight transition-colors ${
                      isSelected ? "fill-primary font-black" : "fill-muted-foreground/45"
                    }`}
                  >
                    {c.pt.name.replace("Semester", "").replace("20", "").trim()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MobileDashboardHome() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();

  type DashboardData = {
    cgpaData: CgpaData | null;
    feedbackData: FeedbackStatus[] | null;
    profile: ProfileData | null;
    gpaTrend: GpaTrendPoint[];
  };

  const fetchDashboardData = async (): Promise<{ success: boolean; data?: DashboardData; error?: string }> => {
    try {
      const [cgpaRes, feedbackRes, profileRes, gradeRes] = await Promise.all([
        getCgpaPage(),
        getFeedbackStatus(),
        getStudentProfile().catch(() => null),
        getStudentGradeView().catch(() => null),
      ]);

      let gpaTrend: GpaTrendPoint[] = [];
      if (gradeRes?.success && gradeRes.data) {
        const semesters = gradeRes.data.semesters || [];
        if (semesters.length > 0) {
          const semResults = await Promise.all(
            semesters.map(async (sem) => {
              if (sem.id === gradeRes.data?.semesterSubId) {
                return { id: sem.id, name: sem.name, gpa: gradeRes.data.gpa ?? null };
              }
              const res = await getStudentGradeView(sem.id).catch(() => null);
              return {
                id: sem.id,
                name: sem.name,
                gpa: res?.success && res.data?.gpa !== undefined ? res.data.gpa : null,
              };
            })
          );
          gpaTrend = semResults
            .filter((r): r is { id: string; name: string; gpa: number } => r.gpa !== null && r.gpa !== undefined)
            .reverse();
        }
      }

      // Check if critical fetches failed
      if (!cgpaRes.success && !feedbackRes.success) {
        return { success: false, error: cgpaRes.error || feedbackRes.error };
      }

      return {
        success: true,
        data: {
          cgpaData: cgpaRes.success ? cgpaRes.cgpaData || null : null,
          feedbackData: feedbackRes.success ? feedbackRes.data || null : null,
          profile: profileRes?.success ? profileRes.data || null : null,
          gpaTrend,
        }
      };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  };

  const {
    data,
    loading,
    error,
    retry: loadData,
  } = useOfflineData<DashboardData>({
    cacheKey: "deskly::cache::dashboard",
    fetcher: fetchDashboardData,
    enabled: isLoggedIn && !authLoading,
  });

  const profile = data?.profile ?? null;
  const cgpaData = data?.cgpaData ?? null;
  const feedbackData = data?.feedbackData ?? null;
  const gpaTrend = data?.gpaTrend ?? [];

  const studentName = formatStudentName(profile?.student?.name);

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("default", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  const showOffline = !cgpaData && !feedbackData && !profile && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline && !loading) {
    return <OfflineDisplay onRetry={loadData} />;
  }

  if (authLoading || (loading && !cgpaData && !feedbackData)) {
    return <DashboardSkeleton />;
  }

  const creditPct = cgpaData
    ? ((cgpaData.earnedCredits / cgpaData.totalCreditsRequired) * 100).toFixed(1)
    : "0";

  return (
    <div className="w-full space-y-7 px-0 pt-2 pb-6 font-saira select-none overscroll-y-contain relative">
      {/* Google Font Saira Injection */}
      <style>{`
        .font-saira {
          font-family: 'Saira', sans-serif !important;
        }
      `}</style>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[200px] h-[160px] pointer-events-none select-none z-0">
        <img
          src={dashboardImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          style={{
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)"
          }}
          alt="Dashboard Illustration"
        />
      </div>

      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button
            onClick={loadData}
            className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0 pt-2">
          <p className="text-sm font-medium text-muted-foreground/60 leading-none">
            {getGreeting()}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight leading-tight truncate">
            {profile?.student?.name ? studentName : "Student"}
          </h1>
          <p className="text-xs text-muted-foreground/40 leading-none pt-0.5">{formattedDate}</p>
        </div>
      </header>

      {/* ── CGPA Card ───────────────────────────────────────────────────────── */}
      {cgpaData && (
        <section className="relative z-10 space-y-6">
          <div className="bg-gradient-to-br from-card/90 to-card/45 border border-border/15 p-6 rounded-[30px] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-muted-foreground/50 uppercase leading-none">
                Cumulative GPA
              </span>
            </div>
            
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold text-foreground leading-none tracking-tight">
                {cgpaData.currentCgpa.toFixed(2)}
              </span>
              <span className="text-sm font-medium text-muted-foreground/45 leading-none">/ 10.00</span>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground/60">Credits Completed</span>
                <span className="text-foreground tracking-tight">
                  {cgpaData.earnedCredits} / {cgpaData.totalCreditsRequired} ({creditPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{
                    width: `${(cgpaData.earnedCredits / cgpaData.totalCreditsRequired) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Three Circular Stats Badges */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            {/* Earned */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-[60px] h-[60px] rounded-full border-2 border-t-primary/45 border-x-primary/45 border-b-transparent flex items-center justify-center text-primary shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-lg font-extrabold text-foreground leading-tight">{cgpaData.earnedCredits}</p>
                <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wide">Earned</p>
              </div>
            </div>

            {/* Required */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-[60px] h-[60px] rounded-full border-2 border-t-border border-x-border border-b-transparent flex items-center justify-center text-muted-foreground shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-lg font-extrabold text-foreground leading-tight">{cgpaData.totalCreditsRequired}</p>
                <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wide">Required</p>
              </div>
            </div>

            {/* Non-Graded */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-[60px] h-[60px] rounded-full border-2 border-t-border border-x-border border-b-transparent flex items-center justify-center text-muted-foreground shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-lg font-extrabold text-foreground leading-tight">{cgpaData.nonGradedCore}</p>
                <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wide">Non-Graded</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── GPA Trend Graph ─────────────────────────────────────────────────── */}
      {gpaTrend && gpaTrend.length > 0 && (
        <section className="relative z-10">
          <GpaTrendGraph points={gpaTrend} />
        </section>
      )}

      {/* ── Feedback Status ──────────────────────────────────────────────────── */}
      {feedbackData && feedbackData.length > 0 && (
        <section className="relative z-10 space-y-4">
          <div className="flex items-center justify-between text-foreground">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold tracking-tight leading-none">Feedback</h2>
              <div className="w-6 h-0.5 bg-foreground rounded" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {feedbackData.map((item, idx) => {
              const isCurriculum = item.type.toLowerCase().includes("curriculum");
              const label = isCurriculum ? "Content Feedback" : "General Feedback";
              const mid = parseFeedbackText(item.midSemester);
              const tee = parseFeedbackText(item.teeSemester);
              const Icon = isCurriculum ? FileText : ClipboardList;
              const iconColor = "text-primary bg-primary/10";

              return (
                <div
                  key={idx}
                  className="bg-gradient-to-br from-card/90 to-card/45 border border-border/15 p-4 rounded-xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mr-4 ${iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/45 leading-none truncate">
                        {item.type}
                      </p>
                      <h3 className="text-[13.5px] font-bold text-foreground leading-none">{label}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold leading-none pt-0.5">
                        <span>Mid:</span>
                        <span className={mid.isGiven ? "text-primary" : "text-destructive font-extrabold"}>
                          {mid.isGiven ? "Given" : "Pending"}
                        </span>
                        <span className="text-muted-foreground/15">|</span>
                        <span>TEE:</span>
                        <span className={tee.isGiven ? "text-primary" : "text-destructive font-extrabold"}>
                          {tee.isGiven ? "Given" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
