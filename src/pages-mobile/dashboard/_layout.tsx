import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Link } from "@/router";
import type { Path } from "@/router";
import type { ElementType } from "react";
import { 
  LayoutDashboard,
  User,
  Home, 
  CalendarCheck, 
  Clock, 
  Menu, 
  BookOpen,
  Library,
  ClipboardList,
  TrendingUp,
  GraduationCap,
  Calendar,
  Briefcase,
  Phone,
  Settings, 
  X,
  ArrowLeft,
  WifiOff,
} from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";

export default function MobileDashboardLayout() {
  const { isLoggedIn, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, loading, navigate]);

  if (loading || !isLoggedIn) {
    return null;
  }

  // Show back button on all pages except the root dashboard
  const rootPaths = new Set(["/dashboard", "/dashboard/timetable"]);
  const isOnSubPage = !rootPaths.has(location.pathname);

  type NavItem = {
    label: string;
    path: Path;
    icon: ElementType;
  };

  const allNavItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Profile", path: "/dashboard/profile", icon: User },
    { label: "Attendance", path: "/dashboard/attendance", icon: CalendarCheck },
    { label: "Timetable", path: "/dashboard/timetable", icon: Clock },
    { label: "Courses", path: "/dashboard/courses", icon: BookOpen },
    { label: "Curriculum", path: "/dashboard/curriculum", icon: Library },
    { label: "Exams", path: "/dashboard/exams", icon: ClipboardList },
    { label: "Marks", path: "/dashboard/marks", icon: TrendingUp },
    { label: "Grades", path: "/dashboard/grades", icon: GraduationCap },
    { label: "Academic Calendar", path: "/dashboard/academic-calendar", icon: Calendar },
    { label: "HOD & Dean", path: "/dashboard/hod-dean", icon: Briefcase },
    { label: "Contact", path: "/dashboard/contact", icon: Phone },
    { label: "Settings", path: "/dashboard/settings", icon: Settings },
  ] as const;
  // Core dock navigation items (Home, Timetable + More)
  const coreNavItems: NavItem[] = [
    { label: "Home", path: "/dashboard", icon: Home },
    { label: "Timetable", path: "/dashboard/timetable", icon: Clock },
  ] as const;



  const corePaths = new Set(coreNavItems.map((item) => item.path));
  const moreGridItems = allNavItems.filter((item) => !corePaths.has(item.path));

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background text-foreground select-none relative">

      {/* Back Button Bar & Offline Alert — visible on sub-pages */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-1 bg-background z-20">
        {isOnSubPage ? (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-0 bg-transparent p-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
        ) : (
          <div /> // spacer
        )}

        {!isOnline && (
          <div className="flex items-center gap-1 text-xs font-bold text-amber-500/80 uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/10">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-4 pb-16 px-4 bg-background">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-border/10 bg-background/95 backdrop-blur-md flex items-center justify-around px-2 shrink-0 z-30">
        {coreNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path && !isMoreOpen;
          return (
            <Link
              key={item.path}
              to={item.path as any}
              onClick={() => setIsMoreOpen(false)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                isActive 
                  ? "text-primary font-bold" 
                  : "text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs tracking-wide">{item.label}</span>
            </Link>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all border-0 bg-transparent cursor-pointer ${
            isMoreOpen 
              ? "text-primary font-bold" 
              : "text-muted-foreground/60 hover:text-foreground"
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs tracking-wide">More</span>
        </button>
      </nav>

      {/* "More" Bottom Sheet Overlay */}
      <Drawer open={isMoreOpen} onOpenChange={setIsMoreOpen} showSwipeHandle>
        <DrawerContent className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-background border-t border-border/10 max-h-[85vh] rounded-t-[32px] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 shrink-0">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-foreground font-saira tracking-tight">Explore Features</h3>
              <p className="text-xs text-muted-foreground">Access academic & campus services</p>
            </div>
            <button 
              onClick={() => setIsMoreOpen(false)}
              className="p-2 bg-muted/40 hover:bg-muted/60 rounded-full border-0 text-foreground cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grid of features */}
          <div className="flex-1 overflow-y-auto no-scrollbar pt-2">
            <div className="grid grid-cols-3 gap-2">
              {moreGridItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path as any}
                    onClick={() => setIsMoreOpen(false)}
                    className={`group flex flex-col items-center justify-center p-3 rounded-lg bg-muted/20 border border-transparent transition-all duration-200 active:bg-muted/40 cursor-pointer ${
                      isActive 
                        ? "bg-primary/5 dark:bg-primary/10 border-primary/10 text-primary" 
                        : "text-foreground"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/5 text-muted-foreground group-hover:text-foreground group-hover:bg-muted-foreground/10"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs text-center font-medium tracking-tight mt-2 leading-none w-full truncate ${
                      isActive ? "text-primary font-semibold" : "text-muted-foreground group-hover:text-foreground"
                    }`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
