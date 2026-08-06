import { useState, useMemo } from "react";
import {
  ExamScheduleEntry,
  getExamGoogleCalendarLink,
  parseDateStr,
} from "@/lib/calendar-export-utils";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus,
  ExternalLink,
  X,
  MapPin,
  Clock,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";

interface SingleExamExportModalProps {
  entry: ExamScheduleEntry;
}

export default function SingleExamExportModal({
  entry,
}: SingleExamExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const parsedDate = useMemo(() => {
    return parseDateStr(entry.examDate);
  }, [entry.examDate]);

  const dateFormatted = useMemo(() => {
    if (!parsedDate) return "Schedule Pending (TBA)";
    const formattedOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    return parsedDate.toLocaleDateString("en-US", formattedOptions);
  }, [parsedDate]);

  const gCalLink = useMemo(() => {
    return getExamGoogleCalendarLink(entry);
  }, [entry]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
        title="Export exam to Google Calendar"
      >
        <CalendarPlus className="w-4 h-4" />
      </button>

      {/* Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar rounded-lg bg-card border border-border/40 shadow-2xl p-6 flex flex-col gap-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Export Exam Event</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Exam Info Card */}
              <div className="p-3 rounded-md bg-muted/5 border border-border/10 space-y-1.5">
                <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                  {entry.courseCode} · Seat {entry.seatNo}
                </span>
                <h4 className="text-sm font-bold text-foreground mt-1">{entry.courseTitle}</h4>
                <div className="flex flex-col gap-1 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                    <span>{entry.examTime} (Reporting: {entry.reportingTime})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                    <span>{entry.venue} {entry.seatLocation !== "-" && `(${entry.seatLocation})`}</span>
                  </div>
                </div>
              </div>

              {/* Event Time Info */}
              <div className="p-3 rounded-md bg-muted/10 border border-border/5 space-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-xs">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Exam Date:</span>
                </div>
                <p className="text-xs text-foreground font-bold pl-5 leading-normal">
                  {dateFormatted}
                </p>
              </div>

              {/* Action Button */}
              <div className="mt-1">
                <Button
                  onClick={async () => {
                    try {
                      await openUrl(gCalLink);
                    } catch (err) {
                      console.error("Failed to open calendar link:", err);
                    }
                  }}
                  className="w-full rounded-md h-9 text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Add to Google Calendar</span>
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
