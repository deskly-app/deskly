import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "@/router";
import { useAuth } from "@/hooks/useAuth";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { sendNotification } from "@tauri-apps/plugin-notification";
import {
  getCurriculumCategoryCourses,
  downloadCurriculumSyllabus,
  CurriculumCourse,
} from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import { fetchWithTimeout } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  Download,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Loader2,
} from "lucide-react";

// ─── Course Loader Skeleton ───────────────────────────────────────────────────

function CoursesDetailSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 pb-6 border-b border-border/40">
        <div className="animate-pulse rounded-md bg-muted/65 h-8 w-8" />
        <div className="space-y-2">
          <div className="animate-pulse rounded-md bg-muted/65 h-6 w-32" />
          <div className="animate-pulse rounded-md bg-muted/65 h-3.5 w-48" />
        </div>
      </div>
      <div className="divide-y divide-border/5 animate-pulse">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="py-4 px-3 -mx-3 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex-1 space-y-2 pr-4">
              <div className="rounded-md bg-muted/65 h-3.5 w-20" />
              <div className="rounded-md bg-muted/65 h-4 w-2/3" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-4 md:gap-6 shrink-0">
              <div className="flex items-center gap-2">
                <div className="rounded bg-muted/65 h-4 w-12" />
                <div className="rounded bg-muted/65 h-4 w-8" />
              </div>
              <div className="rounded-md bg-muted/65 h-8 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderCourseTypeBadge(type: string) {
  return (
    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted/60 text-muted-foreground border border-border/20">
      {type}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CategoryCoursesPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { categoryId } = useParams("/dashboard/curriculum/:categoryId");
  const navigate = useNavigate();
  const cacheKey = categoryId ? `deskly::cache::curriculum_courses_${categoryId}` : "";

  const [courses, setCourses] = useState<CurriculumCourse[]>(() => {
    if (!cacheKey) return [];
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse cached curriculum courses", e);
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(courses.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Downloading syllabus state ("picking" | "downloading" | null)
  const [activeCourseState, setActiveCourseState] = useState<Record<string, "picking" | "downloading" | null>>({});
  const [downloadResult, setDownloadResult] = useState<Record<string, { success: boolean; message: string } | null>>({});

  const isAnyBusy = useMemo(
    () => Object.values(activeCourseState).some((state) => state === "picking" || state === "downloading"),
    [activeCourseState]
  );

  async function load() {
    if (!categoryId) return;
    try {
      if (!isLoggedIn && !authLoading) return;
      setError(null);
      if (authLoading) return;

      const hasCache = courses.length > 0;
      setLoading(!hasCache);

      const res = await fetchWithTimeout(getCurriculumCategoryCourses(categoryId), 15000);
      if (res.success && res.data) {
        setCourses(res.data);
        if (cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        }
      } else {
        if (!hasCache) {
          setError(res.error ?? "Failed to fetch courses for this category.");
        }
      }
    } catch (e) {
      if (courses.length === 0) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCourses(parsed);
          }
        } catch (e) {
          console.error("Failed to parse cached curriculum courses", e);
        }
      }
    }
    if (isLoggedIn && categoryId) {
      load();
    }
  }, [isLoggedIn, authLoading, categoryId]);

  // Filtering search query
  const filtered = useMemo(() => {
    if (!query.trim()) return courses;
    const q = query.toLowerCase();
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.courseType.toLowerCase().includes(q)
    );
  }, [courses, query]);

  // Handle downloading syllabus file
  async function handleDownloadSyllabus(courseCode: string) {
    if (isAnyBusy || activeCourseState[courseCode]) return;

    const defaultFilename = `${courseCode}_Syllabus.pdf`;

    // 1. Immediately enter "picking" state so UI disables and shows file dialog state
    setActiveCourseState((prev) => ({ ...prev, [courseCode]: "picking" }));
    setDownloadResult((prev) => ({ ...prev, [courseCode]: null }));

    let savePath: string | null = null;
    try {
      savePath = await save({
        filters: [
          {
            name: "PDF File",
            extensions: ["pdf"],
          },
        ],
        defaultPath: defaultFilename,
      });
    } catch (dialogErr) {
      console.warn("Save dialog cancelled or closed:", dialogErr);
      savePath = null;
    }

    // If user cancelled save dialog, exit cleanly and restore idle state immediately
    if (!savePath) {
      setActiveCourseState((prev) => ({ ...prev, [courseCode]: null }));
      return;
    }

    // 2. User selected save path -> enter "downloading" state & fetch from backend
    setActiveCourseState((prev) => ({ ...prev, [courseCode]: "downloading" }));

    try {
      const res = await fetchWithTimeout(downloadCurriculumSyllabus(courseCode), 15000);

      if (!res.success || !res.data) {
        setDownloadResult((prev) => ({
          ...prev,
          [courseCode]: {
            success: false,
            message: res.error ?? "Failed to download syllabus.",
          },
        }));
        return;
      }

      // 3. Write binary buffer to chosen savePath
      const base64Data = res.data.contentBase64;
      if (base64Data) {
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        await writeFile(savePath, binaryData);
      }

      setDownloadResult((prev) => ({
        ...prev,
        [courseCode]: {
          success: true,
          message: "Saved!",
        },
      }));

      // Native notification feedback
      try {
        sendNotification({
          title: "Syllabus Saved",
          body: `${courseCode} syllabus successfully saved!`,
        });
      } catch (err) {
        console.error("Failed to trigger native notification", err);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setDownloadResult((prev) => ({
        ...prev,
        [courseCode]: {
          success: false,
          message: errMsg,
        },
      }));
    } finally {
      setActiveCourseState((prev) => ({ ...prev, [courseCode]: null }));
    }
  }

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  const isLoading = authLoading || loading;

  if (isLoading && courses.length === 0) {
    return shell(<CoursesDetailSkeleton />);
  }

  if (error) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full space-y-6 pb-8">
      {/* ── Header with Back Navigation & Course Count ──────────────────────── */}
      <header className="pb-4 border-b border-border/20 flex flex-col gap-3">
        <button
          onClick={() => navigate("/dashboard/curriculum")}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Categories</span>
        </button>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold font-mono tracking-wider text-foreground uppercase bg-muted/60 border border-border/30 px-2.5 py-1 rounded-md leading-none">
                {categoryId}
              </span>
              <span>Course Directory</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Browse course curriculum details and download official syllabus documents
            </p>
          </div>
          {!isLoading && courses.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/40 border border-border/20 px-3 py-1 rounded-full shrink-0">
              <strong className="text-foreground font-semibold">{filtered.length}</strong> of {courses.length} courses
            </span>
          )}
        </div>
      </header>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          placeholder="Search course title, code, or type…"
          className="w-full h-10 pl-10 pr-10 rounded-lg border border-border/20 bg-muted/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-50 text-foreground"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer p-0.5 rounded-md hover:bg-muted/20"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Courses List Container ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 gap-3 text-center rounded-xl border border-dashed border-border/40 bg-muted/5">
          <div className="p-3 rounded-full bg-muted/20 text-muted-foreground/40">
            <BookOpen className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-foreground">No courses matching "{query}"</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Try refining your search terms or clearing the filter.
          </p>
          <button
            onClick={() => setQuery("")}
            className="mt-1 text-xs font-medium text-primary hover:underline cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 min-w-0">
          {/* Table Header on Desktop */}
          <div className="hidden lg:flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider border-b border-border/15">
            <div className="flex-1 min-w-0">Course Information</div>
            <div className="flex items-center gap-8 shrink-0">
              <span className="w-36 text-left">Type</span>
              <span className="w-20 text-center">Credits</span>
              <span className="w-32 text-right">Actions</span>
            </div>
          </div>

          {/* Course Items List */}
          <div className="divide-y divide-border/10 border-t lg:border-t-0 border-border/10">
            {filtered.map((course) => {
              const courseState = activeCourseState[course.code];
              const result = downloadResult[course.code];

              return (
                <div
                  key={course.code}
                  className="group py-3.5 px-3 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 hover:bg-muted/10 transition-colors duration-150 min-w-0"
                >
                  {/* Left Section: Code + Title */}
                  <div className="flex-1 min-w-0 pr-2 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold font-mono tracking-wider text-muted-foreground bg-muted/60 border border-border/30 px-2 py-0.5 rounded-md leading-none shrink-0">
                        {course.code}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug break-words">
                      {course.title}
                    </h3>
                  </div>

                  {/* Right Section: Type, Credits & Action Button */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 lg:gap-8 shrink-0 min-w-0 pt-2 lg:pt-0 border-t border-border/10 lg:border-t-0">
                    {/* Course Type */}
                    <div className="flex items-center justify-start lg:w-36 min-w-0 shrink-0">
                      {renderCourseTypeBadge(course.courseType)}
                    </div>

                    {/* Credits */}
                    <div className="flex items-center justify-start lg:justify-center lg:w-20 shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-medium font-mono text-foreground bg-muted/40 border border-border/30 px-2.5 py-1 rounded-full shrink-0">
                        <span className="font-bold text-foreground">{course.credits}</span> Cr
                      </span>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center justify-end lg:w-32 shrink-0 ml-auto lg:ml-0">
                      <Button
                        variant={result?.success ? "outline" : result && !result.success ? "destructive" : "default"}
                        size="sm"
                        disabled={isAnyBusy}
                        onClick={() => handleDownloadSyllabus(course.code)}
                        className="w-[115px] h-8.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-200"
                      >
                        {courseState === "picking" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-muted-foreground" />
                            <span>Choosing…</span>
                          </>
                        ) : courseState === "downloading" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            <span>Saving…</span>
                          </>
                        ) : result?.success ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Saved</span>
                          </>
                        ) : result && !result.success ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Retry</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 shrink-0" />
                            <span>Syllabus</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
