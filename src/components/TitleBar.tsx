import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

import appLogo from "@/assets/app-logo.webp";

// Tauri v2 API for the current window
const appWindow = getCurrentWindow();

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleDragStart = async (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!e.isPrimary || e.button !== 0 || target.closest(".titlebar-no-drag")) {
      return;
    }

    // Native drag region is preferred, but this fallback improves reliability on Windows.
    await appWindow.startDragging();
  };

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="h-8 bg-background flex justify-between items-center select-none z-50 fixed top-0 left-0 right-0 w-full text-foreground border-b border-border shadow-sm">
      {/* Draggable strip */}
      <div
        data-tauri-drag-region
        className="titlebar-drag-region flex-1 h-full flex items-center pl-3 gap-2"
        onPointerDown={handleDragStart}
      >
        <img
          src={appLogo}
          alt="Logo"
          className="w-4 h-4 object-contain pointer-events-none"
        />
        <span className="text-xs font-semibold text-muted-foreground tracking-wider pointer-events-none">
          Deskly
        </span>
      </div>

      {/* Window Controls */}
      <div className="titlebar-no-drag flex h-full">
        <button
          className="h-full px-4 hover:bg-muted flex items-center justify-center transition-colors titlebar-no-drag"
          onClick={() => appWindow.minimize()}
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          className="h-full px-4 hover:bg-muted flex items-center justify-center transition-colors titlebar-no-drag"
          onClick={() => appWindow.toggleMaximize()}
        >
          {isMaximized ? (
            <div className="relative w-3 h-3 mt-1">
              <div className="absolute top-0 right-0 w-2.5 h-2.5 border border-current rounded-sm"></div>
              <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border border-current rounded-sm bg-background"></div>
            </div>
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>
        <button
          className="h-full px-4 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors titlebar-no-drag"
          onClick={() => appWindow.close()}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
