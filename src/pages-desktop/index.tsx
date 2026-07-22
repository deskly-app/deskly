import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "@/router";
import { useAuth } from "@/hooks/useAuth";
import { User, LogIn, HelpCircle, Eye, EyeOff, Scale, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function Home() {
  const navigate = useNavigate();
  const { authState, loading, error, login, initialized } = useAuth();
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [version, setVersion] = useState("");
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

  useEffect(() => {
    async function loadVersion() {
      try {
        const ver = await getVersion();
        setVersion(ver);
      } catch (err) {
        console.warn("Failed to get app version:", err);
      }
    }
    loadVersion();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!navigator.onLine) {
      setIsOffline(true);
      return;
    }

    try {
      await login(regNo, password);
      navigate("/dashboard");
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

  const smoothTransition = {
    duration: 0.8,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
  };

  if (!initialized) {
    return (
      <main className="h-full min-h-0 flex items-center justify-center bg-background text-foreground antialiased p-6">
        <div className="w-full max-w-[400px] flex flex-col gap-16 py-10 items-center sm:items-start">
          <div className="w-12 h-12 bg-muted/30 rounded-md animate-pulse" />
          <div className="w-full space-y-8">
            <div className="space-y-3">
              <div className="h-8 bg-muted/30 rounded animate-pulse w-1/2" />
              <div className="h-4 bg-muted/20 rounded animate-pulse w-3/4" />
            </div>
            <div className="space-y-6 pt-4">
              <div className="h-12 bg-muted/20 rounded-md animate-pulse" />
              <div className="h-12 bg-muted/20 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-full min-h-0 overflow-y-auto no-scrollbar relative bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Industrial Watermark - Subtle branding */}
      <div className="hidden sm:block absolute top-24 right-24 text-[14rem] font-black text-foreground opacity-[0.015] pointer-events-none select-none leading-none tracking-tighter uppercase">
        DESKLY
      </div>

      <div className="min-h-full w-full flex items-center justify-center p-6 sm:p-16">
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={smoothTransition}
          className="w-full max-w-[400px] flex flex-col gap-16 py-10"
        >
          {/* Logo & Header */}
          <div className="space-y-8 flex flex-col items-center sm:items-start text-center sm:text-left">
            <img src="/logo.png" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" alt="Deskly Logo" />
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground leading-none">
                Sign In
              </h1>
              <p className="text-sm text-muted-foreground/60 leading-relaxed max-w-[320px]">
                Sync your student dashboard with your official VTOP credentials.
              </p>
            </div>
          </div>

          <form className="space-y-12" onSubmit={onSubmit}>
            <div className="space-y-8">
              
              {/* Registration Number Field */}
              <div className="group space-y-3">
                <label
                  htmlFor="reg-no"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 ml-0.5"
                >
                  Registration Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="reg-no"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    disabled={loading || isOffline}
                    className="block w-full h-12 pl-0 pr-12 bg-transparent border-b border-border/70 focus:border-primary focus:outline-none text-base font-normal text-foreground placeholder:text-muted-foreground/25 transition-colors rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Username"
                    required
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 transition-colors pointer-events-none group-focus-within:text-primary/70">
                    <User className="w-4.5 h-4.5" />
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="group space-y-3">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 ml-0.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || isOffline}
                    className="block w-full h-12 pl-0 pr-12 bg-transparent border-b border-border/70 focus:border-primary focus:outline-none text-base font-normal text-foreground placeholder:text-muted-foreground/25 transition-colors rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading || isOffline}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground transition-colors focus:outline-none disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4.5 h-4.5" />
                    ) : (
                      <Eye className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message / Offline Status */}
            {isOffline ? (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/10 p-3 rounded-md font-semibold leading-relaxed text-center">
                You are currently offline. Please check your internet connection.
              </p>
            ) : (submitError || error) ? (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/10 p-3 rounded-md font-semibold leading-relaxed text-center">
                {submitError ?? error}
              </p>
            ) : null}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || isOffline}
                className="w-full h-12 flex justify-center items-center bg-primary hover:bg-primary/95 text-primary-foreground text-sm font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Signing In…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <LogIn className="w-4 h-4 ml-2.5 opacity-80" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer links */}
          <footer className="flex items-center justify-between pt-10 border-t border-border/10">
            <div className="flex gap-5">
              <button
                onClick={async () => {
                  try {
                    await openUrl("https://github.com/Vishal-770/deskly-tauri/issues");
                  } catch (err) {
                    console.error("Failed to open support link:", err);
                  }
                }}
                className="text-xs text-muted-foreground/60 hover:text-primary transition-colors font-semibold flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 focus:outline-none"
              >
                <HelpCircle className="w-4 h-4" />
                Support
              </button>
              <Link
                to="/legal"
                className="text-xs text-muted-foreground/60 hover:text-primary transition-colors font-semibold flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 focus:outline-none"
              >
                <Scale className="w-4 h-4" />
                Legal
              </Link>
            </div>
            <span className="text-xs text-muted-foreground/35 font-bold select-none">
              {version ? `v${version}` : "v1.0.7"}
            </span>
          </footer>
        </motion.section>
      </div>
    </main>
  );
}
