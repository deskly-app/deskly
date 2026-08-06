import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { invoke } from "@tauri-apps/api/core";
import { Link } from "react-router-dom";

import { ErrorDisplay } from "@/components/error-display";
import { getStudentProfile, ProfileData } from "@/lib/features";
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

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function getCgpaPage(): Promise<{
  success: boolean;
  cgpaData?: CgpaData;
  error?: string;
}> {
  try {
    return await invoke<{ success: boolean; cgpaData?: CgpaData; error?: string }>(
      "get_cgpa_page",
    );
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function getFeedbackStatus(): Promise<{
  success: boolean;
  data?: FeedbackStatus[];
  error?: string;
}> {
  try {
    return await invoke<{
      success: boolean;
      data?: FeedbackStatus[];
      error?: string;
    }>("feedback_get_status");
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStudentName(fullName: string | undefined): string {
  if (!fullName) return "";
  const name = fullName.trim().toLowerCase();
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const QUICK_LINKS = [
  { label: "Timetable", path: "/dashboard/timetable", icon: Calendar },
  { label: "Attendance", path: "/dashboard/attendance", icon: BookOpen },
  { label: "My Marks", path: "/dashboard/marks", icon: FileText },
  { label: "Academic Calendar", path: "/dashboard/academic-calendar", icon: Clock },
  { label: "Settings", path: "/dashboard/settings", icon: Settings },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="w-full space-y-10">
      {/* Header skeleton */}
      <div className="pb-6 border-b border-border/10 space-y-2">
        <Sk className="h-7 w-56" />
        <Sk className="h-4 w-44" />
      </div>
      
      {/* Two column grid skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-12 items-start">
        {/* Left side skeleton */}
        <div className="space-y-8">
          <div className="space-y-3">
            <Sk className="h-3.5 w-48" />
            <Sk className="h-14 w-36" />
          </div>
          
          {/* Progress bar skeleton */}
          <div className="pt-4 space-y-3 max-w-xl">
            <div className="flex justify-between">
              <Sk className="h-3 w-36" />
              <Sk className="h-3 w-40" />
            </div>
            <Sk className="h-1.5 w-full" />
          </div>
          
          {/* Stats skeleton */}
          <div className="grid grid-cols-3 gap-8 pt-8 max-w-xl">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Sk className="h-3 w-14" />
                <Sk className="h-7 w-12" />
                <Sk className="h-3 w-20" />
              </div>
            ))}
          </div>

          {/* Quick Access skeleton */}
          <div className="pt-8 border-t border-border/10 space-y-4 max-w-xl">
            <Sk className="h-3.5 w-24" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/5">
                  <div className="flex items-center gap-3">
                    <Sk className="h-4 w-4 rounded-md" />
                    <Sk className="h-3.5 w-20" />
                  </div>
                  <Sk className="h-3.5 w-3.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Right side skeleton */}
        <div className="space-y-6 lg:pl-8 lg:border-l lg:border-border/10">
          <div className="space-y-2">
            <Sk className="h-4.5 w-36" />
            <Sk className="h-3.5 w-48" />
          </div>
          <div className="space-y-6 pt-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="space-y-3 pb-5 border-b border-border/10 last:border-b-0">
                <div className="space-y-1.5">
                  <Sk className="h-4 w-28" />
                  <Sk className="h-3.5 w-44" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><Sk className="h-3.5 w-24" /><Sk className="h-3.5 w-16" /></div>
                  <div className="flex justify-between"><Sk className="h-3.5 w-24" /><Sk className="h-3.5 w-16" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [cgpaData, setCgpaData] = useState<CgpaData | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Today's Date formatted nicely
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("default", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  // Load from Cache (SWR) first
  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::dashboard");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.cgpaData || parsed.feedbackData || parsed.profile)) {
          if (parsed.cgpaData) setCgpaData(parsed.cgpaData);
          if (parsed.feedbackData) setFeedbackData(parsed.feedbackData);
          if (parsed.profile) setProfile(parsed.profile);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached dashboard data", e);
      }
    }
  }, []);

  async function loadData() {
    try {
      if (!isLoggedIn && !authLoading) return;
      setError(null);
      if (authLoading) return;

      const [cgpaRes, feedbackRes, profileRes] = await Promise.all([
        getCgpaPage(),
        getFeedbackStatus(),
        getStudentProfile().catch(() => null),
      ]);

      let updatedCgpa = cgpaData;
      let updatedFeedback = feedbackData;
      let updatedProfile = profile;

      if (cgpaRes.success && cgpaRes.cgpaData) {
        setCgpaData(cgpaRes.cgpaData);
        updatedCgpa = cgpaRes.cgpaData;
      } else if (cgpaRes.error) {
        console.error("CGPA fetch error:", cgpaRes.error);
        setError(cgpaRes.error);
      }

      if (feedbackRes.success && feedbackRes.data) {
        setFeedbackData(feedbackRes.data);
        updatedFeedback = feedbackRes.data;
      } else if (feedbackRes.error) {
        console.error("Feedback fetch error:", feedbackRes.error);
        setError(feedbackRes.error);
      }

      if (profileRes && profileRes.success && profileRes.data) {
        setProfile(profileRes.data);
        updatedProfile = profileRes.data;
      }

      // Save to cache
      localStorage.setItem(
        "deskly::cache::dashboard",
        JSON.stringify({
          cgpaData: updatedCgpa,
          feedbackData: updatedFeedback,
          profile: updatedProfile,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn, authLoading]);

  function parseFeedbackText(text: string) {
    const normalized = text.toLowerCase();
    // "NOT Given" also contains "given", so we must explicitly exclude the "not given" case
    const isGiven =
      (normalized.includes("given") && !normalized.includes("not given")) ||
      normalized.includes("submitted");
    return {
      isGiven,
      statusText: isGiven ? "Submitted" : "Pending",
      rawText: text,
    };
  }

  const studentName = profile?.student?.name
    ? formatStudentName(profile.student.name)
    : "Student";

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (authLoading || (loading && !cgpaData && !feedbackData)) {
    return shell(<DashboardSkeleton />);
  }

  if (error && !cgpaData && !feedbackData) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={loadData} />
      </div>,
    );
  }

  return shell(
    <div className="w-full space-y-10">
      {error && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="truncate">Sync failed: {error} (Viewing cached data)</span>
          </div>
          <button 
            onClick={loadData}
            className="text-xs uppercase font-bold tracking-wider hover:underline focus:outline-none shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-6 border-b border-border/10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {profile?.student?.name ? `Welcome back, ${studentName}.` : "Academic Dashboard"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formattedDate}
          </p>
        </div>
      </header>

      {/* ── Two Column Desktop Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-12 items-start">
        
        {/* Left Column: CGPA Callout & Academic Stats */}
        <div className="space-y-8">
          {cgpaData ? (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-black tracking-widest text-muted-foreground/60 uppercase">
                  Cumulative Grade Point Average
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-6xl sm:text-7xl font-black tracking-tighter text-foreground leading-none">
                    {cgpaData.currentCgpa.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">/ 10.00</span>
                </div>
              </div>
              
              {/* Credit Completion Progress */}
              <div className="pt-4 space-y-2.5 max-w-xl">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Degree Credit Completion</span>
                  <span className="text-foreground font-bold">
                    {cgpaData.earnedCredits} of {cgpaData.totalCreditsRequired} credits ({((cgpaData.earnedCredits / cgpaData.totalCreditsRequired) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500" 
                    style={{ width: `${(cgpaData.earnedCredits / cgpaData.totalCreditsRequired) * 100}%` }} 
                  />
                </div>
              </div>
              
              {/* 3-Column Credit Metrics */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border/10 max-w-xl">
                <div className="space-y-1">
                  <p className="text-xs font-black tracking-widest text-muted-foreground/50 uppercase">
                    Earned
                  </p>
                  <p className="text-2xl font-extrabold text-foreground">
                    {cgpaData.earnedCredits}
                  </p>
                  <p className="text-xs text-muted-foreground/60">Credits earned</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black tracking-widest text-muted-foreground/50 uppercase">
                    Required
                  </p>
                  <p className="text-2xl font-extrabold text-foreground">
                    {cgpaData.totalCreditsRequired}
                  </p>
                  <p className="text-xs text-muted-foreground/60">Degree required</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black tracking-widest text-muted-foreground/50 uppercase">
                    Non-Graded
                  </p>
                  <p className="text-2xl font-extrabold text-foreground">
                    {cgpaData.nonGradedCore}
                  </p>
                  <p className="text-xs text-muted-foreground/60">Non-graded core</p>
                </div>
              </div>
            </div>
          ) : (
            /* Render Inline CGPA Skeleton */
            <div className="space-y-6">
              <div className="space-y-2">
                <Sk className="h-3.5 w-48" />
                <div className="flex items-baseline gap-2 mt-1">
                  <Sk className="h-14 w-36" />
                  <Sk className="h-4 w-12" />
                </div>
              </div>
              <div className="pt-4 space-y-3 max-w-xl">
                <div className="flex justify-between"><Sk className="h-3 w-36" /><Sk className="h-3 w-40" /></div>
                <Sk className="h-1.5 w-full" />
              </div>
              <div className="grid grid-cols-3 gap-8 pt-8 max-w-xl">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2"><Sk className="h-3 w-14" /><Sk className="h-7 w-12" /><Sk className="h-3 w-20" /></div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Access Links */}
          <div className="pt-8 border-t border-border/10 space-y-4 max-w-xl">
            <h2 className="text-xs font-black tracking-widest text-muted-foreground/60 uppercase">
              Quick Access
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="group flex items-center justify-between py-2.5 border-b border-border/5 hover:border-primary/20 transition-all duration-150"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                      <span className="text-xs font-bold text-foreground/85 group-hover:text-foreground truncate transition-colors">
                        {link.label}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: VTOP Feedback status checklist */}
        {feedbackData && feedbackData.length > 0 ? (
          <div className="space-y-6 lg:pl-8 lg:border-l lg:border-border/10">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                Feedback Checklist
              </h2>
              <p className="text-xs text-muted-foreground">VTOP feedback submission status</p>
            </div>
            
            <div className="space-y-6 pt-2">
              {feedbackData.map((item, idx) => {
                const isCurriculum = item.type.toLowerCase().includes("curriculum");
                const label = isCurriculum ? "Content Feedback" : "General Feedback";
                const desc = isCurriculum 
                  ? "Syllabus & curriculum content status" 
                  : "Course instruction & teaching status";
                
                const mid = parseFeedbackText(item.midSemester);
                const tee = parseFeedbackText(item.teeSemester);
 
                return (
                  <div
                    key={idx}
                    className="space-y-3 pb-5 border-b border-border/10 last:border-b-0 last:pb-0"
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-black uppercase tracking-wider text-muted-foreground/55">
                        {item.type}
                      </span>
                      <h3 className="text-sm font-bold text-foreground mt-0.5">
                        {label}
                      </h3>
                      <p className="text-xs text-muted-foreground/60">
                        {desc}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">
                          Mid Semester:
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold ${
                            mid.isGiven ? "text-emerald-500" : "text-destructive"
                          }`}
                          title={mid.rawText}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${mid.isGiven ? "bg-emerald-500" : "bg-destructive"} relative -translate-y-[0.5px]`} />
                          {mid.statusText}
                        </span>
                      </div>
 
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">
                          TEE Semester:
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold ${
                            tee.isGiven ? "text-emerald-500" : "text-destructive"
                          }`}
                          title={tee.rawText}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tee.isGiven ? "bg-emerald-500" : "bg-destructive"} relative -translate-y-[0.5px]`} />
                          {tee.statusText}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Render Inline Feedback Checklist Skeleton */
          <div className="space-y-6 lg:pl-8 lg:border-l lg:border-border/10 w-full">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                Feedback Checklist
              </h2>
              <p className="text-xs text-muted-foreground">VTOP feedback submission status</p>
            </div>
            
            <div className="space-y-6 pt-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-3 pb-5 border-b border-border/10 last:border-b-0">
                  <div className="space-y-1.5">
                    <Sk className="h-3 w-20" />
                    <Sk className="h-4 w-28" />
                    <Sk className="h-3.5 w-44" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><Sk className="h-3.5 w-24" /><Sk className="h-3.5 w-16" /></div>
                    <div className="flex justify-between"><Sk className="h-3.5 w-24" /><Sk className="h-3.5 w-16" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
