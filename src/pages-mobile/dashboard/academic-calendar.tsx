import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAcademicCalendarOptions,
  getAcademicCalendarView,
  CalendarMonthOption,
  MonthlySchedule,
} from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import { DrawerSelect } from "@/components/ui/drawer-select";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import { Info } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import calendarImg from "@/assets/calender.png";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyEvent(eventText: string): "holiday" | "exam" | "instructional" | "default" {
  const txt = eventText.toLowerCase();
  if (txt.includes("holiday") || txt.includes("sunday") || txt.includes("no class")) {
    return "holiday";
  }
  if (txt.includes("exam") || txt.includes("cat") || txt.includes("fat") || txt.includes("test")) {
    return "exam";
  }
  if (
    txt.includes("instructional") ||
    txt.includes("working") ||
    txt.includes("day 1") ||
    txt.includes("day 2") ||
    txt.includes("day 3") ||
    txt.includes("day 4") ||
    txt.includes("day 5")
  ) {
    return "instructional";
  }
  return "default";
}

function getEventDotClass(eventText: string): string {
  const type = classifyEvent(eventText);
  if (type === "holiday") return "bg-destructive";
  if (type === "exam") return "bg-amber-500";
  if (type === "instructional") return "bg-primary";
  return "bg-muted-foreground/40";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/60 ${className}`} />;
}

function AcademicCalendarSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4 animate-pulse font-saira">
      <div className="space-y-1">
        <Sk className="h-7 w-48" />
      </div>
      <div className="flex justify-between items-center gap-4">
        <Sk className="h-10 w-48 rounded-md" />
        <Sk className="h-10 w-10 rounded-md" />
      </div>
      <div className="space-y-3">
        <Sk className="h-5 w-40" />
        <div className="grid grid-cols-7 gap-1 border-t border-b border-border/10 py-3">
          {[...Array(7)].map((_, i) => (
            <Sk key={i} className="h-6 w-full rounded-md" />
          ))}
          {[...Array(35)].map((_, i) => (
            <Sk key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Cell Type ────────────────────────────────────────────────────────────────

type CalendarCell = {
  dayNumber?: number;
  isCurrentMonth: boolean;
  content: string[];
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AcademicCalendarPage() {
  const { loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    data: optionsData,
    loading: optionsLoading,
    error: optionsError,
    retry: fetchOptions,
  } = useOfflineData<CalendarMonthOption[]>({
    cacheKey: "deskly::cache::calendar_options",
    fetcher: getAcademicCalendarOptions,
  });

  const options = optionsData || null;

  const initialOptions = useMemo(() => {
    try {
      const cachedOptions = localStorage.getItem("deskly::cache::calendar_options");
      if (cachedOptions) {
        const parsed = JSON.parse(cachedOptions);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return null;
  }, []);

  const [selectedOption, setSelectedOption] = useState<CalendarMonthOption | null>(initialOptions?.[0] ?? null);
  const [selectedCell, setSelectedCell] = useState<CalendarCell | null>(null);

  // Sync selectedOption with options if it is null
  useEffect(() => {
    if (!selectedOption && options && options.length > 0) {
      setSelectedOption(options[0]);
    }
  }, [options, selectedOption]);

  const {
    data: viewData,
    loading: viewLoading,
    error: viewError,
  } = useOfflineData<MonthlySchedule>({
    cacheKey: selectedOption ? `deskly::cache::calendar_view_${selectedOption.dateValue}` : "",
    fetcher: () => getAcademicCalendarView(selectedOption!.dateValue),
    enabled: !!selectedOption,
  });

  const schedule = viewData || null;
  const loading = optionsLoading || viewLoading;
  const error = optionsError || viewError;

  // Calendar Math
  const calendarCells = useMemo(() => {
    if (!schedule || !selectedOption) return [];

    const dateVal = selectedOption.dateValue;
    let monthIndex = 0;
    let year = 2026;

    const parts = dateVal.split("-");
    if (parts.length === 2) {
      monthIndex = parseInt(parts[0], 10) - 1;
      year = parseInt(parts[1], 10);
    } else if (parts.length === 3) {
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const mIdx = months.indexOf(parts[1].toUpperCase());
      if (mIdx !== -1) monthIndex = mIdx;
      year = parseInt(parts[2], 10);
    }

    const firstDay = new Date(year, monthIndex, 1);
    const startWeekday = firstDay.getDay();
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();

    const cells: CalendarCell[] = [];

    // Prefix padding days
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ isCurrentMonth: false, content: [] });
    }

    // Current Month days
    for (let d = 1; d <= totalDays; d++) {
      const dayData = schedule.days.find((day) => day.date === d);
      cells.push({
        dayNumber: d,
        isCurrentMonth: true,
        content: dayData ? dayData.content : [],
      });
    }

    // Postfix padding days
    while (cells.length % 7 !== 0) {
      cells.push({ isCurrentMonth: false, content: [] });
    }

    return cells;
  }, [schedule, selectedOption]);

  const shell = (children: React.ReactNode) => <>{children}</>;
  const showOffline = (!options || !schedule) && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) {
    return shell(<OfflineDisplay onRetry={fetchOptions} />);
  }

  if (error && (!options || !schedule)) {
    return shell(
      <div className="flex h-full items-center justify-center font-saira">
        <ErrorDisplay title="Calendar Unavailable" message={error} onRetry={fetchOptions} />
      </div>
    );
  }

  const isLoading = authLoading || loading;

  if (isLoading) return shell(<AcademicCalendarSkeleton />);

  return shell(
    <div className="w-full flex flex-col gap-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Header */}
      <header className="relative z-10 flex items-start justify-between gap-4 mt-2">
        <div className="space-y-1.5 min-w-0 pt-1">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight leading-tight">
            Calendar
          </h1>
          <p className="text-xs text-muted-foreground/60 leading-normal">
            View monthly academic schedule and events
          </p>
        </div>
      </header>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[180px] h-[140px] pointer-events-none select-none z-0">
        <img
          src={calendarImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          alt="Calendar Illustration"
        />
      </div>

      {/* Month Selector Card */}
      <div className="relative z-10 bg-card/80 border border-border/40 p-5 rounded-xl shadow-sm backdrop-blur-md flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest block">
            Selected Month
          </span>
          <span className="text-base font-extrabold text-foreground leading-none uppercase">
            {schedule?.month || "Loading..."}
          </span>
        </div>
        {!isLoading && options && selectedOption && (
          <DrawerSelect
            value={selectedOption.dateValue}
            onValueChange={(val) => {
              const opt = options.find((o) => o.dateValue === val);
              if (opt) setSelectedOption(opt);
            }}
            title="Select Month"
            triggerClassName="h-9 w-[130px]"
            options={options.map((o) => ({ value: o.dateValue, label: o.label }))}
          />
        )}
      </div>

      {/* Calendar Grid Card */}
      <div className="relative z-10 bg-card/80 border border-border/40 p-5 rounded-xl shadow-sm backdrop-blur-md">
        <div className="grid grid-cols-7 gap-1">
          {/* Weekday Names */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2 text-center select-none">
              <span className="text-[10px] font-black tracking-widest text-muted-foreground/50 uppercase">
                {day}
              </span>
            </div>
          ))}

          {/* Day Cells */}
          {calendarCells.map((cell, idx) => {
            const hasEvents = cell.content && cell.content.length > 0;
            const isSelected = selectedCell && selectedCell.dayNumber === cell.dayNumber && cell.isCurrentMonth;
            const isToday =
              cell.isCurrentMonth &&
              cell.dayNumber === new Date().getDate() &&
              selectedOption?.label.toLowerCase().includes(
                new Date().toLocaleString("default", { month: "long" }).toLowerCase()
              ) &&
              selectedOption?.label.includes(new Date().getFullYear().toString());

            if (!cell.isCurrentMonth) {
              return (
                <div
                  key={idx}
                  className="min-h-[54px] bg-muted/5 opacity-5 rounded-lg pointer-events-none"
                />
              );
            }

            return (
              <div
                key={idx}
                onClick={() => setSelectedCell(cell)}
                className={`min-h-[54px] p-2 flex flex-col justify-between rounded-lg relative overflow-hidden group border transition-all duration-150 cursor-pointer
                  ${isToday 
                    ? "bg-primary/10 border-primary/30 text-primary font-bold animate-pulse-subtle" 
                    : isSelected
                      ? "bg-muted/30 border-primary/20 text-primary"
                      : "bg-muted/10 border-border/10 text-foreground hover:bg-muted/15"
                  }`}
              >
                <span className={`text-[11px] font-bold leading-none w-4 h-4 rounded-full flex items-center justify-center
                  ${isToday ? "bg-primary text-primary-foreground font-black" : ""}`}
                >
                  {cell.dayNumber}
                </span>

                {/* Event indicator dots */}
                {hasEvents && (
                  <div className="flex items-center gap-1 justify-center mt-auto">
                    {cell.content.slice(0, 3).map((event, eventIdx) => (
                      <span
                        key={eventIdx}
                        className={`w-1 h-1 rounded-full ${getEventDotClass(event)}`}
                      />
                    ))}
                    {cell.content.length > 3 && (
                      <span className="text-[7px] font-bold text-muted-foreground/60 leading-none">
                        +
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-up Bottom Drawer for Day Details */}
      <Drawer
        open={selectedCell !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCell(null);
        }}
      >
        <DrawerContent className="pb-8 font-saira max-h-[85vh]">
          <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-5">
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/10 pb-3">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 leading-none">
                  Day Schedule Details
                </span>
                <h3 className="text-xl font-bold text-foreground leading-none">
                  {selectedCell && schedule
                    ? `${schedule.month.split(" ")[0]} ${selectedCell.dayNumber}, ${schedule.month.split(" ")[1]}`
                    : ""}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="w-8 h-8 rounded-full bg-muted/65 flex items-center justify-center text-foreground hover:bg-muted active:opacity-75 transition-colors border-none cursor-pointer shrink-0 font-sans"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            {/* Event Content list */}
            {selectedCell && (
              selectedCell.content.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground bg-muted/5 rounded-lg border border-border/10">
                  <Info className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-xs font-semibold">No events scheduled for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCell.content.map((event, idx) => {
                    const type = classifyEvent(event);
                    let badgeStyle = "bg-muted text-muted-foreground";
                    if (type === "holiday") badgeStyle = "bg-destructive/10 text-destructive border-destructive/20";
                    if (type === "exam") badgeStyle = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                    if (type === "instructional") badgeStyle = "bg-primary/10 text-primary border-primary/20";

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-border/10 bg-muted/5 space-y-2"
                      >
                        <span
                          className={`inline-block px-2 py-0.5 border rounded text-xs font-extrabold uppercase tracking-wider leading-none ${badgeStyle}`}
                        >
                          {type}
                        </span>
                        <p className="text-sm text-foreground font-semibold leading-relaxed">
                          {event}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
