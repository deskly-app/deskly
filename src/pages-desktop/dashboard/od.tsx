import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getStudentOdDetails, StudentOdDetails } from "@/lib/od";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import {
  Award,
  Calendar,
  Clock,
  Search,
  Info,
  CheckCircle2,
  Tag,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";

function OdSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="space-y-2 pb-4 border-b border-border/10">
        <div className="h-6 w-36 bg-muted/50 rounded" />
        <div className="h-3 w-64 bg-muted/40 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-border/10">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-16 bg-muted/40 rounded" />
            <div className="h-7 w-20 bg-muted/50 rounded" />
            <div className="h-2.5 w-28 bg-muted/30 rounded" />
          </div>
        ))}
      </div>

      <div className="h-9 w-full max-w-sm bg-muted/40 rounded-md" />

      <div className="space-y-3 pt-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="p-4 border border-border/10 rounded-lg space-y-3 bg-muted/10"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-48 bg-muted/50 rounded" />
              <div className="h-4 w-16 bg-muted/40 rounded" />
            </div>
            <div className="flex gap-4">
              <div className="h-3 w-32 bg-muted/40 rounded" />
              <div className="h-3 w-32 bg-muted/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OdPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReason, setSelectedReason] = useState("all");

  const {
    data: odDetails,
    loading,
    error,
    retry: load,
  } = useOfflineData<StudentOdDetails | null>({
    cacheKey: "deskly::cache::od",
    fetcher: async () => {
      const res = await getStudentOdDetails();
      if (!res.success) {
        return { success: false, error: res.error || "Failed to load OD details" };
      }
      return { success: true, data: res.data || null };
    },
    enabled: isLoggedIn && !authLoading,
  });

  const records = useMemo(() => odDetails?.records || [], [odDetails]);
  const totalCount = odDetails?.totalCount ?? records.length;

  const categories = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.reason) set.add(r.reason.trim());
    });
    return Array.from(set);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.remarks.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.date.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesReason =
        selectedReason === "all" || item.reason.trim() === selectedReason;

      return matchesSearch && matchesReason;
    });
  }, [records, searchQuery, selectedReason]);

  if (authLoading || (loading && !odDetails)) {
    return <OdSkeleton />;
  }

  if (error && !odDetails) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-4 select-none relative">
      {/* Error banner */}
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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-primary shrink-0" />
          <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">
            On Duty (OD) Details
          </h1>
        </div>
        <p className="text-xs text-muted-foreground/60 mt-1.5">
          Student approved academic, cultural, and technical attendance compensation
        </p>
      </header>

      {/* ── Key Metrics Summary ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-6 border-b border-border/10">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Total OD Count
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-none">
              {totalCount}
            </span>
            <span className="text-xs font-medium text-muted-foreground/50">sessions / hrs</span>
          </div>
          <p className="text-[11px] text-muted-foreground/40">Approved compensation count</p>
        </div>

        <div className="space-y-1 sm:border-l sm:border-border/10 sm:pl-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Recorded Events
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-none">
              {records.length}
            </span>
            <span className="text-xs font-medium text-muted-foreground/50">participations</span>
          </div>
          <p className="text-[11px] text-muted-foreground/40">Events across active semester</p>
        </div>

        <div className="space-y-1 sm:border-l sm:border-border/10 sm:pl-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Categories
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-none">
              {categories.length}
            </span>
            <span className="text-xs font-medium text-muted-foreground/50">reasons</span>
          </div>
          <p className="text-[11px] text-muted-foreground/40">Cultural, technical & official</p>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border/20 bg-muted/20 text-xs text-muted-foreground/70">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <span>
          OD Count (excluding Sectional Holidays and Placement Activities) is calculated
          irrespective of faculty attendance posting in VTOP.
        </span>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground/40" />
          <Input
            type="text"
            placeholder="Search event remarks or dates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9 bg-muted/20 border-border/20 focus:border-border/40"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedReason("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedReason === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted/30 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              All ({records.length})
            </button>
            {categories.map((cat) => {
              const count = records.filter((r) => r.reason.trim() === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedReason(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    selectedReason === cat
                      ? "bg-foreground text-background"
                      : "bg-muted/30 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Records List / Table ────────────────────────────────────────────── */}
      {filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/20 rounded-xl">
          <Award className="w-10 h-10 text-muted-foreground/25 mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No On Duty Records</h3>
          <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
            {records.length === 0
              ? "No On Duty (OD) records have been registered for this semester."
              : "No records match your search filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {filteredRecords.map((item, idx) => (
            <div
              key={`${item.slNo}-${idx}`}
              className="p-4 sm:p-5 border border-border/10 rounded-lg hover:border-border/30 transition-colors bg-card/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                    {item.remarks || "On Duty Approval"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                    <CheckCircle2 className="w-3 h-3" />
                    {item.odType}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="w-3 h-3 text-muted-foreground/40" />
                    {item.reason}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3 h-3 text-muted-foreground/40" />
                    {item.basis}
                  </span>
                </div>
              </div>

              <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <span>{item.date}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground/50 text-[11px]">
                  <Clock className="w-3 h-3 text-muted-foreground/40" />
                  <span>{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
