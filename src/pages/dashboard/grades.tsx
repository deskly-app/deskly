import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGradesHistory, StudentHistoryData } from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  BookOpen,
  Bookmark,
  Award,
  Search,
  HelpCircle,
  FileText
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCourseType(type: string) {
  const clean = type.trim().toUpperCase();
  let colorClass = "text-muted-foreground";
  if (clean === "TH") colorClass = "text-chart-1 font-bold";
  else if (clean === "LO" || clean === "LA") colorClass = "text-chart-2 font-bold";
  else if (clean === "ETL") colorClass = "text-chart-4 font-bold";
  else if (clean === "PJT") colorClass = "text-chart-3 font-bold";
  else if (clean === "SS") colorClass = "text-chart-5 font-bold";
  
  return (
    <span className={`text-xs tracking-wide ${colorClass}`}>
      {clean}
    </span>
  );
}

function formatGrade(grade: string) {
  const clean = grade.trim().toUpperCase();
  let colorClass = "text-muted-foreground";
  if (clean === "S" || clean === "A") colorClass = "text-chart-2 font-black";
  else if (clean === "B") colorClass = "text-chart-3 font-black";
  else if (clean === "C" || clean === "P") colorClass = "text-chart-1 font-black";
  else if (clean === "D") colorClass = "text-chart-5 font-black";
  else if (clean === "E" || clean === "F") colorClass = "text-destructive font-black";

  return (
    <span className={`text-sm tracking-wide ${colorClass}`}>
      {clean}
    </span>
  );
}

function formatDistribution(dist: string) {
  const clean = dist.trim().toUpperCase();
  return (
    <span className="text-xs font-semibold text-muted-foreground tracking-wide">
      {clean}
    </span>
  );
}


function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

// ─── Loader Skeleton Layout ───────────────────────────────────────────────────
function GradesSkeleton() {
  return (
    <div className="w-full lg:h-[calc(100vh-5rem)] lg:flex lg:flex-col lg:overflow-hidden space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between pb-6 border-b border-border/40 shrink-0">
        <div className="space-y-2">
          <Sk className="h-7 w-36" />
          <Sk className="h-3 w-52" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 min-h-[104px]">
            <div className="flex items-center justify-between w-full">
              <Sk className="h-3 w-16" />
              <Sk className="h-4 w-4 rounded-md" />
            </div>
            <Sk className="h-7 w-12 mt-3" />
          </div>
        ))}
      </div>


      {/* Search & filters skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-border/20 shrink-0 pt-4">
        <div className="space-y-2">
          <Sk className="h-5 w-44" />
          <Sk className="h-3 w-64" />
        </div>
        <div className="flex gap-3">
          <Sk className="h-9 w-48 rounded-md" />
          <Sk className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-2 pr-2">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border/30 text-xs font-black uppercase tracking-wider text-muted-foreground">
              <th className="py-4 px-3 w-12">#</th>
              <th className="py-4 px-3 w-28">Course Code</th>
              <th className="py-4 px-3">Course Title</th>
              <th className="py-4 px-3 w-28">Course Type</th>
              <th className="py-4 px-3 w-20 text-center">Credits</th>
              <th className="py-4 px-3 w-20 text-center">Grade</th>
              <th className="py-4 px-3 w-28">Exam Month</th>
              <th className="py-4 px-3 w-32">Result Declared</th>
              <th className="py-4 px-3 w-36">Course Distribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10 text-sm font-semibold">
            {[...Array(8)].map((_, i) => (
              <tr key={i} className="animate-pulse border-b border-border/10">
                <td className="py-4 px-3"><Sk className="h-4 w-6" /></td>
                <td className="py-4 px-3"><Sk className="h-4 w-20" /></td>
                <td className="py-4 px-3"><Sk className="h-4 w-64" /></td>
                <td className="py-4 px-3"><Sk className="h-5 w-12 rounded" /></td>
                <td className="py-4 px-3 text-center"><Sk className="h-4 w-8 mx-auto" /></td>
                <td className="py-4 px-3 text-center"><Sk className="h-5 w-8 rounded-full mx-auto" /></td>
                <td className="py-4 px-3"><Sk className="h-4 w-16" /></td>
                <td className="py-4 px-3"><Sk className="h-4 w-24" /></td>
                <td className="py-4 px-3"><Sk className="h-5 w-16 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function GradesPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [data, setData] = useState<StudentHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("ALL");

  // Load from Cache (SWR) first
  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::grades");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as StudentHistoryData;
        if (parsed && parsed.grades && parsed.grades.length > 0) {
          setData(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached grades", e);
      }
    }
  }, []);

  // Fetch fresh grades data
  async function load() {
    try {
      if (!isLoggedIn && !authLoading) return;
      setError(null);
      if (authLoading) return;

      setLoading(data && data.grades && data.grades.length > 0 ? false : true);

      const res = await getGradesHistory();
      if (res.success && res.data) {
        setData(res.data);
        localStorage.setItem("deskly::cache::grades", JSON.stringify(res.data));
      } else {
        setError(res.error ?? "Failed to fetch grade history.");
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
  const totalSubjects = useMemo(() => data?.grades?.length ?? 0, [data]);
  const totalCredits = useMemo(() => data?.cgpa?.creditsEarned ?? 0, [data]);
  const cgpaVal = useMemo(() => data?.cgpa?.cgpa ?? 0, [data]);

  // Grade distribution counts computed dynamically from grades list for accuracy
  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, P: 0, N: 0
    };
    if (data?.grades) {
      data.grades.forEach((g) => {
        const cleanGrade = g.grade.trim().toUpperCase();
        if (cleanGrade in counts) {
          counts[cleanGrade]++;
        } else {
          counts[cleanGrade] = (counts[cleanGrade] || 0) + 1;
        }
      });
    }
    return counts;
  }, [data]);

  // Filtered grades list
  const filteredGrades = useMemo(() => {
    if (!data?.grades) return [];
    return data.grades.filter((g) => {
      const matchesSearch =
        g.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.courseTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGrade =
        selectedGradeFilter === "ALL" || g.grade.trim().toUpperCase() === selectedGradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [data, searchQuery, selectedGradeFilter]);

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (authLoading || (loading && !data)) {
    return shell(<GradesSkeleton />);
  }

  if (error && !data) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full lg:h-[calc(100vh-5rem)] lg:flex lg:flex-col lg:overflow-hidden space-y-6">
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
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/20 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary shrink-0" />
            My Grades
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Your complete academic records</p>
        </div>
      </header>

      {/* ── Top Stats Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        
        {/* Total Subjects */}
        <div className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-primary/10 transition-colors duration-200 min-h-[104px]">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Total Subjects</span>
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground leading-none">{totalSubjects}</span>
            <span className="text-xs font-bold text-muted-foreground/60 leading-none">Completed</span>
          </div>
        </div>

        {/* Total Credits */}
        <div className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-primary/10 transition-colors duration-200 min-h-[104px]">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Total Credits</span>
            <Bookmark className="w-5 h-5 text-primary shrink-0" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground leading-none">{totalCredits}</span>
            <span className="text-xs font-bold text-muted-foreground/60 leading-none">Earned</span>
          </div>
        </div>

        {/* CGPA */}
        <div className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-primary/10 transition-colors duration-200 min-h-[104px]">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">SGPA (Current)</span>
            <Award className="w-5 h-5 text-primary shrink-0" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground leading-none">{cgpaVal}</span>
            <span className="text-xs font-bold text-muted-foreground/60 leading-none">Cumulative</span>
          </div>
        </div>

      </div>


      {/* ── Search & Filter Controls ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/20 shrink-0 pt-2">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">Academic Grade History</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Chronological record of course assessments and completions</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-48 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Search code or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 w-full h-9 bg-muted/40 hover:bg-muted/60 focus:bg-background border-border/40 rounded-md text-xs focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
          
          {/* Grade Filter Select */}
          <Select value={selectedGradeFilter} onValueChange={setSelectedGradeFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 rounded-md bg-muted/40 hover:bg-muted/60 border-border/40 text-xs focus:ring-1 focus:ring-primary/30">
              <SelectValue placeholder="All Grades" />
            </SelectTrigger>
            <SelectContent className="rounded-md border-border/40 bg-popover/95 backdrop-blur-md">
              <SelectItem value="ALL" className="rounded-md">All Grades</SelectItem>
              {["S", "A", "B", "C", "D", "E", "F", "P", "N"].map((g) => (
                <SelectItem key={g} value={g} className="rounded-md">
                  Grade {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Table: Grade History ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-2">
        {filteredGrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-bold text-foreground">No grades found</p>
              <p className="text-xs text-muted-foreground mt-1">Try modifying your search or filter settings.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar -mx-6 px-6 md:mx-0 md:px-0">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border/30 text-xs font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-4 px-3 w-12">#</th>
                  <th className="py-4 px-3 w-28">Course Code</th>
                  <th className="py-4 px-3">Course Title</th>
                  <th className="py-4 px-3 w-28">Course Type</th>
                  <th className="py-4 px-3 w-20 text-center">Credits</th>
                  <th className="py-4 px-3 w-20 text-center">Grade</th>
                  <th className="py-4 px-3 w-28">Exam Month</th>
                  <th className="py-4 px-3 w-32">Result Declared</th>
                  <th className="py-4 px-3 w-36">Course Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-sm font-semibold text-muted-foreground/90">
                {filteredGrades.map((item, idx) => (
                  <tr key={`${item.courseCode}-${idx}`} className="hover:bg-muted/15 transition-colors duration-150 border-b border-border/10">
                    <td className="py-4 px-3 font-bold text-foreground/80">{item.slNo ?? idx + 1}</td>
                    <td className="py-4 px-3 font-extrabold tracking-wider text-primary uppercase">{item.courseCode}</td>
                    <td className="py-4 px-3 font-bold text-foreground leading-normal max-w-[200px] md:max-w-[350px] break-words" title={item.courseTitle}>
                      {item.courseTitle}
                    </td>
                    <td className="py-4 px-3">{formatCourseType(item.courseType)}</td>
                    <td className="py-4 px-3 text-center font-bold text-foreground">{item.credits}</td>
                    <td className="py-4 px-3 text-center">{formatGrade(item.grade)}</td>
                    <td className="py-4 px-3 text-xs font-bold">{item.examMonth}</td>
                    <td className="py-4 px-3 text-xs font-bold">{item.resultDeclared || "-"}</td>
                    <td className="py-4 px-3">{formatDistribution(item.courseDistribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer: Grades Summary Breakdown & Grade Key ─────────────────────── */}
      {data?.cgpa?.gradeDistribution && (
        <footer className="space-y-6 pt-6 border-t border-border/20 shrink-0">
          
          {/* Grades Summary Breakdown */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 rounded-lg bg-muted/20 border border-border/10">
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-primary" /> Grades Summary
              </h3>
              <p className="text-xs text-muted-foreground font-semibold">Cumulative distribution count across all semesters</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {[
                { label: "S", count: gradeCounts.S, color: "bg-chart-2/10 text-chart-2 border border-chart-2/15" },
                { label: "A", count: gradeCounts.A, color: "bg-chart-2/5 text-chart-2 border border-chart-2/10" },
                { label: "B", count: gradeCounts.B, color: "bg-chart-3/10 text-chart-3 border border-chart-3/15" },
                { label: "C", count: gradeCounts.C, color: "bg-chart-1/10 text-chart-1 border border-chart-1/15" },
                { label: "D", count: gradeCounts.D, color: "bg-chart-5/10 text-chart-5 border border-chart-5/15" },
                { label: "E", count: gradeCounts.E, color: "bg-destructive/10 text-destructive border border-destructive/15" },
                { label: "F", count: gradeCounts.F, color: "bg-destructive/15 text-destructive border border-destructive/20" },
                { label: "P", count: gradeCounts.P, color: "bg-chart-1/5 text-chart-1 border border-chart-1/10" },
                { label: "N", count: gradeCounts.N, color: "bg-muted text-muted-foreground border border-border/20" },
              ].map(({ label, count, color }) => (
                <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-black leading-none ${color}`}>
                  <span>{label}</span>
                  <span className="opacity-30 font-normal">|</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>

        </footer>
      )}

    </div>
  );
}
