import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { getHodDeanDetails, HodDeanDetail } from "@/lib/features";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import profileImg from "@/assets/profile.png";
import { Mail, MapPin, Phone, Building, Users } from "lucide-react";

function getSrcFromPhoto(photo: string): string {
  if (!photo) return "";
  const trimmed = photo.trim();
  if (trimmed.startsWith("data:")) {
    if (trimmed.startsWith("data:jpg;base64,")) {
      return trimmed.replace("data:jpg;base64,", "data:image/jpeg;base64,");
    }
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return trimmed;
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/65 ${className}`} />;
}

function HodDeanSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 px-2 py-4 font-saira">
      <Sk className="h-5 w-16" />
      <Sk className="h-7 w-32" />
      <Sk className="h-32 w-full rounded-xl" />
      <Sk className="h-44 w-full rounded-xl" />
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/10 last:border-0">
      <div className="flex items-center gap-3 shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground/40 shrink-0" />
        <div className="w-px h-4 bg-border/25 shrink-0" />
        <span className="text-[9px] font-black text-muted-foreground/45 uppercase tracking-widest leading-none">
          {label}
        </span>
      </div>
      <span className="text-xs font-semibold text-foreground text-right truncate max-w-[55%]">
        {value}
      </span>
    </div>
  );
}

export default function HodDeanDetailsPage() {
  const { loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const { data: rawData, loading, error, retry: fetchDetails } = useOfflineData<HodDeanDetail[]>({
    cacheKey: "deskly::cache::hod_dean",
    fetcher: getHodDeanDetails,
  });
  const details = rawData || null;

  const shell = (children: React.ReactNode) => <>{children}</>;
  const showOffline = !rawData && !loading && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) return shell(<OfflineDisplay onRetry={fetchDetails} />);
  if (authLoading || (loading && !rawData)) return shell(<HodDeanSkeleton />);
  if (error && !rawData) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={fetchDetails} />
      </div>
    );
  }
  if (!details) return null;

  return shell(
    <div className="w-full flex flex-col gap-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button
            onClick={fetchDetails}
            className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 flex items-start justify-between gap-4 mt-2">
        <div className="space-y-1.5 min-w-0 pt-1">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight leading-tight">
            HOD & Dean
          </h1>
        </div>
      </header>

      {/* Illustration image absolute header matching Profile Page */}
      <div className="absolute -top-4 right-0 w-[180px] h-[140px] pointer-events-none select-none z-0">
        <img
          src={profileImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          alt="Profile Illustration"
        />
      </div>

      {details.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-16 gap-3 text-center bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md">
          <Building className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground">No details found</p>
          <p className="text-xs text-muted-foreground">Please try reloading later.</p>
        </div>
      ) : (
        <div className="relative z-10 space-y-5">
          {details.map((item, idx) => {
            const photoSrc = item.photo ? getSrcFromPhoto(item.photo) : "";
            const initials = item.name
              ? item.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              : "?";

            return (
              <div
                key={idx}
                className="relative z-10 p-5 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md space-y-4"
              >
                {/* Header section with role */}
                <div className="flex items-center justify-between border-b border-border/10 pb-2">
                  <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
                    {item.role || "Faculty Leadership"}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-muted/30 border border-border/25 flex items-center justify-center text-muted-foreground/60">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Photo + Name / School */}
                <div className="flex items-center gap-4 pb-3 border-b border-border/10">
                  {photoSrc ? (
                    <div className="w-14 h-16 shrink-0 overflow-hidden rounded-xl border border-border/30 bg-muted/20 p-0.5">
                      <img
                        src={photoSrc}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-16 rounded-xl shrink-0 bg-muted/30 border border-border/20 flex items-center justify-center">
                      <span className="text-base font-bold text-muted-foreground/60">
                        {initials}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-base font-bold text-foreground leading-snug uppercase">
                      {item.name}
                    </h2>
                    <p className="text-xs text-muted-foreground/60 leading-none">
                      {item.school}
                    </p>
                  </div>
                </div>

                {/* Profile rows matching Profile Page */}
                <div className="flex flex-col">
                  <ProfileRow icon={MapPin} label="Cabin" value={item.cabin} />
                  <ProfileRow icon={Phone} label="Intercom" value={item.intercom} />
                  <ProfileRow icon={Mail} label="Email" value={item.email} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
