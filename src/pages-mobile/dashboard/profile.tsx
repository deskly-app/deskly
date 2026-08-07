import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { getStudentProfile, ProfileData } from "@/lib/features";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import profileImg from "@/assets/profile.png";
import {
  User,
  Mail,
  Phone,
  Home,
  Shield,
  MapPin,
  Calendar,
  Layers,
  Pencil,
  GraduationCap,
  Users,
} from "lucide-react";

function getSrcFromPhoto(photo: string): string {
  if (!photo) return "";
  const trimmed = photo.trim();
  if (trimmed.startsWith("data:")) {
    if (trimmed.startsWith("data:jpg;base64,"))
      return trimmed.replace("data:jpg;base64,", "data:image/jpeg;base64,");
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) return `data:image/jpeg;base64,${trimmed}`;
  return trimmed;
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/65 ${className}`} />;
}

function ProfileSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 px-2 py-4">
      <Sk className="h-5 w-16" />
      <Sk className="h-7 w-32" />
      <Sk className="h-32 w-full rounded-xl" />
      <Sk className="h-60 w-full rounded-xl" />
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

export default function StudentProfilePage() {
  const { loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const { data: profile, loading, error, retry: fetchProfile } = useOfflineData<ProfileData>({
    cacheKey: "deskly::cache::profile",
    fetcher: getStudentProfile,
    enabled: isOnline,
    isEmpty: (val) => !val || !val.student || !val.student.name,
  });

  const shell = (children: React.ReactNode) => <>{children}</>;
  const showOffline = !profile && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline && !loading) return shell(<OfflineDisplay onRetry={fetchProfile} />);
  if (authLoading || (loading && !profile)) return shell(<ProfileSkeleton />);
  if (error && !profile) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={fetchProfile} />
      </div>
    );
  }
  if (!profile) return null;

  const { student, proctor, hostel } = profile;
  const photoSrc = student.photoUrl ? getSrcFromPhoto(student.photoUrl) : "";
  const initials = student.name
    ? student.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return shell(
    <div className="w-full flex flex-col gap-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button
            onClick={fetchProfile}
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
            My Profile
          </h1>
          <p className="text-xs text-muted-foreground/60 leading-normal">
            View and manage your academic information
          </p>
        </div>
      </header>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[180px] h-[140px] pointer-events-none select-none z-0">
        <img
          src={profileImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          alt="Profile Illustration"
        />
      </div>

      {/* Hero Card */}
      <div className="relative z-10 p-5 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md flex items-center gap-5">
        {photoSrc ? (
          <div className="w-20 h-24 shrink-0 overflow-hidden rounded-xl border border-border/30 bg-muted/20 flex items-center justify-center p-0.5 relative">
            <img src={photoSrc} alt={student.name} className="w-full h-full object-cover rounded-lg" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-muted-foreground/50 border border-border/40 flex items-center justify-center shadow-sm">
              <Pencil className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
        ) : (
          <div className="w-20 h-24 rounded-xl shrink-0 bg-muted/30 border border-border/20 flex items-center justify-center relative">
            <span className="text-2xl font-extrabold text-muted-foreground/60">{initials}</span>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-muted-foreground/50 border border-border/40 flex items-center justify-center shadow-sm">
              <Pencil className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
        )}
        <div className="min-w-0 space-y-1.5 flex-1">
          <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">
            {student.registerNumber} {student.gender && `• ${student.gender}`}
          </p>
          <h2 className="text-xl font-black text-foreground leading-tight tracking-wide uppercase">
            {student.name}
          </h2>
          <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">
            {student.program}
          </p>
        </div>
      </div>

      {/* Student Info Card */}
      <div className="relative z-10 p-5 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-border/10 pb-2">
          <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
            Student Information
          </span>
          <div className="w-7 h-7 rounded-full bg-muted/30 border border-border/25 flex items-center justify-center text-muted-foreground/60">
            <GraduationCap className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex flex-col">
          <ProfileRow icon={User} label="Registration No." value={student.registerNumber} />
          <ProfileRow icon={User} label="Application No." value={student.applicationNumber} />
          <ProfileRow icon={Layers} label="Program" value={student.program} />
          <ProfileRow icon={Calendar} label="Date of Birth" value={student.dob} />
          <ProfileRow icon={Phone} label="Mobile" value={student.mobile} />
          <ProfileRow icon={Mail} label="VIT Email" value={student.vitEmail} />
          <ProfileRow icon={Mail} label="Personal Email" value={student.personalEmail} />
        </div>
      </div>

      {/* Proctor Card */}
      {proctor && (
        <div className="relative z-10 p-5 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between border-b border-border/10 pb-2">
            <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
              Proctor
            </span>
            <div className="w-7 h-7 rounded-full bg-muted/30 border border-border/25 flex items-center justify-center text-muted-foreground/60">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-center gap-4 pb-3 border-b border-border/10">
            {proctor.photoUrl ? (
              <div className="w-14 h-16 shrink-0 overflow-hidden rounded-xl border border-border/30 bg-muted/20 p-0.5">
                <img
                  src={getSrcFromPhoto(proctor.photoUrl)}
                  alt={proctor.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            ) : (
              <div className="w-14 h-16 rounded-xl shrink-0 bg-muted/30 border border-border/20 flex items-center justify-center">
                <span className="text-base font-bold text-muted-foreground/60">
                  {proctor.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "?"}
                </span>
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-base font-bold text-foreground leading-snug uppercase">
                {proctor.name}
              </p>
              <p className="text-xs text-muted-foreground/60 leading-none">
                {proctor.designation}
              </p>
              <p className="text-xs text-muted-foreground/40 leading-none">{proctor.school}</p>
            </div>
          </div>

          <div className="flex flex-col">
            <ProfileRow icon={User} label="Faculty ID" value={proctor.facultyId} />
            <ProfileRow icon={MapPin} label="Cabin" value={proctor.cabin} />
            <ProfileRow icon={Phone} label="Mobile" value={proctor.mobile} />
            <ProfileRow icon={Mail} label="Email" value={proctor.email} />
          </div>
        </div>
      )}

      {/* Hostel Card */}
      {hostel && (
        <div className="relative z-10 p-5 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between border-b border-border/10 pb-2">
            <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
              Hostel
            </span>
            <div className="w-7 h-7 rounded-full bg-muted/30 border border-border/25 flex items-center justify-center text-muted-foreground/60">
              <Home className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex flex-col">
            <ProfileRow icon={Home} label="Block" value={hostel.blockName} />
            <ProfileRow icon={MapPin} label="Room" value={hostel.roomNumber} />
            <ProfileRow icon={Layers} label="Bed Type" value={hostel.bedType} />
            <ProfileRow icon={Shield} label="Mess Type" value={hostel.messType} />
          </div>
        </div>
      )}
    </div>
  );
}
