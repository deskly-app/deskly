import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getTimetableCourses, TimetableCourse } from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Monitor,
  Beaker,
  Globe,
  Users,
  Search,
  FileText,
  User,
  MapPin,
  X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCourseTypeStyle(type: string): { label: string; className: string } {
  const clean = type.trim().toUpperCase();
  if (clean.includes("EMBEDDED THEORY")) return { label: type, className: "text-primary" };
  if (clean.includes("EMBEDDED LAB")) return { label: type, className: "text-primary" };
  if (clean.includes("THEORY")) return { label: type, className: "text-primary" };
  if (clean.includes("LAB")) return { label: type, className: "text-primary" };
  if (clean.includes("ONLINE")) return { label: type, className: "text-primary" };
  if (clean.includes("SOFT SKILL") || clean.includes("SKILL")) return { label: type, className: "text-primary" };
  return { label: type, className: "text-muted-foreground" };
}

function getCategoryStyle(category: string): { label: string; className: string } {
  const clean = category.trim();
  return { label: clean, className: "text-muted-foreground" };
}

// ─── Desktop Course Row Component ─────────────────────────────────────────────

function DesktopCourseRow({ item, index }: { item: TimetableCourse; index: number }) {
  const typeStyle = getCourseTypeStyle(item.courseType);
  const catStyle = getCategoryStyle(item.category);

  return (
    <div className="py-4 border-b border-border/20 hover:bg-muted/5 transition-colors hidden md:grid grid-cols-[1fr_280px_120px] items-center gap-6 min-w-0">
      
      {/* Left: Code, Badges & Title */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs font-bold text-muted-foreground/40 tabular-nums shrink-0">
            #{(index + 1).toString().padStart(2, "0")}
          </span>
          <span className="text-xs font-black tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full leading-none shrink-0">
            {item.code}
          </span>
          {item.slot && (
            <span className="font-mono text-xs font-bold text-muted-foreground/80 bg-muted/50 border border-border/20 px-2.5 py-0.5 rounded-full leading-none shrink-0">
              Slot: {item.slot}
            </span>
          )}
          <span className="text-xs font-semibold text-muted-foreground shrink-0">
            {typeStyle.label}
          </span>
          {item.category && (
            <span className="text-xs font-medium text-muted-foreground/70 bg-muted/40 border border-border/20 px-2.5 py-0.5 rounded-full leading-none shrink-0 truncate max-w-[240px]" title={catStyle.label}>
              {catStyle.label}
            </span>
          )}
        </div>
        
        <h3 className="text-base font-bold text-foreground leading-snug truncate">
          {item.title}
        </h3>
      </div>

      {/* Middle: Instructor & Venue */}
      <div className="space-y-1 min-w-0">
        {item.faculty?.name ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate" title={item.faculty.name}>
              {item.faculty.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
        {item.venue && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <span className="font-medium truncate">{item.venue}</span>
            {item.faculty?.school && (
              <span className="text-[11px] text-muted-foreground/40 font-semibold uppercase">
                · {item.faculty.school}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Credits */}
      <div className="text-right space-y-0.5">
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-xl font-black text-foreground tabular-nums leading-none">
            {item.credits?.total ?? 0}
          </span>
          <span className="text-xs text-muted-foreground/50 font-medium">Credits</span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/50 leading-none tabular-nums">
          L-T-P-J: {item.credits?.lecture ?? 0}-{item.credits?.tutorial ?? 0}-{item.credits?.practical ?? 0}-{item.credits?.project ?? 0}
        </p>
      </div>

    </div>
  );
}

// ─── Mobile Course Card Component ─────────────────────────────────────────────

function MobileCourseCard({ item, index }: { item: TimetableCourse; index: number }) {
  const typeStyle = getCourseTypeStyle(item.courseType);
  const catStyle = getCategoryStyle(item.category);

  return (
    <div className="py-4 border-b border-border/20 space-y-3 block md:hidden">
      {/* Top row: Code, Slot, Type, Category */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-muted-foreground/40 tabular-nums shrink-0">
          #{(index + 1).toString().padStart(2, "0")}
        </span>
        <span className="text-xs font-black tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full leading-none shrink-0">
          {item.code}
        </span>
        {item.slot && (
          <span className="font-mono text-xs font-bold text-muted-foreground/80 bg-muted/50 border border-border/20 px-2.5 py-0.5 rounded-full leading-none shrink-0">
            Slot: {item.slot}
          </span>
        )}
        <span className="text-xs font-semibold text-muted-foreground shrink-0">
          {typeStyle.label}
        </span>
        {item.category && (
          <span className="text-xs font-medium text-muted-foreground/70 bg-muted/40 border border-border/20 px-2.5 py-0.5 rounded-full leading-none shrink-0 truncate max-w-[200px]" title={catStyle.label}>
            {catStyle.label}
          </span>
        )}
      </div>

      {/* Course Title */}
      <h3 className="text-base font-bold text-foreground leading-snug">
        {item.title}
      </h3>

      {/* Separator Divider */}
      <div className="h-px w-full bg-border/20" />

      {/* Bottom info: Faculty/Venue on left, Credits on right */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          {item.faculty?.name ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate">
                {item.faculty.name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          )}
          {item.venue && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              <span className="font-medium truncate">{item.venue}</span>
              {item.faculty?.school && (
                <span className="text-[11px] text-muted-foreground/40 font-semibold uppercase">
                  · {item.faculty.school}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="text-right shrink-0 space-y-0.5">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-lg font-black text-foreground tabular-nums leading-none">
              {item.credits?.total ?? 0}
            </span>
            <span className="text-xs text-muted-foreground/50 font-medium">Credits</span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground/50 leading-none tabular-nums">
            L-T-P-J: {item.credits?.lecture ?? 0}-{item.credits?.tutorial ?? 0}-{item.credits?.practical ?? 0}-{item.credits?.project ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CoursesSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between pb-4 border-b border-border/20">
        <div className="space-y-2">
          <div className="animate-pulse rounded bg-muted/60 h-7 w-48" />
          <div className="animate-pulse rounded bg-muted/60 h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-y border-border/20 py-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-start pr-4 border-r border-border/20 last:border-r-0 space-y-1.5">
            <div className="animate-pulse rounded bg-muted/60 h-3 w-16" />
            <div className="animate-pulse rounded bg-muted/60 h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="animate-pulse rounded-md bg-muted/60 h-10" />
        <div className="animate-pulse rounded-md bg-muted/60 h-10" />
        <div className="animate-pulse rounded-md bg-muted/60 h-10" />
      </div>
      <div className="divide-y divide-border/20 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="py-4 flex flex-col md:grid md:grid-cols-[1fr_280px_120px] gap-4">
            <div className="space-y-2">
              <div className="rounded bg-muted/60 h-4 w-24" />
              <div className="rounded bg-muted/60 h-5 w-2/3" />
            </div>
            <div className="rounded bg-muted/60 h-4 w-40" />
            <div className="rounded bg-muted/60 h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function CoursesPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [courses, setCourses] = useState<TimetableCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::courses");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TimetableCourse[];
        if (parsed.length > 0) {
          setCourses(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached courses", e);
      }
    }
  }, []);

  async function load() {
    try {
      if (!isLoggedIn && !authLoading) return;
      setError(null);
      if (authLoading) return;

      setLoading(courses.length > 0 ? false : true);

      const res = await getTimetableCourses();
      if (res.success && res.data) {
        setCourses(res.data);
        localStorage.setItem("deskly::cache::courses", JSON.stringify(res.data));
      } else {
        setError(res.error ?? "Failed to fetch registered courses.");
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

  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const categories = new Set<string>();
    courses.forEach((c) => {
      if (c.courseType) types.add(c.courseType.trim());
      if (c.category) categories.add(c.category.trim());
    });
    return {
      types: Array.from(types).sort(),
      categories: Array.from(categories).sort(),
    };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        selectedTypeFilter === "ALL" || c.courseType.trim() === selectedTypeFilter;
      const matchesCategory =
        selectedCategoryFilter === "ALL" || c.category.trim() === selectedCategoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [courses, searchQuery, selectedTypeFilter, selectedCategoryFilter]);

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

    return {
      total,
      theory: { count: theoryCount, credits: theoryCredits },
      lab: { count: labCount, credits: labCredits },
      online: { count: onlineCount, credits: onlineCredits },
      softSkill: { count: softSkillCount, credits: softSkillCredits },
      totalCredits,
    };
  }, [courses]);

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (authLoading || (loading && courses.length === 0)) {
    return shell(<CoursesSkeleton />);
  }

  if (error && courses.length === 0) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  const isLoading = authLoading || loading;

  return shell(
    <div className="w-full space-y-6 select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary shrink-0" />
            My Registered Courses
          </h1>
          <p className="text-xs text-muted-foreground">Courses you are registered for this semester</p>
        </div>
        {!isLoading && courses.length > 0 && (
          <span className="text-xs text-muted-foreground/60 font-semibold pb-0.5">
            {filteredCourses.length} of {courses.length} courses
          </span>
        )}
      </header>

      {/* ── Top Stats Grid ──────────────────────────────────────────────────── */}
      <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-y border-border/20 py-5">
        {[
          { label: "Total Courses", value: courseStats.total, sub: "" },
          { label: "Total Credits", value: courseStats.totalCredits, sub: "Cr" },
          { label: "Theory", value: courseStats.theory.count, sub: `${courseStats.theory.credits} Cr` },
          { label: "Lab", value: courseStats.lab.count, sub: `${courseStats.lab.credits} Cr` },
          { label: "Online", value: courseStats.online.count, sub: `${courseStats.online.credits} Cr` },
          { label: "Soft Skill", value: courseStats.softSkill.count, sub: `${courseStats.softSkill.credits} Cr` },
        ].map((stat, idx) => (
          <div
            key={stat.label}
            className={`flex items-center justify-start py-2.5 px-3 border-border/20 ${
              idx % 2 === 0 ? "border-r md:border-r" : "md:border-r"
            } ${idx === 5 ? "md:border-r-0 lg:border-r-0" : ""} ${
              idx < 4 ? "border-b md:border-b-0" : ""
            }`}
          >
            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider block truncate">{stat.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl lg:text-3xl font-black text-foreground leading-none tabular-nums">{stat.value}</span>
                {stat.sub && <span className="text-xs text-muted-foreground/50 font-medium leading-none">{stat.sub}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filters ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading}
            className="w-full h-10 pl-10 pr-10 rounded-lg border border-border/20 bg-muted/10 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-50 text-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
          <SelectTrigger className="w-full h-10 rounded-lg bg-muted/10 border-border/20 text-xs">
            <SelectValue placeholder="All Course Types" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border/30 bg-card">
            <SelectItem value="ALL">All Course Types</SelectItem>
            {filterOptions.types.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
          <SelectTrigger className="w-full h-10 rounded-lg bg-muted/10 border-border/20 text-xs">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border/30 bg-card">
            <SelectItem value="ALL">All Categories</SelectItem>
            {filterOptions.categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Registered Courses List ─────────────────────────────────────────── */}
      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center border-b border-border/20">
          <FileText className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm font-bold text-foreground">No registered courses found</p>
          <p className="text-xs text-muted-foreground">Try modifying your filters or search terms.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Table Header on Desktop */}
          <div className="hidden md:grid grid-cols-[1fr_280px_120px] items-center gap-6 pb-2.5 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest border-b border-border/20">
            <div>Course Information</div>
            <div>Instructor & Venue</div>
            <div className="text-right">Credits</div>
          </div>

          {/* List Rows */}
          <div className="flex flex-col">
            {filteredCourses.map((item, idx) => (
              <div key={`${item.code}-${idx}`}>
                <DesktopCourseRow item={item} index={idx} />
                <MobileCourseCard item={item} index={idx} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer Summary ──────────────────────────────────────────────────── */}
      {courses.length > 0 && (
        <footer className="pt-4 border-t border-border/20 mt-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Credit Summary</h3>
                <p className="text-xs text-muted-foreground/60">Semester credit breakdown</p>
              </div>
            </div>
            <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider leading-none">Total</span>
              <span className="text-base font-black leading-none tabular-nums">{courseStats.totalCredits}</span>
              <span className="text-xs font-semibold leading-none opacity-70">Cr</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <Monitor className="w-3.5 h-3.5 text-primary" />, label: "Theory", count: courseStats.theory.count, credits: courseStats.theory.credits },
              { icon: <Beaker className="w-3.5 h-3.5 text-primary" />, label: "Lab", count: courseStats.lab.count, credits: courseStats.lab.credits },
              { icon: <Globe className="w-3.5 h-3.5 text-primary" />, label: "Online", count: courseStats.online.count, credits: courseStats.online.credits },
              { icon: <Users className="w-3.5 h-3.5 text-primary" />, label: "Soft Skill", count: courseStats.softSkill.count, credits: courseStats.softSkill.credits },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">{row.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 truncate">{row.label}</p>
                  <p className="text-sm font-black text-foreground leading-none tabular-nums">
                    {row.count}
                    <span className="text-xs font-semibold text-muted-foreground/60 ml-1">({row.credits} Cr)</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </footer>
      )}

    </div>
  );
}
