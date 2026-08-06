import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getContactInfo, ContactDetail } from "@/lib/features";
import { openUrl } from "@tauri-apps/plugin-opener";

import { ErrorDisplay } from "@/components/error-display";
import { Copy, Check, Phone, Search, Building2, X } from "lucide-react";

// ─── Gmail SVG Icon ───────────────────────────────────────────────────────────

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <title>Gmail</title>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-1.29 1.454-2.032 2.509-1.2L12 11.23l9.491-6.973c1.055-.831 2.509-.09 2.509 1.2z" />
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/60 ${className}`} />;
}

function ContactSkeleton() {
  return (
    <div className="divide-y divide-border/5 animate-pulse">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="py-4 px-3 -mx-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Department Name & Description skeleton */}
          <div className="flex-1 space-y-2 pr-4">
            <Sk className="h-4 w-1/3 rounded" />
            <Sk className="h-3.5 w-3/5 rounded" />
          </div>
          
          {/* Right: Email and Buttons skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-4 md:gap-6 shrink-0">
            {/* Email skeleton */}
            <Sk className="h-4 w-40 sm:w-48 md:w-56 rounded" />
            
            {/* Buttons skeleton */}
            <div className="flex items-center gap-2 md:w-20 justify-end">
              <Sk className="h-8 w-8 rounded-md" />
              <Sk className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Contact Row ─────────────────────────────────────────────────────────────

function ContactRow({ contact }: { contact: ContactDetail }) {
  const [copied, setCopied] = useState(false);
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="group py-4 px-3 -mx-3 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors duration-150">
      {/* Left section: Name + Description */}
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
          {contact.department}
        </h3>
        {contact.description && (
          <p className="text-xs sm:text-sm text-muted-foreground/80 mt-1 font-normal leading-relaxed max-w-2xl">
            {contact.description}
          </p>
        )}
      </div>

      {/* Right section: Email and Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-4 md:gap-6 shrink-0">
        {/* Email Address */}
        <span className="text-xs sm:text-sm font-mono text-muted-foreground selection:bg-primary/20 md:w-56 truncate">
          {contact.email}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:w-20 justify-end">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy email address"
            className="p-2 rounded-md border border-border/10 text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:border-border/30 transition-all duration-150 flex items-center justify-center cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Browser Gmail compose link */}
          <button
            onClick={async () => {
              try {
                await openUrl(gmailUrl);
              } catch (err) {
                console.error("Failed to open Gmail link:", err);
              }
            }}
            title="Compose in browser Gmail"
            className="p-2 rounded-md border border-border/10 text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:border-border/30 transition-all duration-150 flex items-center justify-center cursor-pointer bg-transparent"
          >
            <GmailIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContactPage() {
  const { loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<ContactDetail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Load from Cache first
  useEffect(() => {
    const cached = localStorage.getItem("deskly::cache::contact");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setContacts(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse cached contacts", e);
      }
    }
  }, []);

  const fetchContacts = async () => {
    setLoading(contacts && contacts.length > 0 ? false : true);
    setError(null);
    try {
      const res = await getContactInfo();
      if (res.success && res.data) {
        setContacts(res.data);
        localStorage.setItem("deskly::cache::contact", JSON.stringify(res.data));
      } else {
        setError(res.error ?? "Failed to load contact information.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.department.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const shell = (children: React.ReactNode) => (
    <>{children}</>
  );

  if (error && !contacts) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay title="Contacts Unavailable" message={error} onRetry={fetchContacts} />
      </div>
    );
  }

  const isLoading = authLoading || loading;

  return shell(
    <div className="w-full space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="pb-4 border-b border-border/20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary shrink-0" />
            Contacts
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            University department contacts and email directory
          </p>
        </div>
        {!isLoading && contacts && (
          <span className="text-xs text-muted-foreground/50 font-bold pb-0.5">
            {filtered.length} of {contacts.length} departments
          </span>
        )}
      </header>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          placeholder="Search department, email…"
          className="w-full h-10 pl-10 pr-10 rounded-md border border-border/20 bg-muted/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <ContactSkeleton />
      ) : (
        <>
          {/* ── Directory ───────────────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm font-bold text-foreground">No contacts found</p>
              <p className="text-xs text-muted-foreground">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Directory Header on desktop */}
              <div className="hidden md:flex items-center justify-between px-3 pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/10">
                <div>Department</div>
                <div className="flex items-center gap-6">
                  <span className="w-56 text-left">Email Address</span>
                  <span className="w-20 text-right">Actions</span>
                </div>
              </div>
              
              {/* List rows */}
              <div className="divide-y divide-border/5">
                {filtered.map((contact) => (
                  <ContactRow key={contact.department} contact={contact} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
