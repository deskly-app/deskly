import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@/router";
import { useAuth } from "@/hooks/useAuth";
import { authGetSemester, Semester } from "@/lib/tauri-auth";
import {
  Terminal,
  Search,
  Copy,
  Check,
  RotateCcw,
  Key,
  Calendar,
  Award,
  BookOpen,
  Sparkles,
  ShieldAlert,
  Play,
  Bookmark,
  Hash,
  Activity,
  ChevronRight,
  ScrollText,
  LogOut,
  User
} from "lucide-react";
import Loader from "@/components/Loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";


// Interfaces
interface CommandParam {
  name: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  options?: string[];
  optional?: boolean;
  defaultValue?: string;
}

interface CommandMetadata {
  name: string;
  displayName: string;
  description: string;
  category: "Authentication" | "Keyring" | "Attendance" | "Marks" | "Features" | "Curriculum" | "Timetable" | "Profile & Grades" | "Content & General";
  params?: CommandParam[];
  processArgs?: (values: Record<string, string>) => Record<string, any>;
}

// Commands definition
const COMMANDS: CommandMetadata[] = [
  // Auth & Keyring
  {
    name: "auth_login",
    displayName: "Auth Login",
    description: "Authenticates with VTOP using registration number and password.",
    category: "Authentication",
    params: [
      { name: "username", label: "Username / Reg No", type: "text", placeholder: "e.g. 21BCE0001" },
      { name: "password", label: "Password", type: "password", placeholder: "VTOP Password" }
    ]
  },
  {
    name: "auth_logout",
    displayName: "Auth Logout",
    description: "Clears current auth state, cached credentials, and keyring.",
    category: "Authentication"
  },
  {
    name: "auth_get_state",
    displayName: "Get Auth State",
    description: "Fetches current session authentication state from memory store.",
    category: "Authentication"
  },
  {
    name: "auth_get_credential_status",
    displayName: "Get Credential Status",
    description: "Checks if credentials are stored in memory and if keyring works.",
    category: "Authentication"
  },
  {
    name: "auth_restore_session",
    displayName: "Restore Session",
    description: "Attempts auto-restore of the session from disk persistence.",
    category: "Authentication"
  },
  {
    name: "auth_set_tokens",
    displayName: "Set Auth Tokens",
    description: "Overwrites current VTOP session tokens in memory store.",
    category: "Authentication",
    params: [
      { name: "authorizedID", label: "Authorized ID", type: "text", placeholder: "authorizedID" },
      { name: "csrf", label: "CSRF Token", type: "text", placeholder: "_csrf" },
      { name: "cookies", label: "Cookies Header String", type: "text", placeholder: "session cookies" }
    ],
    processArgs: (values) => ({
      tokens: {
        authorizedID: values.authorizedID || "",
        csrf: values.csrf || "",
        cookies: values.cookies || ""
      }
    })
  },
  {
    name: "auth_get_tokens",
    displayName: "Get Auth Tokens",
    description: "Fetches currently active cookies and csrf tokens from memory store.",
    category: "Authentication"
  },
  {
    name: "auth_clear_tokens",
    displayName: "Clear Auth Tokens",
    description: "Clears only VTOP tokens (cookies/csrf) from memory store and disk.",
    category: "Authentication"
  },
  {
    name: "auth_get_semester",
    displayName: "Get Active Semester",
    description: "Retrieves currently selected semester metadata.",
    category: "Authentication"
  },
  {
    name: "auth_set_semester",
    displayName: "Set Active Semester",
    description: "Sets the selected active semester to VTOP memory store.",
    category: "Authentication",
    params: [
      { name: "id", label: "Semester ID", type: "text", placeholder: "e.g. CH20212201" },
      { name: "name", label: "Semester Name", type: "text", placeholder: "e.g. Fall Semester 2021-22" }
    ],
    processArgs: (values) => ({
      semester: {
        id: values.id || "",
        name: values.name || ""
      }
    })
  },
  {
    name: "auth_clear_semester",
    displayName: "Clear Active Semester",
    description: "Clears selected semester from the memory store.",
    category: "Authentication"
  },
  {
    name: "auth_get_semesters",
    displayName: "Get Semesters List (Auth)",
    description: "Fetches the list of all semesters available from VTOP common schedule.",
    category: "Authentication"
  },
  {
    name: "auth_auto_relogin",
    displayName: "Auto Relogin",
    description: "Performs auto-relogin flow using stored encrypted password or keyring fallback.",
    category: "Authentication"
  },
  {
    name: "auth_keyring_set",
    displayName: "Keyring Set",
    description: "Writes a password to the secure system keyring/keychain.",
    category: "Keyring",
    params: [
      { name: "username", label: "Username / Account ID", type: "text", placeholder: "e.g. 21BCE0001" },
      { name: "password", label: "Password", type: "password", placeholder: "Credential Password" }
    ]
  },
  {
    name: "auth_keyring_get",
    displayName: "Keyring Get",
    description: "Retrieves a stored password from the secure system keyring/keychain.",
    category: "Keyring",
    params: [
      { name: "username", label: "Username / Account ID", type: "text", placeholder: "e.g. 21BCE0001" }
    ]
  },
  {
    name: "auth_keyring_delete",
    displayName: "Keyring Delete",
    description: "Removes stored password credentials from the secure system keyring/keychain.",
    category: "Keyring",
    params: [
      { name: "username", label: "Username / Account ID", type: "text", placeholder: "e.g. 21BCE0001" }
    ]
  },

  // Attendance
  {
    name: "attendance_get_semesters",
    displayName: "Get Attendance Semesters",
    description: "Fetches list of semesters from the attendance portal page.",
    category: "Attendance"
  },
  {
    name: "attendance_get_current",
    displayName: "Get Current Attendance",
    description: "Fetches student's attendance records for the selected active semester.",
    category: "Attendance"
  },
  {
    name: "attendance_get_detail",
    displayName: "Get Attendance Details",
    description: "Fetches slot-wise and date-wise detailed attendance log for a specific class.",
    category: "Attendance",
    params: [
      { name: "classId", label: "Class ID / Number", type: "text", placeholder: "e.g. VITC2021221001" },
      { name: "slotName", label: "Slot Name", type: "text", placeholder: "e.g. A1+TA1" }
    ]
  },

  // Marks
  {
    name: "marks_get_student_mark_view",
    displayName: "Get Marks View",
    description: "Fetches evaluation and grading marks for courses in a specific semester.",
    category: "Marks",
    params: [
      { name: "semesterSubId", label: "Semester Sub ID (optional)", type: "text", placeholder: "e.g. CH20212201", optional: true }
    ]
  },

  // Features
  {
    name: "academic_calendar_get",
    displayName: "Get Academic Calendar Info",
    description: "Fetches semesters dates available for calendar preview.",
    category: "Features"
  },
  {
    name: "academic_calendar_get_view",
    displayName: "Get Academic Calendar Month",
    description: "Fetches events and holidays for a specific academic calendar date.",
    category: "Features",
    params: [
      { name: "calDate", label: "Calendar Date (MM-YYYY)", type: "text", placeholder: "e.g. 06-2026" }
    ]
  },
  {
    name: "mess_get_menu",
    displayName: "Get Mess Menu",
    description: "Fetches mess food menu from remote json data.",
    category: "Features",
    params: [
      {
        name: "messType",
        label: "Mess Type",
        type: "select",
        options: ["Veg-mens", "Non-Veg-mens", "Special-mens", "Veg-womens", "Non-Veg-womens", "Special-womens"]
      }
    ]
  },
  {
    name: "laundry_get_schedule",
    displayName: "Get Laundry Schedule",
    description: "Fetches laundry washing days schedule for a hostel block.",
    category: "Features",
    params: [
      {
        name: "block",
        label: "Hostel Block",
        type: "select",
        options: ["A", "B", "CB", "CG", "D1", "D2", "E"]
      }
    ]
  },
  {
    name: "contact_info_get",
    displayName: "Get HRMS Contact Details",
    description: "Fetches administrative and emergency department contact lists.",
    category: "Features"
  },
  {
    name: "payment_receipts_get",
    displayName: "Get Payment Receipts",
    description: "Retrieves list of student payment receipts records.",
    category: "Features"
  },

  {
    name: "curriculum_get",
    displayName: "Get Curriculum Categories",
    description: "Fetches credit status of credit categories from the student curriculum.",
    category: "Curriculum"
  },
  {
    name: "curriculum_get_category_view",
    displayName: "Get Curriculum Category Courses",
    description: "Fetches courses listed under a particular curriculum category code.",
    category: "Curriculum",
    params: [
      { name: "categoryId", label: "Category ID / Code", type: "text", placeholder: "e.g. UC" }
    ]
  },
  {
    name: "curriculum_download_syllabus",
    displayName: "Download Curriculum Syllabus",
    description: "Downloads course syllabus zip payload for a specific course code.",
    category: "Curriculum",
    params: [
      { name: "courseCode", label: "Course Code", type: "text", placeholder: "e.g. CSE1001" }
    ]
  },
  {
    name: "exam_schedule_get",
    displayName: "Get Exam Schedule",
    description: "Fetches raw HTML exam schedule for a student via POST multipart form request.",
    category: "Features",
    params: [
      { name: "semesterSubId", label: "Semester Sub ID (optional)", type: "text", placeholder: "e.g. CH20252605", optional: true }
    ]
  },
  {
    name: "hod_dean_details_get",
    displayName: "Get HOD & Dean Details",
    description: "Fetches structured HOD and Dean details including names, schools, emails, cabins, and photo base64 strings.",
    category: "Features"
  },

  // Timetable
  {
    name: "timetable_get_courses",
    displayName: "Get Timetable Courses",
    description: "Retrieves registered courses list for a given semester.",
    category: "Timetable",
    params: [
      { name: "semesterSubId", label: "Semester Sub ID (optional)", type: "text", placeholder: "e.g. CH20212201", optional: true }
    ]
  },
  {
    name: "timetable_get_weekly",
    displayName: "Get Weekly Timetable",
    description: "Generates weekly scheduling grids matching course slots.",
    category: "Timetable",
    params: [
      { name: "semesterSubId", label: "Semester Sub ID (optional)", type: "text", placeholder: "e.g. CH20212201", optional: true }
    ]
  },

  // Profile & Grades
  {
    name: "profile_get_student_profile",
    displayName: "Get Student Profile",
    description: "Fetches student personal, proctor, and hostel room information.",
    category: "Profile & Grades"
  },
  {
    name: "grades_get_history",
    displayName: "Get Grades History",
    description: "Fetches full grade history, CGPA status, and curriculum details.",
    category: "Profile & Grades"
  },
  {
    name: "feedback_get_status",
    displayName: "Get Feedback Status",
    description: "Checks student feedback submission status (Midterm/Tee).",
    category: "Profile & Grades"
  },

  // Content & General
  {
    name: "get_content_page",
    displayName: "Get Content Page",
    description: "Fetches dashboard course card list from current semester page.",
    category: "Content & General"
  },
  {
    name: "get_cgpa_page",
    displayName: "Get CGPA Credits Page",
    description: "Fetches CGPA summary stats from current semester portal.",
    category: "Content & General"
  },
  {
    name: "greet",
    displayName: "Greet Greet",
    description: "Greets a person using backend Rust service.",
    category: "Content & General",
    params: [
      { name: "name", label: "Your Name", type: "text", placeholder: "e.g. John Doe" }
    ]
  },
  {
    name: "test_backend",
    displayName: "Test Notification Popup",
    description: "Requests permission and displays a native OS system notification popup with a backend confirmation message.",
    category: "Content & General"
  }
];

const CATEGORIES = [
  { name: "All", icon: Terminal },
  { name: "Authentication", icon: ShieldAlert },
  { name: "Keyring", icon: Key },
  { name: "Attendance", icon: Bookmark },
  { name: "Marks", icon: Hash },
  { name: "Features", icon: Sparkles },
  { name: "Curriculum", icon: ScrollText },
  { name: "Timetable", icon: Calendar },
  { name: "Profile & Grades", icon: Award },
  { name: "Content & General", icon: BookOpen }
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading, logout, authState } = useAuth();
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCommand, setSelectedCommand] = useState<CommandMetadata>(COMMANDS[0]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<{
    command: string;
    status: "success" | "error" | "idle";
    duration: number;
    payload: any;
  }>({
    command: "",
    status: "idle",
    duration: 0,
    payload: null
  });
  const [copied, setCopied] = useState(false);

  // Route protection redirect
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, authLoading, navigate]);

  // Load active semester
  useEffect(() => {
    async function loadSemester() {
      try {
        const sem = await authGetSemester();
        setActiveSemester(sem);
      } catch (err) {
        console.error("Failed to load active semester:", err);
      }
    }
    if (isLoggedIn) {
      loadSemester();
    }
  }, [isLoggedIn]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Initialize parameters on mount
  useEffect(() => {
    selectCommand(COMMANDS[0]);
  }, []);


  // Filter commands
  const filteredCommands = useMemo(() => {
    return COMMANDS.filter((cmd) => {
      const matchSearch =
        cmd.displayName.toLowerCase().includes(search.toLowerCase()) ||
        cmd.name.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === "All" || cmd.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [search, selectedCategory]);

  // Handle selected command parameters reset
  function selectCommand(cmd: CommandMetadata) {
    setSelectedCommand(cmd);
    const defaults: Record<string, string> = {};
    if (cmd.params) {
      cmd.params.forEach((p) => {
        defaults[p.name] = p.defaultValue || (p.type === "select" && p.options ? p.options[0] : "");
      });
    }
    setParamValues(defaults);
  }

  // Reset parameters
  const resetParams = () => {
    selectCommand(selectedCommand);
  };

  // Invoke Tauri Command
  const handleInvoke = async () => {
    setLoading(true);
    const startTime = performance.now();
    let payload: any;
    let status: "success" | "error" = "success";

    // Prepare arguments
    let args: Record<string, any> = {};
    if (selectedCommand.processArgs) {
      args = selectedCommand.processArgs(paramValues);
    } else if (selectedCommand.params) {
      selectedCommand.params.forEach((p) => {
        let val: any = paramValues[p.name];
        // Parse numbers if necessary
        if (p.type === "text" && !val && p.optional) {
          val = null; // Send null for empty optional fields
        }
        args[p.name] = val;
      });
    }

    try {
      if (selectedCommand.name === "test_backend") {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          await requestPermission();
        }
      }
      payload = await invoke(selectedCommand.name, args);
      status = "success";
    } catch (err: any) {
      payload = err;
      status = "error";
    } finally {
      const duration = Math.round(performance.now() - startTime);
      setLastResponse({
        command: selectedCommand.displayName,
        status,
        duration,
        payload
      });
      setLoading(false);
    }
  };

  // Copy JSON response
  const copyToClipboard = () => {
    if (!lastResponse.payload) return;
    navigator.clipboard.writeText(JSON.stringify(lastResponse.payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pretty JSON formatting
  const prettyJson = useMemo(() => {
    if (!lastResponse.payload) return "No response payload.";
    if (typeof lastResponse.payload === "string") {
      try {
        return JSON.stringify(JSON.parse(lastResponse.payload), null, 2);
      } catch {
        return lastResponse.payload;
      }
    }
    return JSON.stringify(lastResponse.payload, null, 2);
  }, [lastResponse]);

  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <main className="h-full w-full overflow-y-auto no-scrollbar bg-background text-foreground selection:bg-primary/20">
      {/* Fullscreen Loader with premium glassmorphism background */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md flex items-center justify-center transition-all duration-300">
          <Loader />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/40 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
              Deskly Debug Console
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Exposing all Tauri Rust backend commands for interactive front-end invocation, parameter testing, and keyring verification.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 self-start lg:self-auto">
            {/* Session Info */}
            {isLoggedIn && authState && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground font-semibold bg-accent/15 border border-border/30 px-3 py-1.5 rounded-md">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>{authState.userId}</span>
                </div>
                {activeSemester && (
                  <div className="flex items-center gap-2 text-muted-foreground font-semibold bg-accent/15 border border-border/30 px-3 py-1.5 rounded-md max-w-[200px] sm:max-w-none truncate">
                    <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{activeSemester.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Status & Logout */}
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <button
                  onClick={() => navigate("/dashboard/timetable")}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all duration-200 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>View Timetable</span>
                </button>
              )}

              <button
                onClick={async () => {
                  try {
                    let permissionGranted = await isPermissionGranted();
                    if (!permissionGranted) {
                      await requestPermission();
                    }
                    const res = await invoke<string>("test_backend");
                    console.log("Backend response:", res);
                    setLastResponse({
                      command: "Test Backend Button",
                      status: "success",
                      duration: 0,
                      payload: res
                    });
                  } catch (err) {
                    console.error("Backend test failed:", err);
                    setLastResponse({
                      command: "Test Backend Button",
                      status: "error",
                      duration: 0,
                      payload: err
                    });
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all duration-200 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>Test Backend</span>
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-accent/30 border border-border/50 text-muted-foreground w-fit">
                <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span>Connected</span>
              </div>

              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-destructive/20 hover:border-destructive/40 bg-destructive/5 hover:bg-destructive/10 text-destructive text-xs font-bold transition-all duration-200 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Command Browser (lg:col-span-5) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Search and Category filters */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search 37 commands..."
                  className="h-11 w-full rounded-lg border border-border/50 bg-accent/10 pl-10 pr-4 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Category selector pills */}
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar py-1">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                          : "bg-accent/15 border border-border/30 hover:bg-accent/35 text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Commands List Card (Glassmorphic, Rounded-2xl) */}
            <div className="rounded-lg border border-border/40 bg-accent/5 overflow-hidden">
              <div className="p-4 border-b border-border/40 bg-accent/10 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Available Commands ({filteredCommands.length})
                </span>
              </div>
              <div className="divide-y divide-border/30 max-h-[420px] overflow-y-auto no-scrollbar">
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((cmd) => {
                    const isSelected = selectedCommand.name === cmd.name;
                    return (
                      <button
                        key={cmd.name}
                        onClick={() => selectCommand(cmd)}
                        className={`w-full text-left p-3 transition-all duration-200 flex items-start justify-between gap-4 group ${
                          isSelected
                            ? "bg-accent/30 border-l-2 border-primary pl-3"
                            : "hover:bg-accent/15 border-l-2 border-transparent"
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {cmd.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {cmd.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-accent/20 text-muted-foreground uppercase tracking-wider scale-90">
                            {cmd.category.split(" ")[0]}
                          </span>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                            isSelected ? "translate-x-0.5 text-primary" : "group-hover:translate-x-0.5"
                          }`} />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No commands match your query.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right Column: Execution Form & Results (lg:col-span-7) */}
          <section className="lg:col-span-7 space-y-6">
            
            {/* Command Config / Input Form Card */}
            <div className="rounded-lg border border-border/40 bg-accent/5 p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest font-bold text-primary">
                    {selectedCommand.category}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <code className="text-xs font-mono px-2 py-0.5 bg-accent/20 rounded border border-border/40 text-foreground/80">
                    {selectedCommand.name}
                  </code>
                </div>
                <h2 className="text-xl font-bold tracking-tight">{selectedCommand.displayName}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedCommand.description}
                </p>
              </div>

              {/* Dynamic inputs form */}
              {selectedCommand.params && selectedCommand.params.length > 0 ? (
                <div className="space-y-4 pt-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Command Arguments
                  </span>
                  <div className="grid gap-4">
                    {selectedCommand.params.map((p) => (
                      <div key={p.name} className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                          <span>{p.label} {p.optional && <span className="font-normal text-xs text-muted-foreground/60">(Optional)</span>}</span>
                          <span className="font-mono text-xs text-muted-foreground/60">{p.name}</span>
                        </label>
                        
                        {p.type === "select" ? (
                          <Select
                            value={paramValues[p.name] || ""}
                            onValueChange={(val) => setParamValues({ ...paramValues, [p.name]: val })}
                          >
                            <SelectTrigger className="h-10 w-full rounded-md border border-border/50 bg-accent/10 px-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200">
                              <SelectValue placeholder={p.placeholder || "Select an option..."} />
                            </SelectTrigger>
                            <SelectContent className="rounded-md border-border/50 bg-card">
                              {p.options?.map((opt) => (
                                <SelectItem key={opt} value={opt} className="rounded-md">
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <input
                            type={p.type}
                            placeholder={p.placeholder}
                            className="h-10 w-full rounded-md border border-border/50 bg-accent/10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/50"
                            value={paramValues[p.name] || ""}
                            onChange={(e) => setParamValues({ ...paramValues, [p.name]: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-accent/10 border border-border/30 p-4 text-center text-xs text-muted-foreground">
                  This command takes no arguments.
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleInvoke}
                  disabled={loading}
                  className="flex items-center gap-2 h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 shadow-lg shadow-primary/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Invoke Command</span>
                </button>
                {selectedCommand.params && selectedCommand.params.length > 0 && (
                  <button
                    onClick={resetParams}
                    className="flex items-center gap-2 h-11 px-4 rounded-md bg-accent/20 hover:bg-accent/40 border border-border/40 font-semibold text-sm transition-all duration-150 cursor-pointer text-foreground"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset Fields</span>
                  </button>
                )}
              </div>
            </div>

            {/* Response Viewer Panel */}
            <div className="rounded-lg border border-border/40 bg-accent/5 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold">Response Inspector</h3>
                  {lastResponse.command && (
                    <p className="text-xs text-muted-foreground">
                      Last run: <span className="font-semibold text-foreground/80">{lastResponse.command}</span>
                    </p>
                  )}
                </div>

                {/* Badges and actions */}
                <div className="flex items-center gap-3">
                  {lastResponse.status !== "idle" && (
                    <>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-accent/20 border border-border/40 text-muted-foreground">
                        {lastResponse.duration} ms
                      </span>
                      <span className={`text-xs uppercase tracking-wider font-extrabold px-2 py-1 rounded-full ${
                        lastResponse.status === "success"
                          ? "bg-chart-2/10 border border-chart-2/30 text-chart-2"
                          : "bg-destructive/10 border border-destructive/30 text-destructive"
                      }`}>
                        {lastResponse.status}
                      </span>
                    </>
                  )}
                  {lastResponse.payload && (
                    <button
                      onClick={copyToClipboard}
                      className="p-2 rounded-md bg-accent/20 hover:bg-accent/40 border border-border/40 text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
                      title="Copy response payload"
                    >
                      {copied ? <Check className="w-4 h-4 text-chart-2" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Code viewer screen */}
              <div className="relative">
                <pre className="font-mono text-xs overflow-auto max-h-[360px] p-4 rounded-md border border-border/30 bg-accent/15 leading-relaxed whitespace-pre-wrap break-words text-foreground/90 select-text no-scrollbar">
                  {prettyJson}
                </pre>
              </div>
            </div>

          </section>
        </div>
      </div>
    </main>
  );
}
