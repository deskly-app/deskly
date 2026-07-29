import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { TitleBar } from "@/components/TitleBar";
import { NoInternetOverlay } from "@/components/NoInternetOverlay";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { checkForUpdates } from "@/lib/updater";

export default function App() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    // Check for updates silently on startup
    checkForUpdates(true);
    const splash = document.getElementById("mobile-boot-splash");
    if (splash) {
      splash.style.display = "none";
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <NoInternetOverlay isOnline={isOnline} />
      <TitleBar />
      <div className="pt-8 h-screen w-full flex flex-col items-stretch overflow-hidden bg-background text-foreground">
        <ErrorBoundary>
          <div className="app-content-wrapper flex-1 min-h-0 w-full relative">
            {isOnline ? <Outlet /> : null}
          </div>
        </ErrorBoundary>
      </div>
    </ThemeProvider>
  );
}


