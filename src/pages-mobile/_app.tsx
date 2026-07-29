import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";

export default function MobileApp() {
  useEffect(() => {
    const splash = document.getElementById("mobile-boot-splash");
    if (splash) {
      splash.classList.add("fade-out");
      const timer = setTimeout(() => {
        splash.style.display = "none";
      }, 300);
      return () => clearTimeout(timer);
    }
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
