import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  CalendarClock,
  UserCheck,
  BookOpen,
  Library,
  ClipboardList,
  TrendingUp,
  GraduationCap,
  Calendar,
  Briefcase,
  Phone,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Fuse from "fuse.js";
import { motion, AnimatePresence } from "framer-motion";

let globalIsHovered = false;

const DashboardSidebar = () => {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  type NavItem = {
    label: string;
    href: string;
    icon: React.ReactNode;
    description: string;
  };

  const navItems = useMemo<NavItem[]>(
    () => [
      // Group 1: Core Identity
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Profile",
        href: "/dashboard/profile",
        icon: <User className="w-5 h-5" />,
        description: "",
      },
      // Group 2: Academics
      {
        label: "Timetable",
        href: "/dashboard/timetable",
        icon: <CalendarClock className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Attendance",
        href: "/dashboard/attendance",
        icon: <UserCheck className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Courses",
        href: "/dashboard/courses",
        icon: <BookOpen className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Curriculum",
        href: "/dashboard/curriculum",
        icon: <Library className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Exams",
        href: "/dashboard/exams",
        icon: <ClipboardList className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Marks",
        href: "/dashboard/marks",
        icon: <TrendingUp className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Grades",
        href: "/dashboard/grades",
        icon: <GraduationCap className="w-5 h-5" />,
        description: "",
      },
      // Group 3: Campus Utilities & Finance
      {
        label: "Academic Calendar",
        href: "/dashboard/academic-calendar",
        icon: <Calendar className="w-5 h-5" />,
        description: "",
      },
      // Group 4: Support & Administration
      {
        label: "HOD & Dean",
        href: "/dashboard/hod-dean",
        icon: <Briefcase className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Contact",
        href: "/dashboard/contact",
        icon: <Phone className="w-5 h-5" />,
        description: "",
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: <Settings className="w-5 h-5" />,
        description: "",
      },
    ],
    [],
  );

  const results = useMemo(() => {
    if (!query) return null;

    const fuse = new Fuse(navItems, {
      keys: ["label"],
      threshold: 0.4,
    });

    return fuse.search(query).map((r) => r.item);
  }, [query, navItems]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const handleNavigate = (href: string) => {
    setSearchOpen(false);
    setQuery("");
    navigate(href);
  };

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("deskly::sidebar::collapsed") === "true";
  });

  const [isHovered, setIsHovered] = useState(globalIsHovered);

  useEffect(() => {
    if (sidebarRef.current) {
      try {
        const isActuallyHovered = sidebarRef.current.matches(":hover");
        if (isActuallyHovered !== globalIsHovered) {
          globalIsHovered = isActuallyHovered;
          setIsHovered(isActuallyHovered);
        }
      } catch (err) {
        console.error("Failed to check sidebar hover state on mount:", err);
      }
    }
  }, []);

  const setHovered = (val: boolean) => {
    globalIsHovered = val;
    setIsHovered(val);
  };

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("deskly::sidebar::collapsed", String(next));
      return next;
    });
  };

  const showLabels = !isCollapsed || isHovered;

  return (
    <>
      <div
        ref={sidebarRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`h-full bg-background text-foreground py-4 border-r flex flex-col transition-[width] duration-300 ease-in-out z-40 select-none shrink-0 px-2 ${
          showLabels ? "w-60" : "w-16"
        }`}
      >
        {/* Search Button */}
        <div className="w-full flex justify-center mb-4 shrink-0">
          <button
            onClick={() => setSearchOpen((s) => !s)}
            className="w-full px-3 py-3 flex items-center justify-start rounded-md hover:bg-muted transition-all duration-200"
          >
            <Search className="w-5 h-5 shrink-0" />
            <span
              className={`text-xs font-bold tracking-tight text-muted-foreground/60 whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${
                showLabels
                  ? "max-w-40 opacity-100 translate-x-0 ml-3"
                  : "max-w-0 opacity-0 -translate-x-2 pointer-events-none ml-0"
              }`}
            >
              Quick Search
            </span>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="space-y-1.5 flex-1 min-h-0 flex flex-col w-full overflow-y-auto no-scrollbar pb-4">
          {navItems.map((item) => {
            const active =
              location.pathname === item.href ||
              (item.href !== "/dashboard" &&
                location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                to={item.href}
                className={`w-full px-3 py-3 flex items-center justify-start rounded-md hover:bg-muted transition-all duration-200 shrink-0 ${
                  active
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground/80 hover:text-foreground"
                }`}
              >
                <div className="shrink-0">{item.icon}</div>
                <span
                  className={`text-xs font-semibold tracking-tight whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${
                    showLabels
                      ? "max-w-40 opacity-100 translate-x-0 ml-3"
                      : "max-w-0 opacity-0 -translate-x-2 pointer-events-none ml-0"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle Button at the bottom */}
        <div className="w-full flex justify-center mt-auto pt-4 border-t border-border/10 shrink-0">
          <button
            onClick={toggleSidebar}
            className="w-full px-3 py-3 flex items-center justify-start rounded-md hover:bg-muted transition-all duration-200"
            title={isCollapsed ? "Pin Sidebar (Always Expand)" : "Unpin Sidebar (Collapse)"}
          >
            <div className="shrink-0 w-5 h-5 flex items-center justify-center">
              {showLabels ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
            <span
              className={`text-xs font-bold tracking-tight text-muted-foreground/60 whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${
                showLabels
                  ? "max-w-40 opacity-100 translate-x-0 ml-3"
                  : "max-w-0 opacity-0 -translate-x-2 pointer-events-none ml-0"
              }`}
            >
              {isCollapsed ? "Pin Sidebar" : "Collapse"}
            </span>
          </button>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 flex justify-center items-start pt-28 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative z-[70] w-full max-w-lg mx-4 bg-card/90 backdrop-blur-2xl p-10 rounded-[3rem] border border-border shadow-2xl desktop-shadow"
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full p-2 outline-none bg-transparent"
                placeholder="Search..."
              />

              <div className="mt-3 max-h-60 overflow-auto no-scrollbar">
                {results?.map((r) => (
                  <button
                    key={r.href}
                    onClick={() => handleNavigate(r.href)}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex gap-2 rounded-md"
                  >
                    {r.icon}
                    {r.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DashboardSidebar;
