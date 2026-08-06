import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@/router";
import { getCurriculumCategories, CurriculumCategory } from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import { ScrollText, ChevronRight } from "lucide-react";

// ─── Loader Skeleton Layout ───────────────────────────────────────────────────

function CategoriesSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between pb-6 border-b border-border/40">
        <div className="space-y-2">
          <div className="animate-pulse rounded-md bg-muted/65 h-7 w-44" />
          <div className="animate-pulse rounded-md bg-muted/65 h-3 w-52" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="bg-card/40 border border-border/30 rounded-lg p-5 min-h-[90px] space-y-3"
          >
            <div className="animate-pulse rounded-md bg-muted/65 h-3.5 w-16" />
            <div className="animate-pulse rounded-md bg-muted/65 h-5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function CurriculumIndexPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<CurriculumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache loading
  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::curriculum::categories");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CurriculumCategory[];
        if (parsed.length > 0) {
          setCategories(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached curriculum categories", e);
      }
    }
  }, []);

  async function load() {
    try {
      if (!isLoggedIn && !authLoading) return;
      setError(null);
      if (authLoading) return;

      setLoading(categories.length > 0 ? false : true);

      const res = await getCurriculumCategories();
      if (res.success && res.data) {
        setCategories(res.data);
        localStorage.setItem("deskly::cache::curriculum::categories", JSON.stringify(res.data));
      } else {
        setError(res.error ?? "Failed to fetch curriculum categories.");
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

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (authLoading || (loading && categories.length === 0)) {
    return shell(<CategoriesSkeleton />);
  }

  if (error && categories.length === 0) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/20">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-primary shrink-0" />
          Course Curriculum
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a curriculum category to view courses and download syllabus details
        </p>
      </header>

      {/* ── Curriculum Categories Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((category) => (
          <button
            key={category.code}
            onClick={() => navigate(`/dashboard/curriculum/${category.code}` as any)}
            className="group flex items-center justify-between text-left bg-card/30 hover:bg-card/60 border border-border/25 hover:border-border/50 rounded-lg p-5 transition-all duration-200 cursor-pointer"
          >
            <div className="space-y-2 min-w-0 pr-4">
              <span className="text-xs font-black font-mono tracking-widest text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md leading-none">
                {category.code}
              </span>
              <h3 className="text-sm font-bold text-foreground leading-snug truncate" title={category.name}>
                {category.name}
              </h3>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-foreground shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
