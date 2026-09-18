import { useMemo, useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { invoke } from "@tauri-apps/api/core";
import { Link } from "react-router-dom";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import { getStudentProfile, getStudentGradeView, ProfileData } from "@/lib/features";
import {
  MessageSquare,
  Calendar,
  BookOpen,
  FileText,
  Clock,
  Settings,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CgpaData = {
  totalCreditsRequired: number;
  earnedCredits: number;
  currentCgpa: number;
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

async function getCgpaPage() {
  try {
    return await invoke<{ success: boolean; cgpaData?: CgpaData; error?: string }>("get_cgpa_page");
  } catch (e: unknown) {
    return { success: false, error: String(e) };
  }
}

async function getFeedbackStatus() {
  try {
    return await invoke<{ success: boolean; data?: FeedbackStatus[]; error?: string }>("feedback_get_status");
  } catch (e: unknown) {
    return { success: false, error: String(e) };
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatStudentName(n: string | undefined) {
  if (!n) return "";
  return n.trim().toLowerCase().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

function parseFeedbackText(text: string) {
  const n = text.toLowerCase();
  return { isGiven: (n.includes("given") && !n.includes("not given")) || n.includes("submitted") };
}

function getCubicBezierPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${(p1.x + (p2.x - p0.x) * 0.15).toFixed(1)} ${(p1.y + (p2.y - p0.y) * 0.15).toFixed(1)}, ${(p2.x - (p3.x - p1.x) * 0.15).toFixed(1)} ${(p2.y - (p3.y - p1.y) * 0.15).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const QUICK_LINKS = [
  { label: "Timetable", path: "/dashboard/timetable", icon: Calendar },
  { label: "Attendance", path: "/dashboard/attendance", icon: BookOpen },
  { label: "My Marks", path: "/dashboard/marks", icon: FileText },
  { label: "Academic Calendar", path: "/dashboard/academic-calendar", icon: Clock },
  { label: "Settings", path: "/dashboard/settings", icon: Settings },
];

// ─── GPA Graph ────────────────────────────────────────────────────────────────

function GpaTrendGraph({ points }: { points: GpaTrendPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState(points.length - 1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(Math.floor(el.getBoundingClientRect().width));
    const obs = new ResizeObserver(([e]) => setContainerW(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!points || points.length === 0) return null;

  const H = 180;
  const PX = 36;
  const PT = 24;
  const PB = 30;
  const CW = Math.max(0, containerW - PX * 2);
  const CH = H - PT - PB;

  const gpas = points.map((p) => p.gpa);
  const minG = Math.max(0, Math.floor(Math.min(...gpas) - 0.5));
  const range = 10 - minG || 1;

  const coords = points.map((pt, i) => ({
    x: PX + (i / Math.max(1, points.length - 1)) * CW,
    y: PT + CH - ((pt.gpa - minG) / range) * CH,
    diff: i > 0 ? pt.gpa - points[i - 1].gpa : null,
    pt,
  }));

  const pathD = getCubicBezierPath(coords.map((c) => ({ x: c.x, y: c.y })));
  const active = coords[activeIdx] ?? coords[coords.length - 1];
  const gridVals = [6, 7, 8, 9, 10].filter((v) => v >= minG);
  const latest = points[points.length - 1].gpa;
  const peak = Math.max(...gpas);
  const avg = gpas.reduce((a, b) => a + b, 0) / gpas.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Semester Performance
          </p>
          <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight mt-0.5">
            GPA History
          </h2>
        </div>
        {/* Compact metrics */}
        <div className="flex divide-x divide-border/20 border border-border/20 rounded-lg overflow-hidden shrink-0">
          {[
            { label: "Latest", val: latest, primary: false },
            { label: "Peak", val: peak, primary: true },
            { label: "Avg", val: avg, primary: false },
          ].map((m) => (
            <div key={m.label} className="px-3 sm:px-4 py-2 text-center">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                {m.label}
              </p>
              <p className={`text-sm sm:text-base font-bold leading-none mt-0.5 ${m.primary ? "text-primary" : "text-foreground"}`}>
                {m.val.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Active semester info */}
      {active && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground/50 truncate max-w-[200px]">
            {active.pt.name}
          </span>
          <span className="text-xs sm:text-sm font-bold text-foreground">
            {active.pt.gpa.toFixed(2)} GPA
          </span>
          {active.diff !== null && (
            <span className={`text-xs sm:text-sm font-semibold ${active.diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {active.diff >= 0 ? `+${active.diff.toFixed(2)}` : active.diff.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div ref={containerRef} className="w-full">
        {containerW > 0 && (
          <svg width={containerW} height={H} className="block overflow-visible">
            {gridVals.map((v) => {
              const y = PT + CH - ((v - minG) / range) * CH;
              return (
                <g key={v}>
                  <line x1={PX - 6} y1={y} x2={containerW - PX + 6} y2={y}
                    stroke="var(--border)" strokeOpacity={0.25} strokeDasharray="4 5" strokeWidth={0.8} />
                  <text x={PX - 10} y={y + 4} textAnchor="end" fontSize={10}
                    fill="var(--muted-foreground)" opacity={0.7} fontFamily="system-ui">{v}</text>
                </g>
              );
            })}

            {pathD && (
              <path d={pathD} fill="none" stroke="var(--primary)"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}

            {coords.map((c, i) => {
              const sel = activeIdx === i;
              return (
                <g key={c.pt.id} onClick={() => setActiveIdx(i)} style={{ cursor: "pointer" }}>
                  {sel && <circle cx={c.x} cy={c.y} r={10} fill="var(--primary)" fillOpacity={0.08} />}
                  <circle cx={c.x} cy={c.y} r={sel ? 4.5 : 3}
                    fill={sel ? "var(--background)" : "var(--primary)"}
                    stroke="var(--primary)" strokeWidth={sel ? 2 : 0} />
                  <text x={c.x} y={c.y - 11} textAnchor="middle" fontSize={11}
                    fontWeight={sel ? 700 : 500} fill="var(--foreground)"
                    opacity={sel ? 1 : 0.75} fontFamily="system-ui">
                    {c.pt.gpa.toFixed(2)}
                  </text>
                  <text x={c.x} y={H - 6} textAnchor="middle" fontSize={10}
                    fontWeight={sel ? 600 : 400}
                    fill={sel ? "var(--primary)" : "var(--muted-foreground)"}
                    opacity={sel ? 0.9 : 0.65} fontFamily="system-ui">
                    {c.pt.name.replace(/semester/gi, "").replace(/20\d\d/g, "").trim() || c.pt.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="w-full space-y-8 sm:space-y-10">
      <div className="pb-6 sm:pb-8 border-b border-border/10 space-y-3">
        <Sk className="h-3 w-24" />
        <Sk className="h-10 sm:h-14 w-48 sm:w-64" />
        <Sk className="h-3 w-36" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] items-start">
        <div className="pr-0 lg:pr-12 space-y-8 sm:space-y-10">
          <div className="space-y-5">
            <Sk className="h-3 w-20" />
            <Sk className="h-14 sm:h-20 w-40 sm:w-52" />
            <div className="space-y-2 max-w-xl">
              <div className="flex justify-between"><Sk className="h-3 w-24" /><Sk className="h-3 w-20" /></div>
              <Sk className="h-px w-full" />
            </div>
            <div className="grid grid-cols-3 max-w-xl pt-5 border-t border-border/10">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Sk className="h-2.5 w-14" /><Sk className="h-7 w-10" /><Sk className="h-2.5 w-12" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 border-t border-border/10 pt-6 sm:pt-8">
            <div className="flex justify-between items-center">
              <Sk className="h-5 w-24" /><Sk className="h-9 w-36 rounded-lg" />
            </div>
            <Sk className="h-3 w-44" />
            <Sk className="h-[180px] w-full" />
          </div>
        </div>
        <div className="mt-8 lg:mt-0 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border/10 lg:pl-8 space-y-5">
          <Sk className="h-3 w-20" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-3"><Sk className="h-4 w-4 rounded" /><Sk className="h-3.5 w-24" /></div>
              <Sk className="h-3.5 w-3.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const { isLoggedIn, loading: authLoading } = useAuth();

  const { data: combinedData, loading, error, retry: loadData } = useOfflineData<{
    cgpaData: CgpaData | null;
    feedbackData: FeedbackStatus[] | null;
    profile: ProfileData | null;
    gpaTrend: GpaTrendPoint[];
  }>({
    cacheKey: "deskly::cache::dashboard",
    fetcher: async () => {
      // Stagger requests across the shared connection pool so VTOP isn't overwhelmed
      const profileRes = await getStudentProfile().catch(() => null);
      const cgpaRes = await getCgpaPage().catch((e) => ({ success: false, error: String(e), cgpaData: undefined }));
      const feedbackRes = await getFeedbackStatus().catch((e) => ({ success: false, error: String(e), data: undefined }));
      const gradeRes = await getStudentGradeView().catch(() => null);

      let gpaTrend: GpaTrendPoint[] = [];
      if (gradeRes?.success && gradeRes.data) {
        const sems = gradeRes.data.semesters || [];
        if (sems.length > 0) {
          const results = [];
          for (const sem of sems) {
            if (sem.id === gradeRes.data?.semesterSubId) {
              results.push({ id: sem.id, name: sem.name, gpa: gradeRes.data!.gpa ?? null });
            } else {
              const r = await getStudentGradeView(sem.id).catch(() => null);
              results.push({ id: sem.id, name: sem.name, gpa: r?.success && r.data?.gpa !== undefined ? r.data.gpa : null });
            }
          }
          gpaTrend = results.filter((r): r is GpaTrendPoint => r.gpa !== null).reverse();
        }
      }

      const data = {
        cgpaData: cgpaRes.success && cgpaRes.cgpaData ? cgpaRes.cgpaData : null,
        feedbackData: feedbackRes.success && feedbackRes.data ? feedbackRes.data : null,
        profile: profileRes?.success && profileRes.data ? profileRes.data : null,
        gpaTrend,
      };

      // Only fail the entire screen if ALL critical fetches failed
      if (!cgpaRes.success && !feedbackRes.success && !profileRes?.success) {
        return { success: false, error: cgpaRes.error || feedbackRes.error || "Failed to load dashboard data." };
      }
      return { success: true, data };
    },
    enabled: isLoggedIn && !authLoading,
  });

  const cgpaData = combinedData?.cgpaData ?? null;
  const feedbackData = combinedData?.feedbackData ?? null;
  const profile = combinedData?.profile ?? null;
  const gpaTrend = combinedData?.gpaTrend ?? [];

  const formattedDate = useMemo(
    () => new Date().toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    [],
  );

  const studentName = profile?.student?.name ? formatStudentName(profile.student.name) : null;

  if (authLoading || (loading && !cgpaData && !feedbackData)) return <DashboardSkeleton />;

  if (error && !cgpaData && !feedbackData) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={loadData} />
      </div>
    );
  }

  const progressPct = cgpaData
    ? Math.min(100, (cgpaData.earnedCredits / cgpaData.totalCreditsRequired) * 100)
    : 0;

  return (
    <div className="w-full space-y-8 sm:space-y-10">

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border border-destructive/15 rounded-lg gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-1 rounded-full bg-destructive shrink-0" />
            <span className="text-xs text-destructive/70 truncate">Sync failed — showing cached data</span>
          </div>
          <button onClick={loadData}
            className="text-[10px] font-bold uppercase tracking-widest text-destructive/50 hover:text-destructive transition-colors shrink-0 focus:outline-none">
            Retry
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="pb-6 sm:pb-8 border-b border-border/10">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground/35 mb-1.5">
          {getGreeting()}
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-foreground leading-none">
          {studentName ?? "Academic Dashboard"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground/35 mt-2 sm:mt-3">{formattedDate}</p>
      </header>

      {/* ── Grid: 1 col → 2 col at lg ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] items-start">

        {/* Left column */}
        <div className="pr-0 lg:pr-12 space-y-8 sm:space-y-10 min-w-0">

          {/* CGPA */}
          {cgpaData && (
            <div className="space-y-5 sm:space-y-6">

              {/* Number */}
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground/35 mb-2 sm:mb-3">
                  Cumulative GPA
                </p>
                <div className="flex items-baseline gap-3 sm:gap-4 flex-wrap">
                  <span className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tighter text-foreground leading-none">
                    {cgpaData.currentCgpa.toFixed(2)}
                  </span>
                  <span className="text-base sm:text-lg font-medium text-muted-foreground/40">/ 10.00</span>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground/35">
                    Degree Progress
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-foreground/70">
                    {cgpaData.earnedCredits} / {cgpaData.totalCreditsRequired} cr
                    <span className="text-muted-foreground/40 ml-1">({progressPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="relative w-full h-px bg-border/40 overflow-hidden rounded-full">
                  <div
                    className="absolute inset-y-0 left-0 bg-foreground/40 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* 3 stats */}
              <div className="grid grid-cols-3 max-w-xl border-t border-border/10 pt-5 sm:pt-6">
                {[
                  { label: "Earned", value: cgpaData.earnedCredits, sub: "credits" },
                  { label: "Required", value: cgpaData.totalCreditsRequired, sub: "for degree" },
                  { label: "Non-graded", value: cgpaData.nonGradedCore, sub: "core" },
                ].map((s) => (
                  <div key={s.label} className="space-y-0.5 sm:space-y-1">
                    <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/30">
                      {s.label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none">{s.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground/40">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GPA Graph */}
          {gpaTrend.length > 0 && (
            <div className="border-t border-border/10 pt-6 sm:pt-8 min-w-0">
              <GpaTrendGraph points={gpaTrend} />
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="
          mt-8 lg:mt-0
          pt-6 lg:pt-0
          border-t lg:border-t-0 border-border/10
          lg:border-l lg:border-border/10 lg:pl-7
          lg:sticky lg:top-6
          flex flex-col gap-5
        ">

          {/* Feedback — first on small */}
          {feedbackData && feedbackData.length > 0 && (
            <div className="order-1 lg:order-2 space-y-4 lg:pb-5 lg:border-b lg:border-border/10">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground/35">
                  Feedback Status
                </p>
              </div>
              <div className="space-y-4">
                {feedbackData.map((item, idx) => {
                  const mid = parseFeedbackText(item.midSemester);
                  const tee = parseFeedbackText(item.teeSemester);
                  const isCurriculum = item.type.toLowerCase().includes("curriculum");
                  return (
                    <div key={idx} className="space-y-2.5">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                        {isCurriculum ? "Curriculum" : "Course"}
                      </p>
                      {[
                        { label: "Mid Semester", status: mid },
                        { label: "End Semester", status: tee },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground/50">{row.label}</span>
                          <span className={`text-xs sm:text-sm font-semibold ${row.status.isGiven ? "text-foreground/60" : "text-destructive/60"}`}>
                            {row.status.isGiven ? "✓ Submitted" : "✗ Pending"}
                          </span>
                        </div>
                      ))}
                      {idx < feedbackData.length - 1 && <div className="border-b border-border/8 pt-0.5" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Access — second on small, first on lg */}
          <div className="order-2 lg:order-1 space-y-1.5">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground/35">
              Quick Access
            </p>
            <nav>
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.path} to={link.path}
                    className="group flex items-center justify-between py-2.5 sm:py-3 px-2 rounded-md hover:bg-muted/40 transition-colors duration-150">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/35 group-hover:text-foreground/55 transition-colors shrink-0" />
                      <span className="text-xs sm:text-sm font-medium text-foreground/60 group-hover:text-foreground/90 transition-colors truncate">
                        {link.label}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
