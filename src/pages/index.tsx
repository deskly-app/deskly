import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "@/router";
import { useAuth } from "@/hooks/useAuth";
import {
  User,
  Lock,
  Headphones,
  Eye,
  EyeOff,
  Scale,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import loginImg from "@/assets/login_image.png";

export default function MobileHome() {
  const navigate = useNavigate();
  const { authState, loading, error, login, initialized } = useAuth();
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (authState?.loggedIn) {
      navigate("/dashboard");
    }
  }, [authState, navigate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!navigator.onLine) {
      setIsOffline(true);
      return;
    }

    try {
      await login(regNo, password);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const lowerErr = errMsg.toLowerCase();
      const isNetworkError = 
        lowerErr.includes("request failed") ||
        lowerErr.includes("failed to fetch") ||
        lowerErr.includes("timeout") ||
        lowerErr.includes("connect error") ||
        lowerErr.includes("connection") ||
        lowerErr.includes("dns") ||
        lowerErr.includes("network");

      if (isNetworkError) {
        setSubmitError("Network error. Please check your internet connection and try again.");
      } else {
        setSubmitError(errMsg);
      }
    }
  };

  if (!initialized || authState?.loggedIn) {
    return (
      <main className="h-full w-full bg-background" />
    );
  }

  return (
    <main className="h-full w-full flex flex-col text-foreground antialiased overflow-y-auto no-scrollbar relative bg-background">

      {/* ── Main content ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-start px-7 pt-12 pb-6 gap-12">

        {/* Top visual group */}
        <div className="flex flex-col gap-6">
          {/* Illustration */}
          <div className="w-full flex items-center justify-center select-none pt-4">
            <img
              src={loginImg}
              className="w-full max-w-[320px] aspect-[4/3] object-contain"
              style={{
                maskImage: "linear-gradient(to bottom, #fff 35%, rgba(255,255,255,0.9) 55%, rgba(255,255,255,0.5) 75%, rgba(255,255,255,0.15) 90%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, #fff 35%, rgba(255,255,255,0.9) 55%, rgba(255,255,255,0.5) 75%, rgba(255,255,255,0.15) 90%, transparent 100%)"
              }}
              alt="Login Illustration"
            />
          </div>

          {/* Welcome Text */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-[28px] font-bold tracking-tight text-foreground leading-tight">
              Welcome Back
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
              Sign in to sync your student dashboard with your VTOP account.
            </p>
          </div>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-8 animate-fade-in" onSubmit={onSubmit}>

          {/* Fields */}
          <div className="flex flex-col gap-10">

            {/* Registration Number */}
            <div className="relative flex items-center border-b border-border/50 focus-within:border-foreground transition-colors duration-200 pb-2.5">
              <User className="w-[18px] h-[18px] text-muted-foreground/50 shrink-0 mr-3" />
              <input
                type="text"
                id="reg-no"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                disabled={loading || isOffline}
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/35 font-normal disabled:opacity-50"
                placeholder="Username"
                required
                autoComplete="username"
                autoCapitalize="characters"
              />
            </div>

            {/* Password */}
            <div className="relative flex items-center border-b border-border/50 focus-within:border-foreground transition-colors duration-200 pb-2.5">
              <Lock className="w-[18px] h-[18px] text-muted-foreground/50 shrink-0 mr-3" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || isOffline}
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/35 font-normal disabled:opacity-50"
                placeholder="Password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading || isOffline}
                className="ml-2 text-muted-foreground/40 hover:text-muted-foreground transition-colors focus:outline-none shrink-0 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-[18px] h-[18px]" />
                ) : (
                  <Eye className="w-[18px] h-[18px]" />
                )}
              </button>
            </div>
          </div>

          {/* Error / Offline Status */}
          {isOffline ? (
            <div className="flex items-start gap-2 text-destructive text-sm font-medium leading-relaxed -mt-2 bg-destructive/5 border border-destructive/10 p-3 rounded-md">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-destructive" />
              <span>You are currently offline. Please check your internet connection.</span>
            </div>
          ) : (submitError || error) ? (
            <div className="flex items-start gap-2 text-destructive text-sm font-medium leading-relaxed -mt-2 bg-destructive/5 border border-destructive/10 p-3 rounded-md">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-destructive" />
              <span>{submitError ?? error}</span>
            </div>
          ) : null}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading || isOffline}
            className="w-full h-[54px] flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:opacity-85"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In…</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <footer className="relative z-10 shrink-0 flex items-center justify-between px-8 pt-3 pb-10">
        <button
          onClick={async () => {
            try {
              await openUrl("https://github.com/Vishal-770/deskly-tauri/issues");
            } catch (err) {
              console.error("Failed to open support link:", err);
            }
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer bg-transparent border-none focus:outline-none p-0"
        >
          <Headphones className="w-3.5 h-3.5" />
          <span>Support</span>
        </button>
        <Link
          to="/legal"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Legal</span>
        </Link>
      </footer>
    </main>
  );
}
