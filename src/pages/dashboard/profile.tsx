import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getStudentProfile, ProfileData } from "@/lib/features";

import { ErrorDisplay } from "@/components/error-display";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Home,
  Shield,
  MapPin,
  Calendar,
  Layers
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

function renderPhoto(photoUrl: string, name: string, maxWClass = "max-w-[12rem]", maxHClass = "max-h-[16rem]") {
  const src = photoUrl ? getSrcFromPhoto(photoUrl) : "";
  if (src) {
    return (
      <div className={`relative ${maxWClass} shrink-0 overflow-hidden rounded-xl border border-border/20 bg-muted/10 flex items-center justify-center p-1`}>
        <img
          src={src}
          alt={name}
          className={`w-full h-auto ${maxHClass} object-contain rounded-lg`}
        />
      </div>
    );
  }
  
  // Fallback if no photo is available:
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="w-40 h-48 rounded-xl shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center text-primary border border-border/20">
      <span className="text-xl font-bold tracking-wider">{initials}</span>
    </div>
  );
}

function renderDetailField(icon: React.ReactNode, label: string, value: string | null | undefined, className = "") {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 border-b border-border/10 group hover:border-primary/25 transition-colors min-w-0 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-muted-foreground/70 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
          {icon}
        </div>
        <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs sm:text-sm font-extrabold text-foreground/90 break-words text-right pl-4">{value || "N/A"}</span>
    </div>
  );
}

// ─── Loader Skeleton Layout ───────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted/65 ${className}`} />;
}

function ProfileSkeleton() {
  return (
    <div className="w-full space-y-12 animate-pulse">
      {/* Header skeleton */}
      <div className="pb-4 border-b border-border/20 flex items-center gap-4">
        <Sk className="w-8 h-8 rounded-full" />
        <div className="space-y-2">
          <Sk className="h-6 w-36 rounded-full" />
          <Sk className="h-3 w-56 rounded-full" />
        </div>
      </div>

      {/* Student Section skeleton */}
      <div className="space-y-6">
        <Sk className="h-5 w-36 rounded-full" />
        <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 items-start w-full">
          <Sk className="w-52 h-72 rounded-xl shrink-0" />
          <div className="flex-1 w-full space-y-6">
            <div className="border-b border-border/10 pb-4 space-y-2">
              <Sk className="h-2.5 w-16 rounded-full" />
              <Sk className="h-8 w-64 rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 w-full">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/10">
                  <div className="flex items-center gap-3">
                    <Sk className="w-8 h-8 rounded-full shrink-0" />
                    <Sk className="h-3 w-20 rounded-full" />
                  </div>
                  <Sk className="h-4 w-32 rounded-full" />
                </div>
              ))}
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/10 md:col-span-2">
                  <div className="flex items-center gap-3">
                    <Sk className="w-8 h-8 rounded-full shrink-0" />
                    <Sk className="h-3 w-24 rounded-full" />
                  </div>
                  <Sk className="h-4 w-48 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Proctor Section skeleton */}
      <div className="space-y-6 pt-4 border-t border-border/10">
        <Sk className="h-5 w-36 rounded-full" />
        <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 items-start w-full">
          <Sk className="w-44 h-60 rounded-xl shrink-0" />
          <div className="flex-1 w-full space-y-6">
            <div className="border-b border-border/10 pb-4 space-y-2">
              <Sk className="h-2.5 w-16 rounded-full" />
              <Sk className="h-7 w-48 rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 w-full">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/10">
                  <div className="flex items-center gap-3">
                    <Sk className="w-8 h-8 rounded-full shrink-0" />
                    <Sk className="h-3 w-20 rounded-full" />
                  </div>
                  <Sk className="h-4 w-32 rounded-full" />
                </div>
              ))}
              <div className="flex items-center justify-between py-3 border-b border-border/10 md:col-span-2">
                <div className="flex items-center gap-3">
                  <Sk className="w-8 h-8 rounded-full shrink-0" />
                  <Sk className="h-3 w-24 rounded-full" />
                </div>
                <Sk className="h-4 w-48 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Residence Section skeleton */}
      <div className="space-y-6 pt-4 border-t border-border/10">
        <Sk className="h-5 w-36 rounded-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 w-full">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border/10">
              <div className="flex items-center gap-3">
                <Sk className="w-8 h-8 rounded-full shrink-0" />
                <Sk className="h-3 w-24 rounded-full" />
              </div>
              <Sk className="h-4 w-36 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const { loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from cache first
  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::profile");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.student && parsed.student.name) {
          setProfile(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached profile", e);
      }
    }
  }, []);

  async function fetchProfile() {
    setLoading(profile ? false : true);
    try {
      const res = await getStudentProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        localStorage.setItem("deskly::cache::profile", JSON.stringify(res.data));
      } else {
        setError(res.error ?? "Failed to fetch student profile details.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (authLoading || loading) {
    return shell(<ProfileSkeleton />);
  }

  if (error || !profile) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error ?? "No profile data loaded."} onRetry={fetchProfile} />
      </div>
    );
  }

  const { student, proctor, hostel } = profile;

  return shell(
    <div className="w-full space-y-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.history.back()}
              className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/95 to-muted-foreground bg-clip-text text-transparent">
              My Profile
            </h1>
          </div>
          <p className="text-xs text-muted-foreground pl-7">
            Manage and view your academic, proctor, and hostel details
          </p>
        </div>
      </header>

      {/* ── Section 1: Student Personal & Academic Details ───────────────── */}
      <section className="space-y-6">
        <h3 className="text-sm font-black text-foreground uppercase tracking-wider border-b border-border/10 pb-2">
          Student Information
        </h3>
        <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 items-start w-full">
          {/* Photo */}
          {renderPhoto(student.photoUrl, student.name, "w-52 max-w-full shrink-0", "max-h-[20rem]")}
          
          {/* Details block */}
          <div className="flex-1 w-full space-y-6">
            <div className="border-b border-border/10 pb-4">
              <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Full Name</p>
              <h2 className="text-2xl font-black tracking-tight text-foreground">{student.name}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 w-full">
              {renderDetailField(<User className="w-4 h-4" />, "Register No.", student.registerNumber)}
              {renderDetailField(<User className="w-4 h-4" />, "Application No.", student.applicationNumber)}
              {renderDetailField(<Layers className="w-4 h-4" />, "Program / Branch", student.program)}
              {renderDetailField(<Calendar className="w-4 h-4" />, "Date of Birth", student.dob)}
              {renderDetailField(<User className="w-4 h-4" />, "Gender", student.gender)}
              {renderDetailField(<Phone className="w-4 h-4" />, "Mobile Number", student.mobile)}
              {renderDetailField(<Mail className="w-4 h-4" />, "VIT Email ID", student.vitEmail, "md:col-span-2")}
              {renderDetailField(<Mail className="w-4 h-4" />, "Personal Email ID", student.personalEmail, "md:col-span-2")}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Proctor Details ───────────────────────────────────── */}
      {proctor && (
        <section className="space-y-6 pt-4 border-t border-border/10">
          <h3 className="text-sm font-black text-foreground uppercase tracking-wider border-b border-border/10 pb-2">
            Proctor Details
          </h3>
          <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 items-start w-full">
            {/* Photo */}
            {renderPhoto(proctor.photoUrl, proctor.name, "w-44 max-w-full shrink-0", "max-h-[16rem]")}
            
            {/* Details block */}
            <div className="flex-1 w-full space-y-6">
              <div className="border-b border-border/10 pb-4">
                <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Proctor Name</p>
                <h2 className="text-xl font-black tracking-tight text-foreground">{proctor.name}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 w-full">
                {renderDetailField(<User className="w-4 h-4" />, "Faculty ID", proctor.facultyId)}
                {renderDetailField(<User className="w-4 h-4" />, "Designation", proctor.designation)}
                {renderDetailField(<Layers className="w-4 h-4" />, "School", proctor.school)}
                {renderDetailField(<MapPin className="w-4 h-4" />, "Cabin Room", proctor.cabin)}
                {renderDetailField(<Phone className="w-4 h-4" />, "Mobile", proctor.mobile)}
                {renderDetailField(<Mail className="w-4 h-4" />, "Email Address", proctor.email, "md:col-span-2")}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Section 3: Hostel / Residence Details ─────────────────────────── */}
      {hostel && (
        <section className="space-y-6 pt-4 border-t border-border/10">
          <h3 className="text-sm font-black text-foreground uppercase tracking-wider border-b border-border/10 pb-2">
            Hostel Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 w-full">
            {renderDetailField(<Home className="w-4 h-4" />, "Block Name", hostel.blockName)}
            {renderDetailField(<MapPin className="w-4 h-4" />, "Room Number", hostel.roomNumber)}
            {renderDetailField(<Layers className="w-4 h-4" />, "Bed Type", hostel.bedType)}
            {renderDetailField(<Shield className="w-4 h-4" />, "Mess Choice", hostel.messType)}
          </div>
        </section>
      )}
    </div>
  );
}
