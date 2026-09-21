import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { TitleBar } from "@/components/TitleBar";
import { NoInternetOverlay } from "@/components/NoInternetOverlay";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useClassReminders } from "@/hooks/use-class-reminders";
import { checkForUpdates } from "@/lib/updater";

export default function App() {
  const isOnline = useOnlineStatus();
  useClassReminders();

  useEffect(() => {
    // Check for updates silently on startup
    checkForUpdates(true);
    const splash = document.getElementById("mobile-boot-splash");
    if (splash) {
      splash.remove();
    }
  }, []);

  useEffect(() => {
    // Disable right-click browser context menu (Back, Reload, Inspect, etc.)
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    // Disable browser zoom keyboard shortcuts: Ctrl + / -, Ctrl + 0, Ctrl + =
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
        e.preventDefault();
      }
    };

    // Disable Ctrl+scroll zoom
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    // passive: false is required so we can call preventDefault on wheel
    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <NoInternetOverlay isOnline={isOnline} />
      <TitleBar />
      <div className="pt-8 h-screen w-full flex flex-col items-stretch overflow-hidden bg-background text-foreground">
        <ErrorBoundary>
          <div className="app-content-wrapper flex-1 min-h-0 w-full relative">
            <Outlet />
          </div>
        </ErrorBoundary>
      </div>
    </ThemeProvider>
  );
}


