import { useState, useMemo } from "react";
import {
  WeeklySchedule,
  generateIcsFile,
} from "@/lib/calendar-export-utils";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Download,
  X,
  Info,
  CalendarRange,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";

interface CalendarExportPopoverProps {
  schedule: WeeklySchedule;
  weekStartDate: Date;
  className?: string;
  triggerText?: string;
}

export default function CalendarExportPopover({
  schedule,
  weekStartDate,
  className = "",
  triggerText = "Export Schedule",
}: CalendarExportPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Set default recurrence end date to 4 months from now
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 4);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const parsedEndDate = useMemo(() => new Date(endDate), [endDate]);

  const handleDownloadIcs = async () => {
    try {
      const icsContent = generateIcsFile(schedule, weekStartDate, parsedEndDate);
      await invoke("save_calendar_file", {
        content: icsContent,
        filename: "timetable_schedule.ics",
      });
    } catch (e) {
      console.error("Failed to save calendar file", e);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className={className || "rounded-md h-8 text-xs font-semibold gap-1.5 cursor-pointer bg-muted/10 border-border/20"}
      >
        {triggerText === "Export" ? (
          <Upload className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <CalendarRange className="size-3.5 text-primary shrink-0" />
        )}
        <span>{triggerText}</span>
      </Button>

      {/* Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur Overlay */}
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
              className="relative w-full max-w-[90vw] md:max-w-2xl max-h-[95vh] overflow-y-auto no-scrollbar rounded-lg bg-card border border-border/20 shadow-2xl p-5 sm:p-6 flex flex-col gap-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-primary" />
                  <h3 className="text-base sm:text-lg font-bold text-foreground">Export Timetable Schedule</h3>
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
                
                {/* Left Column: Info, button and instructions */}
                <div className="flex-1 flex flex-col justify-between gap-5 min-w-0">
                  <div className="space-y-3.5">
                    <p className="text-sm text-muted-foreground/80 leading-relaxed font-medium">
                      Export your entire weekly schedule at once. This file can be imported into Google Calendar, Apple Calendar, Outlook, and others.
                    </p>

                    <Button
                      onClick={handleDownloadIcs}
                      className="w-full rounded-md h-11 text-sm font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm border-none flex items-center justify-center"
                    >
                      <Download className="w-4.5 h-4.5" />
                      <span>Download .ics File</span>
                    </Button>
                  </div>

                  {/* Guidelines */}
                  <div className="space-y-2 border-t border-border/10 pt-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground/75 font-semibold text-xs">
                      <Info className="w-4 h-4 text-primary shrink-0" />
                      <span>How to import:</span>
                    </div>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground/50 space-y-1.5 leading-normal">
                      <li>
                        <span className="font-bold text-foreground/80">Google Calendar:</span> Go to{" "}
                        <button
                          onClick={async () => {
                            try {
                              await openUrl("https://calendar.google.com");
                            } catch (err) {
                              console.error("Failed to open calendar link:", err);
                            }
                          }}
                          className="text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 font-normal inline"
                        >
                          calendar.google.com
                        </button>
                        , open Settings → Import & Export, and upload the file.
                      </li>
                      <li>
                        <span className="font-bold text-foreground/80">Apple / Outlook:</span> Double-click the file to add all events instantly.
                      </li>
                    </ul>
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
      </AnimatePresence>
    </>
  );
}
