import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getContactInfo, ContactDetail } from "@/lib/features";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useOfflineData } from "@/hooks/use-offline-data";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(9)].map((_, i) => (
        <div key={i} className="p-5 border border-border/20 rounded-xl space-y-4 bg-card/20 animate-pulse">
          <div className="space-y-2">
            <Sk className="h-4 w-3/4 rounded" />
            <Sk className="h-3 w-5/6 rounded" />
            <Sk className="h-3 w-2/3 rounded" />
          </div>
          <div className="border-t border-border/10 pt-4 flex justify-between items-center">
            <Sk className="h-3.5 w-1/2 rounded" />
            <div className="flex gap-2">
              <Sk className="h-7 w-7 rounded" />
              <Sk className="h-7 w-7 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Contact Card Component ───────────────────────────────────────────────────

function ContactCard({ contact }: { contact: ContactDetail }) {
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
    <div className="p-5 bg-card/30 border border-border/20 hover:border-border/35 rounded-xl transition-all flex flex-col justify-between gap-4 h-full">
      <div className="space-y-2">
        <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-snug">
          {contact.department}
        </h3>
        {contact.description && (
          <p className="text-xs text-muted-foreground/80 font-medium leading-relaxed">
            {contact.description}
          </p>
        )}
      </div>

      <div className="space-y-3 pt-1">
        <div className="border-t border-border/10" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-muted-foreground/85 truncate select-all flex-1 pr-2" title={contact.email}>
            {contact.email}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              title="Copy email address"
              className="p-1.5 rounded-md border border-border/10 text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
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
              className="p-1.5 rounded-md border border-border/10 text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors cursor-pointer bg-transparent"
            >
              <GmailIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContactPage() {
  const { loading: authLoading } = useAuth();
  const {
    data: contacts,
    loading,
    error,
    retry: fetchContacts,
  } = useOfflineData<ContactDetail[]>({
    cacheKey: "deskly::cache::contact_info",
    fetcher: getContactInfo,
  });

  const [query, setQuery] = useState("");

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((contact) => (
                <ContactCard key={contact.department} contact={contact} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
