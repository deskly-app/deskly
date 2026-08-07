import { useState, useMemo } from "react";
import { useParams } from "@/router";
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
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError, fetchWithTimeout } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import {
  BookOpen,
  Download,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Loader2,
} from "lucide-react";
import curriculumImg from "@/assets/curriculum.png";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

function CoursesDetailSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4 font-saira">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>
      <div className="flex items-center gap-2">
        <Sk className="w-6 h-6 rounded-md shrink-0" />
        <Sk className="h-7 w-36" />
      </div>
      <Sk className="h-10 w-full rounded-md" />
      <div className="divide-y divide-border/10 border-t border-b border-border/10 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="py-4 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Sk className="h-3 w-16" />
              <Sk className="h-4 w-2/3" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Sk className="h-3 w-16" />
              <Sk className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CategoryCoursesPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { categoryId } = useParams("/dashboard/curriculum/:categoryId");

  const {
    data: coursesData,
    loading,
    error,
    retry: load,
  } = useOfflineData<CurriculumCourse[]>({
    cacheKey: categoryId ? `deskly::cache::curriculum_courses_${categoryId}` : "",
    fetcher: () => getCurriculumCategoryCourses(categoryId!),
    enabled: isLoggedIn && !authLoading && !!categoryId,
  });

  const courses = coursesData || [];

  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloadResult, setDownloadResult] = useState<Record<string, { success: boolean; message: string } | null>>({});

  const isAnyDownloading = useMemo(() => Object.values(downloading).some(Boolean), [downloading]);

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

  async function handleDownloadSyllabus(courseCode: string) {
    if (isAnyDownloading || downloading[courseCode]) return;

    const defaultFilename = `${courseCode}_Syllabus.pdf`;

    // 1. Prompt user for save path FIRST before starting download
    let savePath: string | null = null;
    try {
      savePath = await save({
        filters: [{
          name: "PDF File",
          extensions: ["pdf"]
        }],
        defaultPath: defaultFilename
      });
    } catch (dialogErr) {
      console.warn("Save dialog cancelled or closed:", dialogErr);
      savePath = null;
    }

    // If user cancelled save dialog, exit immediately. Do NOT enter loading state!
    if (!savePath) {
      setDownloading((prev) => ({ ...prev, [courseCode]: false }));
      setDownloadResult((prev) => ({ ...prev, [courseCode]: null }));
      return;
    }

    // 2. User confirmed save path -> start loading state & fetch from VTOP
    setDownloading((prev) => ({ ...prev, [courseCode]: true }));
    setDownloadResult((prev) => ({ ...prev, [courseCode]: null }));

    try {
      const res = await fetchWithTimeout(downloadCurriculumSyllabus(courseCode), 15000);
      
      if (!res.success || !res.data) {
        setDownloadResult((prev) => ({
          ...prev,
          [courseCode]: { success: false, message: res.error ?? "Failed to download syllabus." }
        }));
        return;
      }

      // 3. Write file content to the chosen savePath
      const base64Data = res.data.contentBase64;
      if (base64Data) {
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        await writeFile(savePath, binaryData);
      }

      setDownloadResult((prev) => ({
        ...prev,
        [courseCode]: { success: true, message: "Saved!" }
      }));
      
      // Native notification feedback
      try {
        sendNotification({
          title: "Syllabus Saved",
          body: `Syllabus successfully saved!`
        });
      } catch (err) {
        console.error("Failed to trigger native notification", err);
      }

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setDownloadResult((prev) => ({
        ...prev,
        [courseCode]: { success: false, message: errMsg }
      }));
    } finally {
      setDownloading((prev) => ({ ...prev, [courseCode]: false }));
    }
  }

  const shell = (children: React.ReactNode) => <>{children}</>;
  const isOnline = useOnlineStatus();
  const isLoading = authLoading || loading;
  const showOffline = courses.length === 0 && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline && !loading) return shell(<OfflineDisplay onRetry={load} />);
  if (isLoading && courses.length === 0) return shell(<CoursesDetailSkeleton />);
  if (error && courses.length === 0) return shell(<div className="flex h-full items-center justify-center"><ErrorDisplay message={error} onRetry={load} /></div>);

  return shell(
    <div className="w-full space-y-5 px-2 py-4 font-saira relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[200px] h-[160px] pointer-events-none select-none z-0">
        <img
          src={curriculumImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          style={{
            maskImage: "radial-gradient(ellipse at 30% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)"
          }}
          alt="Curriculum Illustration"
        />
      </div>

      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button onClick={load} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">Retry</button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none">{categoryId}</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-none">Course List</h1>
        {!isLoading && courses.length > 0 && (
          <p className="text-xs text-muted-foreground/50 leading-none pt-0.5">
            {filtered.length === courses.length ? `${courses.length} courses` : `${filtered.length} of ${courses.length} courses`}
          </p>
        )}
      </header>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          placeholder="Search course title or code…"
          className="w-full h-10 pl-10 pr-10 rounded-md border border-border/20 bg-muted/10 text-sm placeholder:text-muted-foreground/35 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Course List ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-20 gap-3 text-center bg-muted/15 dark:bg-muted/15 dark:bg-[#0e0e0f]/20 border border-border/40 dark:border-border/10 rounded-lg">
          <BookOpen className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-foreground">No courses found</p>
          <p className="text-xs text-muted-foreground">Try a different search term or code</p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col gap-3">
          {filtered.map((course) => {
            const isDownloading = downloading[course.code];
            const result = downloadResult[course.code];

            return (
              <div
                key={course.code}
                className="p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm flex items-center justify-between gap-4 backdrop-blur-md"
              >
                {/* Left: Code + Title + Credits */}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
                    {course.code}
                  </p>
                  <p className="text-sm font-bold text-foreground leading-snug">{course.title}</p>
                  <p className="text-xs text-muted-foreground/50 leading-none pt-0.5">
                    {course.courseType} &bull; {course.credits} credits
                  </p>
                </div>

                {/* Right: Fixed-size Download button with in-button state */}
                <div className="shrink-0">
                  <Button
                    variant={result?.success ? "outline" : result && !result.success ? "destructive" : "default"}
                    size="sm"
                    disabled={isAnyDownloading}
                    onClick={() => handleDownloadSyllabus(course.code)}
                    className="w-[115px] h-8.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-200"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Saving...</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
