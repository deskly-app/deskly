import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getTimetableCourses, TimetableCourse } from "@/lib/features";
import { Separator } from "@/components/ui/separator";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

import { ErrorDisplay } from "@/components/error-display";
import { DrawerSelect } from "@/components/ui/drawer-select";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import courseImg from "@/assets/course.png";
import {
  Layers,
  Monitor,
  FileText,
  User,
  MapPin,
  LayoutGrid,
  School,
  ChevronRight,
  X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CourseDetailDrawer({
  item,
  open,
  onOpenChange,
}: {
  item: TimetableCourse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;

  const displayType = item.courseType.toLowerCase().includes("lab") ? "Lab Only" : "Theory Only";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[calc(1.5rem+env(safe-area-inset-bottom))] font-saira max-h-[92vh] bg-background border-t border-border/10 rounded-t-[32px] flex flex-col">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-6 flex-1">
          
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black uppercase bg-primary/10 text-primary border border-primary/10 tracking-wider">
                  {item.code}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black uppercase bg-muted text-muted-foreground tracking-wider">
                  {displayType}
                </span>
                {item.category && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black uppercase bg-accent/15 text-accent-foreground tracking-wider border border-accent/10">
                    {item.category}
                  </span>
                )}
                {item.status && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 tracking-wider">
                    {item.status}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-extrabold text-foreground leading-snug tracking-tight">
                {item.title}
              </h2>
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground active:opacity-75 transition-all border-none cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Separator className="bg-border/10" />

          {/* 1. Core Scheduling Information Box (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-y-5 gap-x-4 py-1">
            {/* Slot */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/45 uppercase tracking-widest leading-none block">
                Class Slot
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground">{item.slot || "—"}</span>
              </div>
            </div>

            {/* Venue */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/45 uppercase tracking-widest leading-none block">
                Classroom Venue
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate">{item.venue || "—"}</span>
              </div>
            </div>

            {/* Class ID */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/45 uppercase tracking-widest leading-none block">
                Class ID
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate">{item.classId || "—"}</span>
              </div>
            </div>

            {/* Class Group */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground/45 uppercase tracking-widest leading-none block">
                Group
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <Monitor className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-foreground">{item.classGroup || "—"}</span>
              </div>
            </div>
          </div>

          <Separator className="bg-border/10" />

          {/* 2. Credit Breakdown Widget */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none pl-1">
              Credit Breakdown
            </h3>
            <div className="grid grid-cols-4 divide-x divide-border/10 text-center py-2 bg-muted/10 rounded-lg border border-border/5">
              {[
                { label: "Lecture (L)", val: item.credits?.lecture ?? 0 },
                { label: "Tutorial (T)", val: item.credits?.tutorial ?? 0 },
                { label: "Practical (P)", val: item.credits?.practical ?? 0 },
                { label: "Project (J)", val: item.credits?.project ?? 0 },
              ].map(({ label, val }) => (
                <div key={label} className="space-y-1">
                  <p className="text-lg font-black text-foreground">{val}</p>
                  <p className="text-xs font-bold text-muted-foreground/45 uppercase tracking-wider leading-none">
                    {label.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Registration Details */}
          {(item.registrationOption || item.registrationDate) && (
            <>
              <Separator className="bg-border/10" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground/45 uppercase tracking-widest leading-none block">
                    Registration Option
                  </span>
                  <span className="text-sm font-semibold text-foreground block pt-0.5">{item.registrationOption || "—"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground/45 uppercase tracking-widest leading-none block">
                    Registration Date
                  </span>
                  <span className="text-sm font-semibold text-foreground block pt-0.5">{item.registrationDate || "—"}</span>
                </div>
              </div>
            </>
          )}

          {/* 4. Faculty Details */}
          {(item.faculty?.name || item.faculty?.school) && (
            <>
              <Separator className="bg-border/10" />
              <div className="space-y-3">
                <h3 className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none pl-1">
                  Faculty Instructor
                </h3>
                
                <div className="flex items-center gap-4 py-1">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary border border-primary/10">
                    <User className="w-5.5 h-5.5" />
                  </div>
                  
                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="text-sm font-bold text-foreground truncate leading-none">
                      {item.faculty?.name || "—"}
                    </h4>
                    {item.faculty?.school && (
                      <div className="flex items-center gap-1.5 leading-none">
                        <School className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
                        <span className="text-xs text-muted-foreground/75 truncate">{item.faculty.school}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

function CoursesSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4">
      <div className="space-y-1">
        <Sk className="h-7 w-44" />
        <Sk className="h-3 w-56" />
      </div>
      <div className="bg-muted/30 dark:bg-muted/30 dark:bg-[#0e0e0f]/40 border border-border/40 dark:border-border/10 rounded-lg overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border/10">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <Sk className="h-3 w-14" />
              <Sk className="h-7 w-10" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Sk className="h-10 w-full rounded-md" />
        <div className="grid grid-cols-2 gap-3">
          <Sk className="h-10 rounded-md" />
          <Sk className="h-10 rounded-md" />
        </div>
      </div>
      <div className="bg-muted/30 dark:bg-muted/30 dark:bg-[#0e0e0f]/40 border border-border/40 dark:border-border/10 rounded-lg overflow-hidden divide-y divide-border/10">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="flex-1 space-y-2">
              <Sk className="h-3 w-24" />
              <Sk className="h-4 w-48" />
            </div>
            <Sk className="h-6 w-10 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function CoursesPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();

  const { data: rawData, loading, error, retry: load } = useOfflineData<TimetableCourse[]>({
    cacheKey: "deskly::cache::courses",
    fetcher: getTimetableCourses,
    enabled: isLoggedIn && !authLoading,
  });
  const courses = rawData || [];

  const [selectedCourse, setSelectedCourse] = useState<TimetableCourse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const categories = new Set<string>();
    courses.forEach((c) => {
      if (c.courseType) types.add(c.courseType.trim());
      if (c.category) categories.add(c.category.trim());
    });
    return { types: Array.from(types).sort(), categories: Array.from(categories).sort() };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesType = selectedTypeFilter === "ALL" || c.courseType.trim() === selectedTypeFilter;
      const matchesCategory = selectedCategoryFilter === "ALL" || c.category.trim() === selectedCategoryFilter;
      return matchesType && matchesCategory;
    });
  }, [courses, selectedTypeFilter, selectedCategoryFilter]);

  const courseStats = useMemo(() => {
    let total = 0, theoryCount = 0, theoryCredits = 0, labCount = 0, labCredits = 0;
    let onlineCount = 0, onlineCredits = 0, softSkillCount = 0, softSkillCredits = 0, totalCredits = 0;
    courses.forEach((c) => {
      total++;
      const type = c.courseType.toLowerCase();
      const credits = c.credits.total;
      totalCredits += credits;
      if (type.includes("embedded theory")) { theoryCount++; theoryCredits += credits; }
      else if (type.includes("embedded lab")) { labCount++; labCredits += credits; }
      else if (type.includes("theory")) { theoryCount++; theoryCredits += credits; }
      else if (type.includes("lab")) { labCount++; labCredits += credits; }
      else if (type.includes("online")) { onlineCount++; onlineCredits += credits; }
      else if (type.includes("soft skill") || type.includes("skill")) { softSkillCount++; softSkillCredits += credits; }
      else {
        if (c.code.endsWith("P")) { labCount++; labCredits += credits; }
        else { theoryCount++; theoryCredits += credits; }
      }
    });
    return { total, theory: { count: theoryCount, credits: theoryCredits }, lab: { count: labCount, credits: labCredits }, online: { count: onlineCount, credits: onlineCredits }, softSkill: { count: softSkillCount, credits: softSkillCredits }, totalCredits };
  }, [courses]);

  const shell = (children: React.ReactNode) => <>{children}</>;

  const showOffline = !rawData && !loading && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) {
    return shell(<OfflineDisplay onRetry={load} />);
  }

  if (authLoading || (loading && !rawData)) return shell(<CoursesSkeleton />);

  if (error && !rawData) {
    return shell(
      <div className="flex h-full items-center justify-center font-saira">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full space-y-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[200px] h-[160px] pointer-events-none select-none z-0">
        <img
          src={courseImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          style={{
            maskImage: "radial-gradient(ellipse at 30% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, #fff 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 80%, transparent 95%)"
          }}
          alt="Courses Illustration"
        />
      </div>

      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button onClick={load} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">Retry</button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-start gap-2">
        <Layers className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none truncate">
            My Courses
          </h1>
        </div>
      </header>

      {/* ── Stats block ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 bg-card/80 border border-border/40 p-5 rounded-xl shadow-md flex items-center justify-between text-center backdrop-blur-md">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">Total</p>
          <p className="text-2xl font-black text-foreground leading-none">{courseStats.total}</p>
        </div>
        <Separator orientation="vertical" className="h-8 bg-border/15 shrink-0 mx-2" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">Credits</p>
          <p className="text-2xl font-black text-foreground leading-none">{courseStats.totalCredits}</p>
        </div>
        <Separator orientation="vertical" className="h-8 bg-border/15 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none mb-2">Labs</p>
          <p className="text-2xl font-black text-foreground leading-none">{courseStats.lab.count}</p>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <DrawerSelect
            value={selectedTypeFilter}
            onValueChange={setSelectedTypeFilter}
            title="Filter by Type"
            triggerClassName="w-full h-10"
            options={[
              { value: "ALL", label: "All Types" },
              ...filterOptions.types.map((type) => ({ value: type, label: type })),
            ]}
          />
          <DrawerSelect
            value={selectedCategoryFilter}
            onValueChange={setSelectedCategoryFilter}
            title="Filter by Category"
            triggerClassName="w-full h-10"
            options={[
              { value: "ALL", label: "All Categories" },
              ...filterOptions.categories.map((cat) => ({ value: cat, label: cat })),
            ]}
          />
        </div>
      </div>

      {/* ── Section label ────────────────────────────────────────────────────── */}
      <h2 className="relative z-10 text-base font-semibold text-foreground tracking-tight leading-none uppercase">
        Registered Courses
      </h2>

      {/* ── Course List ──────────────────────────────────────────────────────── */}
      {filteredCourses.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-16 gap-3 text-center bg-muted/15 dark:bg-muted/15 dark:bg-[#0e0e0f]/20 border border-border/40 dark:border-border/10 rounded-lg">
          <FileText className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-foreground leading-none">No courses found</p>
          <p className="text-xs text-muted-foreground">Try modifying the type or category filters.</p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col gap-3">
          {filteredCourses.map((item, idx) => {
            return (
              <div
                key={`${item.code}-${idx}`}
                onClick={() => {
                  setSelectedCourse(item);
                  setDrawerOpen(true);
                }}
                className="p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm flex items-center justify-between gap-4 active:opacity-75 hover:bg-muted/5 transition-all cursor-pointer backdrop-blur-md"
              >
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Top row: index, code, type, slot, credits as plain text items */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 font-medium flex-wrap">
                    <span className="font-semibold text-muted-foreground/30 tabular-nums w-4 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide leading-none">
                      {item.code}
                    </span>
                    <span>&bull;</span>
                    <span className="uppercase">{item.courseType}</span>
                    {item.slot && (
                      <>
                        <span>&bull;</span>
                        <span className="font-mono">{item.slot}</span>
                      </>
                    )}
                    <span>&bull;</span>
                    <span>{item.credits?.total ?? 0} Credits</span>
                  </div>

                  {/* Title */}
                  <p className="text-sm font-bold text-foreground leading-snug">
                    {item.title}
                  </p>

                  {/* Faculty & Venue */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {item.faculty?.name && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
                        <span className="text-xs text-muted-foreground/75 truncate">{item.faculty.name}</span>
                      </div>
                    )}
                    {item.venue && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
                        <span className="text-xs text-muted-foreground/75">{item.venue}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chevron indicator */}
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer Summary ───────────────────────────────────────────────────── */}
      {courses.length > 0 && (
        <section className="relative z-10 space-y-4 pt-2">
          <h3 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
            Credit Distribution
          </h3>
          <div className="bg-card/80 border border-border/40 p-5 rounded-xl shadow-md backdrop-blur-md space-y-5">
            {/* Segmented Progress Track */}
            <div className="h-3 w-full bg-muted/20 rounded-full overflow-hidden flex border border-border/5">
              {courseStats.theory.credits > 0 && (
                <div 
                  style={{ width: `${courseStats.totalCredits > 0 ? (courseStats.theory.credits / courseStats.totalCredits) * 100 : 0}%` }} 
                  className="h-full bg-primary transition-all duration-500" 
                />
              )}
              {courseStats.lab.credits > 0 && (
                <div 
                  style={{ width: `${courseStats.totalCredits > 0 ? (courseStats.lab.credits / courseStats.totalCredits) * 100 : 0}%` }} 
                  className="h-full bg-primary/70 transition-all duration-500" 
                />
              )}
              {courseStats.online.credits > 0 && (
                <div 
                  style={{ width: `${courseStats.totalCredits > 0 ? (courseStats.online.credits / courseStats.totalCredits) * 100 : 0}%` }} 
                  className="h-full bg-primary/40 transition-all duration-500" 
                />
              )}
              {courseStats.softSkill.credits > 0 && (
                <div 
                  style={{ width: `${courseStats.totalCredits > 0 ? (courseStats.softSkill.credits / courseStats.totalCredits) * 100 : 0}%` }} 
                  className="h-full bg-primary/20 transition-all duration-500" 
                />
              )}
            </div>

            {/* Legend / Metrics Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-1">
              {[
                { label: "Theory", count: courseStats.theory.count, credits: courseStats.theory.credits, pct: courseStats.totalCredits > 0 ? Math.round((courseStats.theory.credits / courseStats.totalCredits) * 100) : 0, colorClass: "bg-primary" },
                { label: "Lab", count: courseStats.lab.count, credits: courseStats.lab.credits, pct: courseStats.totalCredits > 0 ? Math.round((courseStats.lab.credits / courseStats.totalCredits) * 100) : 0, colorClass: "bg-primary/70" },
                { label: "Online", count: courseStats.online.count, credits: courseStats.online.credits, pct: courseStats.totalCredits > 0 ? Math.round((courseStats.online.credits / courseStats.totalCredits) * 100) : 0, colorClass: "bg-primary/40" },
                { label: "Soft Skill", count: courseStats.softSkill.count, credits: courseStats.softSkill.credits, pct: courseStats.totalCredits > 0 ? Math.round((courseStats.softSkill.credits / courseStats.totalCredits) * 100) : 0, colorClass: "bg-primary/20" },
              ].map(({ label, count, credits, pct, colorClass }) => (
                <div key={label} className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${colorClass} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1 leading-none mb-1">
                      <span className="text-xs font-bold text-foreground truncate">{label}</span>
                      <span className="text-xs font-black text-muted-foreground/60 shrink-0">{pct}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground/45 leading-none">
                      {count} {count === 1 ? "course" : "courses"} &bull; {credits} Cr
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <CourseDetailDrawer
        item={selectedCourse}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
