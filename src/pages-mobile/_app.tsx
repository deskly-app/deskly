import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";

export default function MobileApp() {
  useEffect(() => {
    const splash = document.getElementById("mobile-boot-splash");
    if (!splash) return;

    // Enforce consistent minimum 2000ms (2s) boot loader display on cold start
    const minDuration = 2000;
    const bootStart = (window as unknown as { __BOOT_START__?: number }).__BOOT_START__ || Date.now();
    const elapsed = Date.now() - bootStart;
    const remaining = Math.max(0, minDuration - elapsed);

    const fadeTimer = setTimeout(() => {
      splash.classList.add("fade-out");
      setTimeout(() => {
        splash.remove();
      }, 300);
    }, remaining);

    return () => clearTimeout(fadeTimer);
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="h-screen w-full flex flex-col items-stretch overflow-hidden bg-background text-foreground pt-[env(safe-area-inset-top)]">
        <ErrorBoundary>
          <div className="app-content-wrapper flex-1 min-h-0 w-full relative">
            <Outlet />
          </div>
        </ErrorBoundary>
      </div>
    </ThemeProvider>
  );
}
