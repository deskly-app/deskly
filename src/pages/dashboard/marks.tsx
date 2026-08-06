import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getMarks, StudentMarkEntry } from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import { Input } from "@/components/ui/input";
import { Target, Search, BookOpen } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCourseTypeStyle(type: string): { label: string; className: string } {
  const clean = type.trim().toUpperCase();
  if (clean.includes("EMBEDDED THEORY")) return { label: type, className: "text-primary" };
  if (clean.includes("EMBEDDED LAB")) return { label: type, className: "text-chart-2" };
  if (clean.includes("THEORY")) return { label: type, className: "text-primary" };
  if (clean.includes("LAB")) return { label: type, className: "text-chart-2" };
  return { label: type, className: "text-muted-foreground" };
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

// ─── Skeleton Loader Layout ───────────────────────────────────────────────────

function MarksSkeleton() {
  return (
    <div className="w-full space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between pb-6 border-b border-border/40">
        <div className="space-y-2">
          <Sk className="h-7 w-36" />
          <Sk className="h-3 w-52" />
        </div>
      </div>

      {/* Search Bar Skeleton */}
      <div className="flex flex-col gap-3 pb-4 border-b border-border/20 pt-4">
        <Sk className="h-5 w-44" />
        <Sk className="h-9 w-full rounded-md" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-border/10">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-card/40 border border-border/30 rounded-md p-3 flex-1 min-w-[120px] sm:flex-initial sm:w-32 space-y-2"
          >
            <Sk className="h-3 w-16" />
            <Sk className="h-3.5 w-24" />
          </div>
        ))}
      </div>

      {/* Selected Course Card Skeleton */}
      <div className="bg-card/40 border border-border/30 rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2 w-1/3">
            <Sk className="h-4 w-24" />
            <Sk className="h-5 w-full" />
            <Sk className="h-3 w-40" />
          </div>
          <Sk className="h-8 w-24 rounded-md" />
        </div>
        <div className="space-y-2 pt-6 border-t border-border/15">
          <Sk className="h-8 w-full" />
          <Sk className="h-8 w-full" />
          <Sk className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function MarksPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [data, setData] = useState<StudentMarkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>("");

  // Load from Cache (SWR) first
  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::marks");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setData(parsed);
          setLoading(false);
          setSelectedCourseCode(parsed[0].courseCode);
        }
      } catch (e) {
        console.error("Failed to parse cached marks", e);
      }
    }
  }, []);

  // Fetch fresh marks data
  async function load() {
    try {
      if (!isLoggedIn && !authLoading) return;
      setError(null);
      if (authLoading) return;

      setLoading(data.length > 0 ? false : true);

      const res = await getMarks();
      if (res.success && res.data) {
        setData(res.data);
        localStorage.setItem("deskly::cache::marks", JSON.stringify(res.data));

        if (res.data.length > 0) {
          setSelectedCourseCode(res.data[0].courseCode);
        }
      } else {
        setError(res.error ?? "Failed to fetch marks view.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      load();
    }
  }, [isLoggedIn, authLoading]);

  // Derived values
  const filteredCourses = useMemo(() => {
    return data.filter(
      (course) =>
        course.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const activeCourse = useMemo(() => {
    if (filteredCourses.length === 0) return null;
    const found = filteredCourses.find((c) => c.courseCode === selectedCourseCode);
    return found || filteredCourses[0];
  }, [filteredCourses, selectedCourseCode]);

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (authLoading || (loading && data.length === 0)) {
    return shell(<MarksSkeleton />);
  }

  if (error && data.length === 0) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full space-y-6">
      {error && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="truncate">Sync failed: {error} (Viewing cached data)</span>
          </div>
          <button 
            onClick={load}
            className="text-xs uppercase font-bold tracking-wider hover:underline focus:outline-none shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/20">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Target className="w-6 h-6 text-primary shrink-0" />
          My Marks
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Detailed breakdown of raw, weighted, and scaled course grades
        </p>
      </header>

      {/* ── Search Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 pb-4 border-b border-border/20 pt-1">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight">Course Marks List</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing {filteredCourses.length} of {data.length} registered courses
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search course code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2 bg-muted/40 border border-border/30 rounded-md text-xs outline-none focus:border-primary/50 text-foreground w-full transition-all"
          />
        </div>
      </div>

      {/* ── Subject Tabs List ──────────────────────────────────────────────── */}
      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Target className="w-8 h-8 text-muted-foreground/20" />
          <div>
            <p className="text-sm font-bold text-foreground">No courses found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try modifying your search query or check back later.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subject Tabs */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-border/10">
            {filteredCourses.map((course) => {
              const isActive = activeCourse?.courseCode === course.courseCode;
              const courseTotalWeighted = course.assessments.reduce(
                (sum, ass) => sum + ass.weightageMark,
                0
              );
              const hasAssessments = course.assessments && course.assessments.length > 0;

              return (
                <button
                  key={course.courseCode}
                  onClick={() => setSelectedCourseCode(course.courseCode)}
                  className={`flex flex-col items-start gap-1 px-4 py-2.5 rounded-md border text-xs cursor-pointer transition-all duration-150 whitespace-nowrap flex-1 min-w-[120px] sm:flex-initial
                    ${
                      isActive
                        ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "bg-card/40 border-border/20 text-muted-foreground hover:bg-muted/30 hover:border-border/30"
                    }
                  `}
                >
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                    <span>{course.courseCode}</span>
                    <span
                      className={`text-xs px-1 py-0.2 rounded font-mono
                        ${
                          isActive
                            ? "bg-primary-foreground/25 text-primary-foreground"
                            : "bg-muted text-muted-foreground/80"
                        }
                      `}
                    >
                      {course.slot}
                    </span>
                  </div>
                  <div className="text-xs font-bold opacity-80 leading-none mt-0.5">
                    {hasAssessments ? `${courseTotalWeighted.toFixed(1)} / 100` : "No marks"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Course Marks Details Card */}
          {activeCourse && (
            <div className="bg-card/30 border border-border/25 rounded-lg p-6 hover:border-border/35 transition-colors flex flex-col gap-6">
              {/* Card Title Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold tracking-widest text-primary uppercase leading-none">
                      {activeCourse.courseCode}
                    </span>
                    <span className="font-mono text-xs font-black text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded-md leading-none">
                      {activeCourse.slot}
                    </span>
                    <span
                      className={`text-xs font-semibold ${getCourseTypeStyle(activeCourse.courseType).className}`}
                    >
                      {getCourseTypeStyle(activeCourse.courseType).label}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {activeCourse.courseTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {activeCourse.faculty} · {activeCourse.courseMode} · {activeCourse.courseSystem}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  {activeCourse.assessments && activeCourse.assessments.length > 0 ? (
                    <>
                      {(() => {
                        const totalWeighted = activeCourse.assessments.reduce(
                          (sum, ass) => sum + ass.weightageMark,
                          0
                        );
                        const totalWeight = activeCourse.assessments.reduce(
                          (sum, ass) => sum + ass.weightagePercent,
                          0
                        );
                        return (
                          <>
                            <div className="text-2xl font-black text-foreground leading-none">
                              {totalWeighted.toFixed(2)}{" "}
                              <span className="text-sm text-muted-foreground/60 font-bold">
                                / 100
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground/50 font-bold mt-1">
                              Graded weightage: {totalWeight.toFixed(1)}%
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground/60 font-bold">
                      No marks entered
                    </span>
                  )}
                </div>
              </div>

              {/* Assessments Details Table */}
              {activeCourse.assessments && activeCourse.assessments.length > 0 ? (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-border/15 text-xs font-black uppercase tracking-wider text-muted-foreground/50">
                        <th className="py-2.5 px-2 w-10">#</th>
                        <th className="py-2.5 px-2 min-w-[120px]">Assessment Title</th>
                        <th className="py-2.5 px-2 text-center w-40">Normal Marks</th>
                        <th className="py-2.5 px-2 text-center w-40">Weighted Mark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5 font-semibold text-muted-foreground/90">
                      {activeCourse.assessments.map((ass, index) => {
                        const normalPercent =
                          ass.maxMark > 0 ? (ass.scoredMark / ass.maxMark) * 100 : 0;

                        return (
                          <tr key={`${ass.slNo}-${index}`} className="hover:bg-muted/5 transition-colors">
                            <td className="py-3 px-2 text-foreground/40 tabular-nums">
                              {ass.slNo ?? index + 1}
                            </td>
                            <td className="py-3 px-2 text-foreground font-bold leading-normal">
                              {ass.markTitle}
                            </td>
                            <td className="py-3 px-2 text-center tabular-nums font-bold text-foreground">
                              {ass.scoredMark}{" "}
                              <span className="text-muted-foreground/30 font-normal">/</span>{" "}
                              {ass.maxMark}
                              <span className="text-xs font-bold text-muted-foreground/50 block sm:inline sm:ml-2 bg-muted/20 px-1.5 py-0.5 rounded leading-none">
                                {normalPercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center tabular-nums text-primary font-bold">
                              {ass.weightageMark}{" "}
                              <span className="text-primary/30 font-normal">/</span>{" "}
                              {ass.weightagePercent}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 border-t border-border/10">
                  <BookOpen className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    No assessments graded for this course yet
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
