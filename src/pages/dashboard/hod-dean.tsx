import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getHodDeanDetails, HodDeanDetail } from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import {
  Mail,
  MapPin,
  Phone,
  Building
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSrcFromPhoto(photo: string): string {
  if (!photo) return "";
  const trimmed = photo.trim();
  if (trimmed.startsWith("data:")) {
    if (trimmed.startsWith("data:jpg;base64,")) {
      return trimmed.replace("data:jpg;base64,", "data:image/jpeg;base64,");
    }
    return trimmed;
  }
  // If it's a pure base64 string
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return trimmed;
}

function renderPhoto(photoUrl: string, name: string) {
  const src = photoUrl ? getSrcFromPhoto(photoUrl) : "";
  if (src) {
    return (
      <div className="relative w-24 h-32 sm:w-32 sm:h-40 md:w-36 md:h-44 shrink-0 overflow-hidden rounded-lg border border-border/10 bg-muted/5 flex items-center justify-center p-0.5 shadow-sm">
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover rounded-md"
        />
      </div>
    );
  }
  
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="relative w-24 h-32 sm:w-32 sm:h-40 md:w-36 md:h-44 shrink-0 overflow-hidden rounded-lg bg-primary/5 border border-border/10 flex items-center justify-center text-primary/80 shadow-sm">
      <span className="text-lg sm:text-xl font-black tracking-wider">{initials}</span>
    </div>
  );
}

// ─── Details Grid Row Field (Vertical Label/Value Stack) ───────────────────────

function renderDetailField(icon: React.ReactNode, label: string, value: string | null | undefined, className = "") {
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-border/5 group min-w-0 ${className}`}>
      <div className="w-6.5 h-6.5 rounded-full bg-primary/5 flex items-center justify-center text-primary/70 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs sm:text-xs font-black text-muted-foreground/45 uppercase tracking-widest leading-none">
          {label}
        </p>
        <p className="text-xs sm:text-sm font-semibold text-foreground/85 leading-normal break-words">
          {value || "N/A"}
        </p>
      </div>
    </div>
  );
}

// ─── Loader Skeleton Layout ───────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted/65 ${className}`} />;
}

function HodDeanSkeleton() {
  return (
    <div className="w-full space-y-10 animate-pulse">
      {/* Header skeleton */}
      <header className="pb-4 border-b border-border/20">
        <div className="space-y-2">
          <Sk className="h-6 w-36 rounded-full" />
          <Sk className="h-3 w-56 rounded-full" />
        </div>
      </header>

      {/* Row items skeleton */}
      <div className="divide-y divide-border/10">
        {[...Array(2)].map((_, idx) => (
          <div key={idx} className="py-6 sm:py-8 w-full">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start w-full">
              <Sk className="w-24 h-32 sm:w-32 sm:h-40 md:w-36 md:h-44 rounded-lg shrink-0" />
              <div className="flex-1 w-full space-y-5">
                <div className="border-b border-border/10 pb-4 flex flex-col sm:flex-row gap-3 items-center sm:items-baseline">
                  <Sk className="h-4 w-16 rounded-full" />
                  <Sk className="h-5 w-40 sm:w-56 rounded-full" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2.5 w-full">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/10">
                      <Sk className="w-6.5 h-6.5 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Sk className="h-2 w-16 rounded-full" />
                        <Sk className="h-3 w-32 rounded-full" />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-3 py-2.5 border-b border-border/10 lg:col-span-2">
                    <Sk className="w-6.5 h-6.5 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Sk className="h-2 w-20 rounded-full" />
                      <Sk className="h-3 w-48 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HodDeanDetailsPage() {
  const { loading: authLoading } = useAuth();
  const [details, setDetails] = useState<HodDeanDetail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from cache first
  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::hod_dean");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setDetails(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached HOD/Dean details", e);
      }
    }
  }, []);

  async function fetchDetails() {
    try {
      setLoading(details && details.length > 0 ? false : true);
      const res = await getHodDeanDetails();
      if (res.success && res.data) {
        setDetails(res.data);
        localStorage.setItem("deskly::cache::hod_dean", JSON.stringify(res.data));
      } else {
        setError(res.error ?? "Failed to fetch HOD and Dean details.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetails();
  }, []);

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (authLoading || loading) {
    return shell(<HodDeanSkeleton />);
  }

  if (error || !details) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error ?? "No HOD or Dean data loaded."} onRetry={fetchDetails} />
      </div>
    );
  }

  return (
    shell(
      <div className="w-full space-y-10">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="pb-4 border-b border-border/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/95 to-muted-foreground bg-clip-text text-transparent">
              HOD & Dean Details
            </h1>
            <p className="text-xs text-muted-foreground">
              View administrative contacts including Head of Departments and School Deans
            </p>
          </div>
        </header>

        {/* ── Details List ───────────────────────────────────────────────────── */}
        <div className="divide-y divide-border/10">
          {details.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Building className="w-10 h-10 text-muted-foreground/20" />
              <div>
                <p className="text-sm font-bold text-foreground">No HOD or Dean details found</p>
                <p className="text-xs text-muted-foreground mt-1">Ensure you are logged in or try reloading the page.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 transition-all cursor-pointer"
                >
                  Reload Page
                </button>
              </div>
            </div>
          ) : (
            details.map((item, idx) => (
              <section key={idx} className="py-6 sm:py-8 w-full first:pt-0 last:pb-0">
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start w-full">
                  {/* Photo */}
                  {renderPhoto(item.photo, item.name)}
                  
                  {/* Details block */}
                  <div className="flex-1 w-full space-y-4 text-center sm:text-left min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                      <span className="text-xs font-black text-primary uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 w-fit self-center sm:self-auto leading-none">
                        {item.role || "Faculty"}
                      </span>
                      <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-black tracking-tight text-foreground truncate">{item.name}</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1 w-full">
                      {renderDetailField(<Building className="w-3.5 h-3.5" />, "Designation", item.school)}
                      {renderDetailField(<MapPin className="w-3.5 h-3.5" />, "Cabin Room", item.cabin)}
                      {item.intercom && renderDetailField(<Phone className="w-3.5 h-3.5" />, "Intercom", item.intercom)}
                      {renderDetailField(<Mail className="w-3.5 h-3.5" />, "Email Address", item.email, "lg:col-span-2")}
                    </div>
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    )
  );
}
