import { useState, useMemo } from "react";
import {
  Award,
  Clock,
  Search,
  FileText,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getStudentOdDetails, StudentOdDetails } from "@/lib/od";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/50 ${className}`} />;
}

function OdSkeleton() {
  return (
    <div className="w-full space-y-6 py-2">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 pb-3 border-b border-border/10">
        <Sk className="w-6 h-6 rounded" />
        <Sk className="h-6 w-32" />
      </div>

      {/* Stats row skeleton with vertical separator */}
      <div className="grid grid-cols-2 py-4 sm:py-6 border-y border-border/15">
        <div className="space-y-1.5 pr-4 sm:pr-8">
          <Sk className="h-7 sm:h-8 w-16 sm:w-20" />
          <Sk className="h-3 w-24 sm:w-28" />
        </div>
        <div className="space-y-1.5 pl-4 sm:pl-8 border-l border-border/20">
          <Sk className="h-7 sm:h-8 w-16 sm:w-20" />
          <Sk className="h-3 w-24 sm:w-28" />
        </div>
      </div>

      {/* Toolbar skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1">
        <Sk className="h-9 w-full sm:w-72 rounded-md" />
        <Sk className="h-4 w-24 self-end sm:self-auto" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="p-4 sm:p-5 border border-border/15 rounded-xl space-y-4 bg-card/20 min-h-[130px] flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <Sk className="h-3 w-8" />
                <Sk className="h-3 w-20" />
              </div>
              <Sk className="h-4 sm:h-5 w-3/4" />
            </div>
            <div className="pt-3 border-t border-border/10 flex justify-between items-center">
              <Sk className="h-3.5 w-24" />
              <Sk className="h-3.5 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseOdDate(rawDate?: string) {
  if (!rawDate) return { displayDate: "Date TBA" };
  const parts = rawDate.split(/\s*(?:to|-)\s*/i);
  const startStr = parts[0]?.trim();
  const endStr = parts[1]?.trim();

  const match = startStr.match(/^(\d{1,2})[-/ ]([A-Za-z]+|\d{1,2})[-/ ](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].length > 3 ? match[2].slice(0, 3) : match[2];
    const year = match[3];

    let displayDate = `${day} ${month} ${year}`;
    if (endStr && endStr.toLowerCase() !== startStr.toLowerCase()) {
      const endMatch = endStr.match(/^(\d{1,2})[-/ ]([A-Za-z]+|\d{1,2})[-/ ](\d{2,4})$/);
      if (endMatch) {
        const endDay = endMatch[1].padStart(2, "0");
        const endMonth = endMatch[2].length > 3 ? endMatch[2].slice(0, 3) : endMatch[2];
        const endYear = endMatch[3];
        displayDate = `${day} ${month} - ${endDay} ${endMonth} ${endYear}`;
      } else {
        displayDate = `${startStr} → ${endStr}`;
      }
    }
    return { displayDate };
  }

  return { displayDate: rawDate };
}

function parseOdTime(rawTime?: string) {
  if (!rawTime || rawTime.trim() === "-" || rawTime.trim() === "") {
    return { timeDisplay: "Time TBA", duration: null, isFullDay: false };
  }

  const cleaned = rawTime
    .replace(/\s*Hrs\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Test if time represents 00:00 (full day)
  const zeroPattern = /^0?0:00(:00)?(\s*(to|-)\s*0?0:00(:00)?)?$/i;
  if (zeroPattern.test(cleaned)) {
    return {
      timeDisplay: "Full Day",
      duration: "Full Day",
      isFullDay: true,
    };
  }

  // Split on "to" or "-"
  const parts = cleaned.split(/\s*(?:to|-)\s*/i);
  if (parts.length === 2) {
    const start = parts[0].trim();
    const end = parts[1].trim();

    const startMatch = start.match(/^(\d{1,2}):(\d{2})/);
    const endMatch = end.match(/^(\d{1,2}):(\d{2})/);

    if (startMatch && endMatch) {
      const startH = parseInt(startMatch[1], 10);
      const startM = parseInt(startMatch[2], 10);
      const endH = parseInt(endMatch[1], 10);
      const endM = parseInt(endMatch[2], 10);

      let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffMins < 0) diffMins += 24 * 60;

      if (diffMins === 0 && startH === 0 && startM === 0) {
        return {
          timeDisplay: "Full Day",
          duration: "Full Day",
          isFullDay: true,
        };
      }

      const durHours = Math.floor(diffMins / 60);
      const durMins = diffMins % 60;

      let duration = "";
      if (durHours > 0 && durMins > 0) {
        duration = `${durHours}h ${durMins}m`;
      } else if (durHours > 0) {
        duration = `${durHours}h`;
      } else if (durMins > 0) {
        duration = `${durMins}m`;
      }

      return {
        timeDisplay: `${start} - ${end}`,
        duration: duration || null,
        isFullDay: false,
      };
    }

    return {
      timeDisplay: `${start} - ${end}`,
      duration: null,
      isFullDay: false,
    };
  }

  return {
    timeDisplay: cleaned,
    duration: null,
    isFullDay: false,
  };
}

export default function DesktopOdPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((item) => {
      const name = item.remarks || item.reason || "";
      return (
        name.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q) ||
        item.time.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery]);

  const showOffline =
    !odDetails && !loading && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) {
    return <OfflineDisplay onRetry={load} />;
  }

  if (authLoading || (loading && !odDetails)) {
    return <OdSkeleton />;
  }

  if (error && !odDetails) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-4 select-none relative">
      {/* Sync Error Banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
          <p className="font-medium truncate">Sync failed — {error}</p>
          <button
            onClick={load}
            className="font-bold uppercase tracking-wider shrink-0 bg-transparent text-destructive hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 pb-3 border-b border-border/10">
        <Award className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">
          On Duty
        </h1>
      </header>

      {/* ── Key Stats Strip (Desktop horizontal strip with vertical separator) ─ */}
      <div className="grid grid-cols-2 py-4 sm:py-6 border-y border-border/15">
        {/* Total OD Hours */}
        <div className="flex flex-col gap-1 pr-4 sm:pr-8 min-w-0">
          <span className="text-2xl sm:text-3xl font-black text-foreground leading-none tabular-nums">
            {totalCount}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-muted-foreground/60 uppercase tracking-wider">
            Total OD Hours
          </span>
        </div>

        {/* Total Events */}
        <div className="flex flex-col gap-1 pl-4 sm:pl-8 border-l border-border/20 min-w-0">
          <span className="text-2xl sm:text-3xl font-black text-foreground leading-none tabular-nums">
            {records.length}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-muted-foreground/60 uppercase tracking-wider">
            Total Events
          </span>
        </div>
      </div>

      {/* ── Section Header & Search Bar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
            Events & Activities
          </h2>
          <p className="text-xs text-muted-foreground/60 font-semibold truncate">
            {filteredRecords.length} {filteredRecords.length === 1 ? "event recorded" : "events recorded"}
          </p>
        </div>

        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search events or dates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9 bg-muted/20 border-border/20 focus:border-border/40 rounded-md w-full"
          />
        </div>
      </div>

      {/* ── Registered Events Cards Grid (Desktop Responsive Grid) ──────────── */}
      {filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center border border-dashed border-border/20 rounded-xl bg-card/10">
          <FileText className="w-8 h-8 text-muted-foreground/20" />
          <div>
            <p className="text-sm font-bold text-foreground">No events found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {records.length === 0
                ? "No approved On Duty compensation entries for this semester."
                : "Try modifying your search filter."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredRecords.map((item, idx) => {
            const eventName = item.remarks?.trim() || item.reason?.trim() || "On Duty Event";
            const dateInfo = parseOdDate(item.date);
            const timeInfo = parseOdTime(item.time);

            return (
              <div
                key={`${item.slNo}-${idx}`}
                className="p-4 sm:p-5 bg-card/30 hover:bg-card/60 border border-border/20 hover:border-foreground/30 rounded-xl transition-all duration-150 flex flex-col justify-between gap-3 sm:gap-4 min-w-0"
              >
                <div className="space-y-2.5 min-w-0">
                  {/* Top: Serial # & Date */}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground/60 min-w-0">
                    <span className="font-bold text-muted-foreground/35 tabular-nums shrink-0">
                      #{(idx + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="font-bold text-primary uppercase tracking-wider text-[11px] truncate" title={dateInfo.displayDate}>
                      {dateInfo.displayDate}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug break-words min-w-0">
                    {eventName}
                  </h3>
                </div>

                {/* Bottom: Time & Duration / Full Day */}
                <div className="pt-3 border-t border-border/10 flex flex-wrap items-center justify-between gap-y-1 gap-x-2 text-xs min-w-0">
                  <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="truncate" title={timeInfo.timeDisplay}>{timeInfo.timeDisplay}</span>
                  </div>

                  {timeInfo.isFullDay ? (
                    <span className="font-bold text-primary shrink-0">Full Day</span>
                  ) : timeInfo.duration ? (
                    <span className="font-semibold text-foreground shrink-0">{timeInfo.duration}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
