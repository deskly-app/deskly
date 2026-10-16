import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getTimetableCourses, TimetableCourse } from "@/lib/features";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

import { ErrorDisplay } from "@/components/error-display";
import { DrawerSelect } from "@/components/ui/drawer-select";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import courseImg from "@/assets/course.webp";
import {
  Layers,
  Monitor,
  FileText,
  User,
  MapPin,
  LayoutGrid,
  School,
  X,
  ChevronRight,
} from "lucide-react";

// ─── Drawer Component ─────────────────────────────────────────────────────────
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

  const totalCredits = item.credits?.total ?? 0;

  const scheduleRows = [
    { icon: LayoutGrid, label: "Class Slot", value: item.slot },
    { icon: MapPin, label: "Classroom Venue", value: item.venue },
    { icon: FileText, label: "Class ID", value: item.classId },
    { icon: Monitor, label: "Class Group", value: item.classGroup },
  ].filter((r) => r.value);

  const academicRows = [
    { label: "Course Code", value: item.code },
    { label: "Course Type", value: item.courseType },
    { label: "Category", value: item.category },
    { label: "Status", value: item.status },
    { label: "Registration Option", value: item.registrationOption },
    { label: "Registration Date", value: item.registrationDate },
  ].filter((r) => r.value);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-h-[92vh] bg-background border-t border-border/10 rounded-t-[32px] flex flex-col">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-5 flex-1">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/10">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs leading-none">
                <span className="font-mono text-xs font-bold text-primary uppercase tracking-wider">
                  {item.code}
                </span>
                {item.courseType && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border/60 shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground/60 uppercase">
                      {item.courseType}
                    </span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-border/60 shrink-0" />
                <span className="text-xs font-bold text-muted-foreground/80 font-mono">
                  {totalCredits} {totalCredits === 1 ? "Credit" : "Credits"}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug tracking-tight break-words [overflow-wrap:anywhere]">
                {item.title}
              </h2>
            </div>

            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground active:opacity-75 transition-colors border-none cursor-pointer shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Credit Breakdown Section */}
          <div className="py-4 border-b border-border/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none">
                Credit Breakdown
              </span>
              <span className="text-xs font-bold text-primary uppercase font-mono tracking-wider leading-none">
                {totalCredits} Total
              </span>
            </div>
            <div className="grid grid-cols-4 divide-x divide-border/10 text-center py-2">
              {[
                { label: "Lecture", val: item.credits?.lecture ?? 0 },
                { label: "Tutorial", val: item.credits?.tutorial ?? 0 },
                { label: "Practical", val: item.credits?.practical ?? 0 },
                { label: "Project", val: item.credits?.project ?? 0 },
              ].map(({ label, val }) => (
                <div key={label} className="space-y-1 px-1">
                  <p className="text-xl font-black text-foreground tabular-nums leading-none">
                    {val}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider leading-none">
                    {label.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule & Classroom Details */}
          {scheduleRows.length > 0 && (
            <div className="py-4 border-b border-border/10 space-y-2">
              <span className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none block">
                Schedule & Venue
              </span>
              <div className="divide-y divide-border/10">
                {scheduleRows.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex flex-col min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between gap-1 min-[380px]:gap-4 py-3"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide leading-none">
                        {label}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground min-[380px]:text-right break-words [overflow-wrap:anywhere] min-w-0">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Faculty Instructor */}
          {(item.faculty?.name || item.faculty?.school) && (
            <div className="py-4 border-b border-border/10 space-y-2">
              <span className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none block">
                Faculty Instructor
              </span>
              <div className="flex items-start gap-3 pt-1">
                <User className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="text-sm font-bold text-foreground break-words [overflow-wrap:anywhere] leading-snug">
                    {item.faculty?.name || "—"}
                  </h4>
                  {item.faculty?.school && (
                    <div className="flex items-center gap-1.5 leading-none pt-0.5">
                      <School className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
                      <span className="text-xs text-muted-foreground/75 break-words [overflow-wrap:anywhere]">
                        {item.faculty.school}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Academic & Registration Information */}
          {academicRows.length > 0 && (
            <div className="py-4 space-y-2">
              <span className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase leading-none block">
                Course Details & Registration
              </span>
              <div className="divide-y divide-border/10">
                {academicRows.map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex flex-col min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between gap-1 min-[380px]:gap-4 py-3"
                  >
                    <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide leading-none shrink-0">
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-foreground min-[380px]:text-right break-words [overflow-wrap:anywhere] min-w-0">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Course Card Component (Mobile version) ───────────────────────────────────
function MobileCourseCard({
  item,
  onClick,
}: {
  item: TimetableCourse;
  onClick: () => void;
}) {
  const credits = item.credits?.total ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open details for ${item.code}: ${item.title}`}
      className="w-full flex items-center justify-between gap-4 py-4 px-3 text-left border-none bg-transparent hover:bg-muted/5 active:bg-muted/15 rounded-md transition-colors cursor-pointer"
    >
      {/* Details column */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* First line: Course Code & Slot */}
        <div className="flex items-center gap-2 leading-none flex-wrap">
          <span className="text-sm font-semibold tracking-wide text-foreground uppercase">
            {item.code}
          </span>
          {item.slot && (
            <span className="text-xs font-semibold text-muted-foreground/60 font-mono leading-none">
              ({item.slot})
            </span>
          )}
        </div>

        {/* Second line: Course Title (responsive wrap, never breaks layout) */}
        <p className="text-xs sm:text-sm font-medium text-muted-foreground break-words [overflow-wrap:anywhere] leading-snug">
          {item.title}
        </p>
      </div>

      {/* Right: Credits & Chevron */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-sm font-semibold text-foreground tabular-nums leading-none">
          {credits}{" "}
          <span className="text-xs font-normal text-muted-foreground/50">
            {credits === 1 ? "Credit" : "Credits"}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-muted-foreground/35 shrink-0" />
      </div>
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />;
}

function CoursesSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4">
      <div className="space-y-1">
        <Sk className="h-7 w-44" />
        <Sk className="h-3 w-56" />
      </div>
      <div className="grid grid-cols-3 py-5 border-y border-border/10 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="pl-2 space-y-2 border-l border-border/10 first:border-0">
            <Sk className="h-3 w-14" />
            <Sk className="h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Sk className="h-10 rounded-md" />
          <Sk className="h-10 rounded-md" />
        </div>
      </div>
      <div className="divide-y divide-border/10">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-4 px-3">
            <div className="flex-1 space-y-2">
              <Sk className="h-4 w-28" />
              <Sk className="h-3 w-48" />
            </div>
            <Sk className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full space-y-6 px-2 py-4 select-none relative">

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
      <header className="relative z-10 flex items-start gap-2 pb-1">
        <Layers className="w-6 h-6 text-primary shrink-0" />
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground leading-none truncate">
            My Courses
          </h1>
        </div>
      </header>

      {/* ── Stats grid (flat, divider based) ── */}
      <div className="relative z-10 py-5 border-y border-border/10 grid grid-cols-3 text-center">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest block leading-none mb-2">Total</span>
          <span className="text-2xl font-black text-foreground leading-none">{courseStats.total}</span>
        </div>
        <div className="border-l border-border/10">
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest block leading-none mb-2">Credits</span>
          <span className="text-2xl font-black text-foreground leading-none">{courseStats.totalCredits}</span>
        </div>
        <div className="border-l border-border/10">
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest block leading-none mb-2">Labs</span>
          <span className="text-2xl font-black text-foreground leading-none">{courseStats.lab.count}</span>
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
      <h2 className="relative z-10 text-xs font-bold text-primary uppercase tracking-widest leading-none">
        Registered Courses
      </h2>

      {/* ── Course List (divided list, flat card design) ── */}
      {filteredCourses.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-16 gap-3 text-center border border-border/10 rounded-lg">
          <FileText className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-foreground leading-none">No courses found</p>
          <p className="text-xs text-muted-foreground">Try modifying the type or category filters.</p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col divide-y divide-border/10 border-y border-border/10">
          {filteredCourses.map((item, idx) => (
            <MobileCourseCard
              key={`${item.code}-${idx}`}
              item={item}
              onClick={() => {
                setSelectedCourse(item);
                setDrawerOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* ── Credit Distribution Section ── */}
      {courses.length > 0 && (
        <section className="relative z-10 space-y-4 pt-2">
          <h3 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
            Credit Distribution
          </h3>
          <div className="py-5 border-y border-border/10 space-y-5">
            {/* Segmented Progress Track */}
            <div className="h-2 w-full bg-muted/20 rounded-full overflow-hidden flex">
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
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
                      {count} {count === 1 ? "course" : "courses"} · {credits} Cr
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
