import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getGradesHistory,
  StudentHistoryData,
  getStudentGradeView,
  SemesterGradeViewData,
  SemesterGradeEntry,
} from "@/lib/features";
import { SemesterOption } from "@/lib/features";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import { DrawerSelect } from "@/components/ui/drawer-select";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import gradeHistoryImg from "@/assets/grade-history.png";
import {
  GraduationCap,
  Search,
  FileText,
  Monitor,
  CalendarDays,
  ChevronRight,
  X,
  Award,
} from "lucide-react";

// ─── Skeletons ────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/65 ${className}`} />;
}

function GradesSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4 font-saira">
      <Sk className="h-11 w-full rounded-lg" />
      <Sk className="h-28 w-full rounded-xl" />
      <div className="space-y-3">
        <Sk className="h-10 w-full rounded-md" />
      </div>
      <div className="space-y-3 pt-2">
        {[...Array(6)].map((_, i) => (
          <Sk key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Grade Detail Drawers ─────────────────────────────────────────────────────

function HistoryGradeDrawer({
  item,
  open,
  onOpenChange,
}: {
  item: StudentHistoryData["grades"][number] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-8 font-saira max-h-[92vh]">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-primary/10 text-primary border border-primary/20 tracking-wider">
                  {item.courseCode}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-muted text-muted-foreground tracking-wider">
                  {item.courseType.trim()}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-primary/10 text-primary border border-primary/20 tracking-wider">
                  Grade {item.grade.trim().toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground leading-snug tracking-tight">
                {item.courseTitle}
              </h2>
            </div>
            
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground active:opacity-75 transition-all border-none cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Separator className="bg-border/15" />

          <div className="grid grid-cols-2 gap-y-5 gap-x-4 py-1">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none block">
                Credits
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <Monitor className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground">{item.credits} Credits</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none block">
                Exam Session
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate">{item.examMonth || "—"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none block">
                Result Declared
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate">{item.resultDeclared || "—"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none block">
                Distribution
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate">{item.courseDistribution || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SemesterGradeDrawer({
  item,
  open,
  onOpenChange,
}: {
  item: SemesterGradeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-8 font-saira max-h-[92vh]">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-primary/10 text-primary border border-primary/20 tracking-wider">
                  {item.courseCode}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-muted text-muted-foreground tracking-wider">
                  {item.courseType}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-primary/10 text-primary border border-primary/20 tracking-wider">
                  Grade {item.grade}
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground leading-snug tracking-tight">
                {item.courseTitle}
              </h2>
            </div>
            
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground active:opacity-75 transition-all border-none cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Separator className="bg-border/15" />

          {/* Credits Breakdown L-P-J-C */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest block">
              Credit Breakdown
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-muted/15 border border-border/15 rounded-lg text-center space-y-1">
                <span className="text-xs font-bold text-muted-foreground/50 uppercase">Lecture (L)</span>
                <p className="text-base font-black text-foreground">{item.credits.l}</p>
              </div>
              <div className="p-3 bg-muted/15 border border-border/15 rounded-lg text-center space-y-1">
                <span className="text-xs font-bold text-muted-foreground/50 uppercase">Practical (P)</span>
                <p className="text-base font-black text-foreground">{item.credits.p}</p>
              </div>
              <div className="p-3 bg-muted/15 border border-border/15 rounded-lg text-center space-y-1">
                <span className="text-xs font-bold text-muted-foreground/50 uppercase">Project (J)</span>
                <p className="text-base font-black text-foreground">{item.credits.j}</p>
              </div>
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-center space-y-1">
                <span className="text-xs font-bold text-primary uppercase">Total (C)</span>
                <p className="text-base font-black text-primary">{item.credits.c}</p>
              </div>
            </div>
          </div>

          {/* Grading Type & Grand Total */}
          <div className="divide-y divide-border/15 border-t border-b border-border/15">
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Grading Type</span>
              <span className="text-sm font-bold text-foreground">{item.gradingType || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Grand Total Marks</span>
              <span className="text-sm font-bold text-foreground">{item.grandTotal !== undefined && item.grandTotal !== null ? item.grandTotal : "—"}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Final Grade</span>
              <span className="text-base font-black text-primary">{item.grade}</span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function GradesPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();

  // Tab State: "semester" vs "history"
  const [activeTab, setActiveTab] = useState<"semester" | "history">("semester");

  // Semesters list state
  const [selectedSemId, setSelectedSemId] = useState<string>("");

  // Semester Grade View State
  const {
    data: semGradeData,
    loading: semLoading,
    error: semErrorRaw,
    retry: loadSemesterGrade
  } = useOfflineData<SemesterGradeViewData>({
    cacheKey: "deskly::cache::sem_grades",
    fetcher: () => getStudentGradeView(selectedSemId || undefined),
    enabled: isLoggedIn && !authLoading,
  });

  const [selectedSemGrade, setSelectedSemGrade] = useState<SemesterGradeEntry | null>(null);

  // Semesters list state
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  useEffect(() => {
    if (semGradeData?.semesters && semGradeData.semesters.length > 0) {
      setSemesters(semGradeData.semesters);
    }
    if (semGradeData?.semesterSubId && !selectedSemId) {
      setSelectedSemId(semGradeData.semesterSubId);
    }
  }, [semGradeData, selectedSemId]);

  const semError = semErrorRaw;

  // Grade History State
  const {
    data: historyData,
    loading: historyLoading,
    error: historyError,
    retry: loadHistory
  } = useOfflineData<StudentHistoryData>({
    cacheKey: "deskly::cache::grade_history",
    fetcher: () => getGradesHistory(),
    enabled: isLoggedIn && !authLoading,
  });

  const [selectedHistoryGrade, setSelectedHistoryGrade] = useState<StudentHistoryData["grades"][number] | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("ALL");

  // Grade History Metrics
  const totalSubjects = useMemo(() => historyData?.grades?.length ?? 0, [historyData]);
  const totalCredits = useMemo(() => historyData?.cgpa?.creditsEarned ?? 0, [historyData]);
  const cgpaVal = useMemo(() => historyData?.cgpa?.cgpa ?? 0, [historyData]);

  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, P: 0, N: 0 };
    if (historyData?.grades) {
      historyData.grades.forEach((g) => {
        const cg = g.grade.trim().toUpperCase();
        counts[cg] = (counts[cg] || 0) + 1;
      });
    }
    return counts;
  }, [historyData]);

  const filteredHistoryGrades = useMemo(() => {
    if (!historyData?.grades) return [];
    return historyData.grades.filter((g) => {
      const matchesSearch =
        g.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.courseTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGrade =
        selectedGradeFilter === "ALL" || g.grade.trim().toUpperCase() === selectedGradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [historyData, searchQuery, selectedGradeFilter]);

  const filteredSemesterGrades = useMemo(() => {
    if (!semGradeData?.grades) return [];
    return semGradeData.grades.filter((g) => {
      const matchesSearch =
        g.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.courseTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGrade =
        selectedGradeFilter === "ALL" || g.grade.trim().toUpperCase() === selectedGradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [semGradeData, searchQuery, selectedGradeFilter]);

  const totalSemCredits = useMemo(() => {
    if (!semGradeData?.grades) return 0;
    return semGradeData.grades.reduce((acc, curr) => acc + curr.credits.c, 0);
  }, [semGradeData]);

  const activeSemesterName = useMemo(() => {
    if (!semGradeData) return "";
    const match = semesters.find((s) => s.id === selectedSemId);
    return match ? match.name : "";
  }, [semGradeData, semesters, selectedSemId]);

  const showOffline =
    !semGradeData &&
    !historyData &&
    (isOnline === false || isNetworkError(semError || historyError, isOnline));

  if (showOffline) {
    return <OfflineDisplay onRetry={() => { loadSemesterGrade(); loadHistory(); }} />;
  }

  if (authLoading || (activeTab === "semester" && semLoading && !semGradeData) || (activeTab === "history" && historyLoading && !historyData)) {
    return <GradesSkeleton />;
  }

  return (
    <div className="w-full space-y-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Background illustration */}
      <div className="absolute -top-4 right-0 w-[200px] h-[160px] pointer-events-none select-none z-0">
        <img
          src={gradeHistoryImg}
          className="w-full h-full object-contain opacity-90 dark:opacity-70"
          style={{
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)"
          }}
          alt="Grade History Illustration"
        />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary shrink-0" />
          <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none truncate">
            My Grades
          </h1>
        </div>
      </header>

      {/* Tab Selector */}
      <div className="relative z-10 p-1 bg-card/80 border border-border/40 rounded-lg shadow-sm backdrop-blur-md flex items-center">
        <button
          onClick={() => setActiveTab("semester")}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer text-center ${
            activeTab === "semester"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Semester View
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer text-center ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Grade History
        </button>
      </div>

      {/* ── TAB 1: SEMESTER GRADE VIEW ────────────────────────────────────────── */}
      {activeTab === "semester" && (
        <>
          {/* Current Semester Label Card */}
          {activeSemesterName && (
            <div className="relative z-10 bg-gradient-to-br from-card/90 to-card/45 border border-border/15 p-4 rounded-lg shadow-sm backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none block">Active Semester</span>
                  <span className="text-sm font-bold text-foreground leading-none">{activeSemesterName}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {semError && !isNetworkError(semError, isOnline) && (
            <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
              <p className="text-xs font-semibold truncate">Sync failed — {semError}</p>
              <button onClick={() => loadSemesterGrade()} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">
                Retry
              </button>
            </div>
          )}

          {/* Stats Card */}
          <div className="relative z-10 bg-card/80 border border-border/40 p-5 rounded-xl shadow-sm flex items-center justify-between text-center backdrop-blur-md">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">GPA</p>
              <p className="text-2xl font-black text-foreground leading-none">
                {semGradeData?.gpa !== undefined && semGradeData?.gpa !== null ? semGradeData.gpa : "—"}
              </p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-border/15 shrink-0 mx-2" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">Courses</p>
              <p className="text-2xl font-black text-foreground leading-none">{semGradeData?.grades?.length ?? 0}</p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-border/15 shrink-0 mx-2" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">Credits</p>
              <p className="text-2xl font-black text-foreground leading-none">{totalSemCredits}</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="relative z-10 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-card/80 border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
          </div>

          {/* Course List */}
          {!semGradeData || filteredSemesterGrades.length === 0 ? (
            <div className="relative z-10 flex flex-col items-center justify-center py-16 gap-3 text-center bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md">
              <Award className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-foreground leading-none">No grade records found</p>
              <p className="text-xs text-muted-foreground">Results for this semester may not be published yet.</p>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-3">
              {filteredSemesterGrades.map((item, idx) => (
                <div
                  key={`${item.courseCode}-${idx}`}
                  onClick={() => setSelectedSemGrade(item)}
                  className="p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm flex items-center justify-between gap-4 active:opacity-75 hover:bg-muted/5 transition-all cursor-pointer backdrop-blur-md"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground/30 tabular-nums w-5 shrink-0">
                      {item.slNo ?? idx + 1}
                    </span>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 font-medium flex-wrap">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide leading-none">
                          {item.courseCode}
                        </span>
                        <span>&bull;</span>
                        <span className="uppercase">{item.courseType.length > 15 ? item.courseType.slice(0, 12) + "..." : item.courseType}</span>
                        <span>&bull;</span>
                        <span>{item.credits.c} Credits</span>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug truncate">
                        {item.courseTitle}
                      </p>
                      {item.grandTotal !== undefined && item.grandTotal !== null && (
                        <p className="text-xs text-muted-foreground/50 font-mono leading-none pt-0.5">
                          Total Marks: {item.grandTotal}
                        </p>
                      )}
                    </div>

                    <span className="text-xl font-black tracking-tight shrink-0 w-8 text-center leading-none text-foreground">
                      {item.grade}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: GRADE HISTORY ──────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <>
          {/* Error Banner */}
          {historyError && !isNetworkError(historyError, isOnline) && (
            <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
              <p className="text-xs font-semibold truncate">Sync failed — {historyError}</p>
              <button onClick={loadHistory} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">
                Retry
              </button>
            </div>
          )}

          {/* Stats Card */}
          <div className="relative z-10 bg-card/80 border border-border/40 p-5 rounded-xl shadow-sm flex items-center justify-between text-center backdrop-blur-md">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">Subjects</p>
              <p className="text-2xl font-black text-foreground leading-none">{totalSubjects}</p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-border/15 shrink-0 mx-2" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">Credits</p>
              <p className="text-2xl font-black text-foreground leading-none">{totalCredits}</p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-border/15 shrink-0 mx-2" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">CGPA</p>
              <p className="text-2xl font-black text-foreground leading-none">{cgpaVal}</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="relative z-10 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-card/80 border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
            <DrawerSelect
              value={selectedGradeFilter}
              onValueChange={setSelectedGradeFilter}
              title="Filter by Grade"
              triggerClassName="w-full h-10"
              options={[
                { value: "ALL", label: "All Grades" },
                ...["S", "A", "B", "C", "D", "E", "F", "P", "N"].map((g) => ({ value: g, label: `Grade ${g}` })),
              ]}
            />
          </div>

          {/* Course List */}
          {filteredHistoryGrades.length === 0 ? (
            <div className="relative z-10 flex flex-col items-center justify-center py-16 gap-3 text-center bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md">
              <FileText className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-foreground leading-none">No grades found</p>
              <p className="text-xs text-muted-foreground">Try modifying your search or filter.</p>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-3">
              {filteredHistoryGrades.map((item, idx) => (
                <div
                  key={`${item.courseCode}-${idx}`}
                  onClick={() => setSelectedHistoryGrade(item)}
                  className="p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm flex items-center justify-between gap-4 active:opacity-75 hover:bg-muted/5 transition-all cursor-pointer backdrop-blur-md"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground/30 tabular-nums w-5 shrink-0">
                      {item.slNo ?? idx + 1}
                    </span>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 font-medium flex-wrap">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide leading-none">
                          {item.courseCode}
                        </span>
                        <span>&bull;</span>
                        <span className="uppercase">{item.courseType.trim().length > 15 ? item.courseType.trim().slice(0, 12) + "..." : item.courseType.trim()}</span>
                        <span>&bull;</span>
                        <span>{item.credits} Credits</span>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug truncate">
                        {item.courseTitle}
                      </p>
                      <p className="text-xs text-muted-foreground/50 font-mono leading-none pt-0.5">
                        Exam Session: {item.examMonth}
                      </p>
                    </div>

                    <span className="text-xl font-black tracking-tight shrink-0 w-8 text-center leading-none text-foreground">
                      {item.grade.trim().toUpperCase()}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Grade Distribution */}
          {historyData?.cgpa?.gradeDistribution && (
            <section className="relative z-10 space-y-4 pt-2">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
                Grade Distribution
              </h3>
              <div className="bg-card/80 border border-border/40 p-5 rounded-xl shadow-sm backdrop-blur-md">
                <div className="grid grid-cols-3 gap-3">
                  {["S", "A", "B", "C", "D", "E", "F", "P", "N"].map((label) => {
                    const count = gradeCounts[label] ?? 0;
                    const pct = totalSubjects > 0 ? (count / totalSubjects) * 100 : 0;
                    return (
                      <div key={label} className="bg-muted/15 border border-border/15 rounded-xl p-3 flex flex-col justify-between gap-2 relative overflow-hidden">
                        <div 
                          className="absolute bottom-0 left-0 h-0.5 bg-primary/30 transition-all duration-500" 
                          style={{ width: `${pct}%` }} 
                        />
                        <div className="flex items-center justify-between leading-none">
                          <span className="text-xs font-black uppercase text-muted-foreground/45 tracking-wider">
                            Grade {label}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground/30">
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="flex items-baseline gap-0.5 leading-none">
                          <span className="text-xl font-black text-foreground">{count}</span>
                          <span className="text-xs font-semibold text-muted-foreground/45 ml-0.5">{count === 1 ? "course" : "courses"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Drawers */}
      <SemesterGradeDrawer
        item={selectedSemGrade}
        open={!!selectedSemGrade}
        onOpenChange={(open: boolean) => !open && setSelectedSemGrade(null)}
      />

      <HistoryGradeDrawer
        item={selectedHistoryGrade}
        open={!!selectedHistoryGrade}
        onOpenChange={(open: boolean) => !open && setSelectedHistoryGrade(null)}
      />
    </div>
  );
}
