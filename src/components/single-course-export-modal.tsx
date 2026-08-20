import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ScheduleEntry,
  getGoogleCalendarLink,
} from "@/lib/calendar-export-utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  CalendarPlus,
  ExternalLink,
  X,
  MapPin,
  User,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";

interface SingleCourseExportModalProps {
  entry: ScheduleEntry;
  dayDate: Date;
  fullWidth?: boolean;
}

export default function SingleCourseExportModal({
  entry,
  dayDate,
  fullWidth = false,
}: SingleCourseExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 4);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const parsedEndDate = useMemo(() => {
    return new Date(endDate);
  }, [endDate]);

  const gCalLink = useMemo(() => {
    return getGoogleCalendarLink(entry, dayDate, parsedEndDate);
  }, [entry, dayDate, parsedEndDate]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`${
          fullWidth
            ? "w-full justify-center px-4 py-2.5 rounded-lg border border-border/20 bg-muted/10 hover:bg-muted/15 text-xs text-muted-foreground hover:text-foreground font-bold transition-all cursor-pointer flex items-center gap-2"
            : "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
        }`}
        title="Export course slot to Google Calendar"
      >
        <CalendarPlus className="w-4 h-4" />
        {fullWidth && <span>Add to Calendar</span>}
      </button>

      {/* Modal Dialog */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-background/60 backdrop-blur-sm cursor-pointer"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="relative w-full max-w-[90vw] md:max-w-2xl max-h-[95vh] overflow-y-auto no-scrollbar rounded-lg bg-card border border-border/20 shadow-2xl p-5 sm:p-6 flex flex-col gap-6"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/10 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarPlus className="w-5 h-5 text-primary" />
                    <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">Export Course Event</h3>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Grid split layout: stacks on mobile, split columns on desktop */}
                <div className="flex flex-col md:flex-row gap-6 items-stretch">
                  
                  {/* Left Column: Course details and add action */}
                  <div className="flex-1 flex flex-col justify-between gap-6 min-w-0">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 font-bold tracking-wider uppercase">
                          <span>{entry.courseCode}</span>
                          <span>·</span>
                          <span>Slot {entry.slot}</span>
                        </div>
                        <h4 className="text-lg font-bold text-foreground leading-snug tracking-tight">{entry.courseTitle}</h4>
                      </div>

                      <div className="space-y-2.5 text-sm text-muted-foreground/80 font-medium pt-1">
                        <div className="flex items-center gap-2.5">
                          <Clock className="w-4.5 h-4.5 text-muted-foreground/45 shrink-0" />
                          <span>{entry.startTime} – {entry.endTime}</span>
                        </div>
                        {entry.venue && (
                          <div className="flex items-center gap-2.5">
                            <MapPin className="w-4.5 h-4.5 text-muted-foreground/45 shrink-0" />
                            <span>{entry.venue}</span>
                          </div>
                        )}
                        {entry.faculty && (
                          <div className="flex items-center gap-2.5">
                            <User className="w-4.5 h-4.5 text-muted-foreground/45 shrink-0" />
                            <span className="truncate">{entry.faculty}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border/10 md:border-t-0 md:pt-0">
                      <p className="text-xs text-muted-foreground/55 leading-relaxed">
                        Add this class as a weekly recurring event directly to your Google Calendar.
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            await openUrl(gCalLink);
                          } catch (err) {
                            console.error("Failed to open calendar link:", err);
                          }
                        }}
                        className="w-full rounded-md h-11 text-sm font-semibold gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm border-none flex items-center justify-center"
                      >
                        <ExternalLink className="w-4.5 h-4.5" />
                        <span>Add to Google Calendar</span>
                      </Button>
                    </div>
                  </div>

                  {/* Vertical Divider for desktop */}
                  <div className="hidden md:block w-px bg-border/10 self-stretch" />

                  {/* Right Column: Calendar picker */}
                  <div className="w-full md:w-auto md:pl-2 shrink-0 flex flex-col gap-4 items-center">
                    <div className="space-y-1 text-center">
                      <label className="text-[10px] sm:text-xs font-bold tracking-wider text-muted-foreground/45 uppercase block">
                        Repeat Weekly Until
                      </label>
                      <span className="text-sm font-bold text-foreground tracking-tight block">
                        {format(parsedEndDate, "eeee, MMMM d, yyyy")}
                      </span>
                    </div>

                    <div className="h-[280px] flex items-start justify-center">
                      <Calendar
                        mode="single"
                        selected={parsedEndDate}
                        onSelect={(date) => {
                          if (date) {
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, "0");
                            const day = String(date.getDate()).padStart(2, "0");
                            setEndDate(`${y}-${m}-${day}`);
                          }
                        }}
                        disabled={(date) => date < new Date()}
                      />
                    </div>
                  </div>

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
