import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@/router";
import { getCurriculumCategories, CurriculumCategory } from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import { ScrollText, ChevronRight } from "lucide-react";
import curriculumImg from "@/assets/curriculum.png";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

function CategoriesSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4 font-saira">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>
      <div className="flex items-center gap-2">
        <Sk className="w-6 h-6 rounded-md shrink-0" />
        <Sk className="h-7 w-44" />
      </div>
      <div className="divide-y divide-border/10 border-t border-b border-border/10">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-4">
            <div className="space-y-1.5">
              <Sk className="h-3 w-14" />
              <Sk className="h-4 w-48" />
            </div>
            <Sk className="w-4 h-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CurriculumIndexPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const {
    data,
    loading,
    error,
    retry: load,
  } = useOfflineData<CurriculumCategory[]>({
    cacheKey: "deskly::cache::curriculum::categories",
    fetcher: getCurriculumCategories,
    enabled: isLoggedIn && !authLoading,
  });

  const categories = data || [];

  const isOnline = useOnlineStatus();
  const shell = (children: React.ReactNode) => <>{children}</>;
  const showOffline = categories.length === 0 && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline && !loading) return shell(<OfflineDisplay onRetry={load} />);
  if (authLoading || (loading && categories.length === 0)) return shell(<CategoriesSkeleton />);
  if (error && categories.length === 0) return shell(<div className="flex h-full items-center justify-center"><ErrorDisplay message={error} onRetry={load} /></div>);

  return shell(
    <div className="w-full space-y-6 px-2 py-4 font-saira relative">
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
      <header className="relative z-10 flex items-center gap-2">
        <ScrollText className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-none">Curriculum</h1>
      </header>

      {/* ── Category List ──────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col gap-3">
        {categories.map((category) => (
          <button
            key={category.code}
            onClick={() => navigate(`/dashboard/curriculum/${category.code}` as any)}
            className="w-full flex items-center justify-between gap-4 p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md text-left cursor-pointer hover:bg-muted/5 active:opacity-70 transition-all"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
                {category.code}
              </p>
              <p className="text-sm font-bold text-foreground leading-snug truncate">{category.name}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/35 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
