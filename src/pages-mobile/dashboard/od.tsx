import { useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getStudentOdDetails, StudentOdDetails } from "@/lib/od";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted/60 ${className}`} />;
}

function OdSkeleton() {
  return (
    <div className="w-full space-y-6 pt-1 pb-14 font-saira">
      {/* Header skeleton */}
      <div className="space-y-1.5">
        <Sk className="h-7 w-32" />
        <Sk className="h-3.5 w-52" />
      </div>

      {/* Hero stats card skeleton */}
      <div className="p-7 sm:p-8 bg-card/60 border border-border/15 rounded-[32px] space-y-4">
        <div className="space-y-1.5">
          <Sk className="h-3.5 w-28" />
          <Sk className="h-3 w-40" />
        </div>
        <Sk className="h-14 w-36" />
        <div className="pt-3 border-t border-border/10">
          <Sk className="h-3 w-28" />
        </div>
      </div>

      {/* Section header skeleton */}
      <div className="flex justify-between items-center px-1 pt-1">
        <Sk className="h-3.5 w-28" />
        <Sk className="h-3 w-12" />
      </div>

      {/* Event list skeleton */}
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="p-6 bg-card/60 border border-border/15 rounded-[26px] space-y-4"
          >
            <Sk className="h-5 w-3/4" />
            <div className="pt-3.5 border-t border-border/10 flex justify-between items-center">
              <Sk className="h-4 w-32" />
              <Sk className="h-4 w-28" />
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

export default function MobileOdPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
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
      <div className="flex h-full items-center justify-center font-saira px-4">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pt-1 pb-14 font-saira select-none overscroll-y-contain relative">
      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl">
          <p className="text-xs font-medium truncate">Sync failed — {error}</p>
          <button
            onClick={load}
            className="text-xs font-semibold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground leading-none">
          On Duty
        </h1>
        <p className="text-xs text-muted-foreground/60">
          Approved attendance compensation records
        </p>
      </header>

      {/* Hero Stats Card - Big & Clean without badges */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-card/90 via-card/75 to-card/45 border border-border/15 p-7 sm:p-8 rounded-[32px] shadow-sm space-y-4"
      >
        <div className="space-y-1">
          <span className="text-xs font-bold tracking-wider text-muted-foreground/50 uppercase leading-none block">
            Total OD Hours
          </span>
          <p className="text-xs text-muted-foreground/40 font-medium">
            Approved attendance compensation
          </p>
        </div>

        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-6xl font-black text-foreground tracking-tight tabular-nums leading-none">
            {totalCount}
          </span>
          <span className="text-base font-semibold text-muted-foreground/50 leading-none">
            {totalCount === 1 ? "hour approved" : "hours approved"}
          </span>
        </div>

        <div className="pt-3 border-t border-border/10 text-xs text-muted-foreground/50 font-medium">
          {records.length} {records.length === 1 ? "event recorded" : "events recorded"}
        </div>
      </motion.div>

      {/* Section Header */}
      <div className="flex items-center justify-between pt-1 px-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
          Events & Activities
        </h2>
        <span className="text-xs font-semibold text-muted-foreground/45 tabular-nums">
          {records.length} {records.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Events List - Bigger spacious cards */}
      <div className="flex flex-col gap-4">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/20 rounded-[28px] bg-muted/5">
            <h3 className="text-sm font-semibold text-foreground">No Records Found</h3>
            <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
              No On Duty entries recorded for this semester.
            </p>
          </div>
        ) : (
          records.map((item, idx) => {
            const eventName = item.remarks?.trim() || item.reason?.trim() || "On Duty Event";
            const dateInfo = parseOdDate(item.date);
            const timeInfo = parseOdTime(item.time);

            return (
              <motion.div
                key={`${item.slNo}-${idx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                className="p-6 bg-card/75 dark:bg-card/45 border border-border/15 rounded-[26px] shadow-sm space-y-4 hover:border-border/30 transition-colors"
              >
                {/* Event Name */}
                <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug break-words tracking-tight">
                  {eventName}
                </h3>

                {/* Date, Time & Duration */}
                <div className="pt-3.5 border-t border-border/10 flex flex-wrap items-center justify-between gap-y-2.5 gap-x-6 text-sm">
                  {/* Date */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                    <span className="font-medium">{dateInfo.displayDate}</span>
                  </div>

                  {/* Time & Duration / Full Day */}
                  {timeInfo.isFullDay ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Clock className="w-4 h-4 text-primary shrink-0" />
                      <span>Full Day</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                      <span className="font-medium">{timeInfo.timeDisplay}</span>
                      {timeInfo.duration && (
                        <>
                          <span className="text-muted-foreground/30">•</span>
                          <span className="font-semibold text-foreground">{timeInfo.duration}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
