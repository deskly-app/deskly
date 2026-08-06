import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAcademicCalendarOptions,
  getAcademicCalendarView,
  CalendarMonthOption,
  MonthlySchedule,
} from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, Info, RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="w-full space-y-6">
      {/* Selector skeleton */}
      <div className="flex justify-between items-center gap-4 border-b border-border/20 pb-4">
        <Sk className="h-10 w-48 rounded-md" />
        <Sk className="h-6 w-32 rounded-full" />
      </div>

      {/* Calendar grid skeleton */}
      <div className="w-full space-y-4">
        <Sk className="h-6 w-40 rounded-full" />
        <div className="grid grid-cols-7 border border-border/10 rounded-lg overflow-hidden bg-background">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="py-3 border-b border-r border-border/10 flex justify-center">
              <Sk className="h-3.5 w-12 rounded-full" />
            </div>
          ))}
          {[...Array(35)].map((_, i) => (
            <div
              key={i}
              className="min-h-[90px] sm:min-h-[120px] md:min-h-[145px] p-3 border-b border-r border-border/10 flex flex-col justify-between"
            >
              <Sk className="h-4 w-6 rounded-full" />
              <div className="space-y-1.5 mt-2 w-full">
                <Sk className="h-3 w-full rounded" />
                <Sk className="h-3 w-4/5 rounded" />
              </div>
            </div>
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
  const [options, setOptions] = useState<CalendarMonthOption[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<CalendarMonthOption | null>(null);
  const [schedule, setSchedule] = useState<MonthlySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected cell details in side panel
  const [selectedCell, setSelectedCell] = useState<CalendarCell | null>(null);

  // Load options from cache first
  useEffect(() => {
    const cachedOptions = localStorage.getItem("deskly::cache::calendar_options");
    if (cachedOptions) {
      try {
        const parsed = JSON.parse(cachedOptions);
        if (parsed && parsed.length > 0) {
          setOptions(parsed);
          setSelectedOption(parsed[0]);
        }
      } catch (e) {
        console.error("Failed to parse cached academic calendar options", e);
      }
    }
  }, []);

  // Load monthly view from cache first when selectedOption changes
  useEffect(() => {
    if (selectedOption) {
      const cachedView = localStorage.getItem(`deskly::cache::calendar_view_${selectedOption.dateValue}`);
      if (cachedView) {
        try {
          const parsed = JSON.parse(cachedView);
          if (parsed && parsed.days && parsed.days.length > 0) {
            setSchedule(parsed);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Failed to parse cached calendar view", e);
        }
      }
      setSchedule(null);
      setLoading(true);
    }
  }, [selectedOption]);

  const fetchOptions = async () => {
    setLoading(options && options.length > 0 ? false : true);
    setError(null);
    try {
      const res = await getAcademicCalendarOptions();
      if (res.success && res.data && res.data.length > 0) {
        setOptions(res.data);
        localStorage.setItem("deskly::cache::calendar_options", JSON.stringify(res.data));
        if (!selectedOption) {
          setSelectedOption(res.data[0]);
        }
      } else {
        setError(res.error ?? "No academic calendar semesters found.");
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  const fetchView = async (dateVal: string) => {
    setLoading(schedule ? false : true);
    setError(null);
    try {
      const res = await getAcademicCalendarView(dateVal);
      if (res.success && res.data) {
        setSchedule(res.data);
        localStorage.setItem(`deskly::cache::calendar_view_${dateVal}`, JSON.stringify(res.data));
        setSelectedCell(null); // Reset day details view on month change
      } else {
        setError(res.error ?? "Failed to load academic calendar view.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (selectedOption) {
      fetchView(selectedOption.dateValue);
    }
  }, [selectedOption]);

  // Calendar Math: construct 35-42 grid cells based on loaded schedule and options
  const calendarCells = useMemo(() => {
    if (!schedule || !selectedOption) return [];

    const dateVal = selectedOption.dateValue; // e.g. "06-2026" or "01-DEC-2025"
    let monthIndex = 0;
    let year = 2026;

    // Parse dateValue string: VTOP uses "01-DEC-2025" or custom formats sometimes
    const parts = dateVal.split("-");
    if (parts.length === 2) {
      // MM-YYYY
      monthIndex = parseInt(parts[0], 10) - 1;
      year = parseInt(parts[1], 10);
    } else if (parts.length === 3) {
      // DD-MMM-YYYY (e.g. 01-DEC-2025)
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const mIdx = months.indexOf(parts[1].toUpperCase());
      if (mIdx !== -1) monthIndex = mIdx;
      year = parseInt(parts[2], 10);
    }

    const firstDay = new Date(year, monthIndex, 1);
    const startWeekday = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();

    const cells: CalendarCell[] = [];

    // 1. Prefix padding days
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ isCurrentMonth: false, content: [] });
    }

    // 2. Current Month days
    for (let d = 1; d <= totalDays; d++) {
      const dayData = schedule.days.find((day) => day.date === d);
      cells.push({
        dayNumber: d,
        isCurrentMonth: true,
        content: dayData ? dayData.content : [],
      });
    }

    // 3. Postfix padding days
    while (cells.length % 7 !== 0) {
      cells.push({ isCurrentMonth: false, content: [] });
    }

    return cells;
  }, [schedule, selectedOption]);


  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (error && !options) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay title="Calendar Unavailable" message={error} onRetry={fetchOptions} />
      </div>
    );
  }

  const isLoading = authLoading || loading;

  return shell(
    <div className="w-full space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary shrink-0" />
            Academic Calendar
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Instructional working days, holidays, and semester exam schedule
          </p>
        </div>
        {!isLoading && options && selectedOption && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedOption.dateValue}
              onValueChange={(val) => {
                const opt = options.find((o) => o.dateValue === val);
                if (opt) setSelectedOption(opt);
              }}
            >
              <SelectTrigger className="w-48 h-9 border border-border/20 bg-muted/10 text-xs sm:text-sm font-semibold rounded-md focus:outline-none">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent className="border border-border/10 bg-popover text-popover-foreground">
                {options.map((o) => (
                  <SelectItem key={o.dateValue} value={o.dateValue} className="text-xs sm:text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={() => fetchView(selectedOption.dateValue)}
              title="Refresh calendar view"
              className="p-2 h-9 w-9 rounded-md border border-border/10 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <AcademicCalendarSkeleton />
      ) : (
        <div className="w-full flex flex-col gap-4 min-h-0">
          <h2 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
            {schedule?.month}
          </h2>

          <div className="grid grid-cols-7 border-t border-l border-border/10 rounded-lg overflow-hidden bg-background shadow-sm shadow-border/5">
            {/* Weekday Names */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-3 text-center border-b border-r border-border/10 bg-muted/5">
                <span className="text-xs sm:text-xs font-black tracking-widest text-muted-foreground/60 uppercase">
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

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (cell.isCurrentMonth) {
                      setSelectedCell(cell);
                    }
                  }}
                  className={`min-h-[65px] sm:min-h-[110px] md:min-h-[135px] lg:min-h-[145px] p-1.5 sm:p-2 flex flex-col justify-between border-b border-r border-border/10 cursor-pointer select-none transition-colors duration-150 relative group
                    ${cell.isCurrentMonth ? "bg-transparent hover:bg-muted/5" : "bg-muted/5 opacity-15 cursor-default pointer-events-none"}
                    ${isSelected ? "bg-primary/5 font-semibold" : ""}
                  `}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs sm:text-xs md:text-sm font-semibold rounded-full flex items-center justify-center transition-all
                        ${
                          isToday
                            ? "bg-primary text-primary-foreground font-extrabold w-4.5 h-4.5 sm:w-6 sm:h-6 shadow-sm shadow-primary/20"
                            : isSelected
                              ? "text-primary font-bold"
                              : cell.isCurrentMonth
                                ? "text-foreground/90"
                                : "text-muted-foreground/30"
                        }
                      `}
                    >
                      {cell.dayNumber}
                    </span>
                  </div>

                  {/* Event indicators - Desktop: full text, Mobile: small indicators */}
                  {cell.isCurrentMonth && hasEvents && (
                    <>
                      {/* Desktop: Event badges */}
                      <div className="hidden sm:flex flex-col gap-1 mt-2 w-full overflow-hidden">
                        {cell.content.slice(0, 3).map((event, eventIdx) => {
                          const type = classifyEvent(event);
                          let badgeStyle = "bg-muted text-muted-foreground border-transparent";
                          if (type === "holiday") badgeStyle = "bg-destructive/10 text-destructive border-destructive/20";
                          if (type === "exam") badgeStyle = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                          if (type === "instructional") badgeStyle = "bg-primary/10 text-primary border-primary/20";

                          return (
                            <div
                              key={eventIdx}
                              className={`px-1.5 py-0.5 border rounded text-xs font-semibold leading-tight truncate ${badgeStyle}`}
                              title={event}
                            >
                              {event}
                            </div>
                          );
                        })}
                        {cell.content.length > 3 && (
                          <span className="text-xs font-bold text-muted-foreground/60 pl-1">
                            +{cell.content.length - 3} more
                          </span>
                        )}
                      </div>

                      {/* Mobile: Tiny dots */}
                      <div className="flex sm:hidden items-center gap-1 mt-auto">
                        {cell.content.slice(0, 3).map((event, eventIdx) => (
                          <span
                            key={eventIdx}
                            className={`w-1.5 h-1.5 rounded-full ${getEventDotClass(event)}`}
                            title={event}
                          />
                        ))}
                        {cell.content.length > 3 && (
                          <span className="text-[7px] font-bold text-muted-foreground/60 leading-none">
                            +{cell.content.length - 3}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Modal for Day Details */}
          <AnimatePresence>
            {selectedCell && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedCell(null)}
                  className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                />
                
                {/* Modal Content */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="relative w-full max-w-md bg-card border border-border/10 rounded-lg shadow-xl p-6 overflow-hidden z-10"
                >
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <div className="space-y-4">
                    <div className="space-y-1 pr-6 border-b border-border/10 pb-3">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                        Day Schedule Details
                      </p>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        {schedule?.month.split(" ")[0]} {selectedCell.dayNumber},{" "}
                        {schedule?.month.split(" ")[1]}
                      </h3>
                    </div>

                    {selectedCell.content.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-2 text-muted-foreground">
                        <Info className="w-8 h-8 text-muted-foreground/20" />
                        <p className="text-xs font-medium">No events scheduled for this day</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                        {selectedCell.content.map((event, idx) => {
                          const type = classifyEvent(event);
                          let badgeStyle = "bg-muted text-muted-foreground";
                          if (type === "holiday") badgeStyle = "bg-destructive/10 text-destructive border-destructive/20";
                          if (type === "exam") badgeStyle = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                          if (type === "instructional") badgeStyle = "bg-primary/10 text-primary border-primary/20";

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-md border border-border/10 bg-muted/5 space-y-1.5"
                            >
                              <span
                                className={`inline-block px-2 py-0.5 border rounded text-xs font-extrabold uppercase tracking-wider leading-none ${badgeStyle}`}
                              >
                                {type}
                              </span>
                              <p className="text-xs sm:text-sm text-foreground font-semibold leading-relaxed">
                                {event}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
