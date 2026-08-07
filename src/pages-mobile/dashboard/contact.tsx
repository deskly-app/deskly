import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getContactInfo, ContactDetail } from "@/lib/features";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { Copy, Check, Phone, Search, X, Mail } from "lucide-react";
import contactImg from "@/assets/contact.png";

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor">
      <title>Gmail</title>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-1.29 1.454-2.032 2.509-1.2L12 11.23l9.491-6.973c1.055-.831 2.509-.09 2.509 1.2z" />
    </svg>
  );
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/65 ${className}`} />;
}

function ContactSkeleton() {
  return (
    <div className="w-full flex flex-col gap-5 px-2 py-4 font-saira">
      <div className="space-y-1">
        <Sk className="h-7 w-32" />
      </div>
      <Sk className="h-10 w-full rounded-md" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Sk key={i} className="h-[76px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

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

  const handleOpenGmail = async () => {
    try {
      await openUrl(gmailUrl);
    } catch (err) {
      console.error("Failed to open Gmail link:", err);
    }
  };

  return (
    <div className="p-4 bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md flex items-center justify-between gap-4">
      {/* Icon + Info */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-bold text-foreground leading-snug truncate">{contact.department}</p>
          {contact.description && (
            <p className="text-xs text-muted-foreground/60 leading-none truncate">{contact.description}</p>
          )}
          <p className="text-xs text-muted-foreground/50 font-mono leading-none truncate pt-0.5">{contact.email}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleCopy}
          title="Copy email address"
          className={`p-2 rounded-md border transition-all cursor-pointer flex items-center justify-center bg-transparent
            ${copied
              ? "bg-primary/10 border-primary/20 text-primary"
              : "bg-muted/10 border-border/20 text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
        >
          {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
        </button>

        <button
          onClick={handleOpenGmail}
          title="Compose Email"
          className="p-2 rounded-md border border-border/20 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center justify-center cursor-pointer"
        >
          <GmailIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const { loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const { data: rawData, loading, error, retry: fetchContacts } = useOfflineData<ContactDetail[]>({
    cacheKey: "deskly::cache::contact",
    fetcher: getContactInfo,
  });
  const contacts = rawData || null;

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

  const shell = (children: React.ReactNode) => <>{children}</>;
  const showOffline = !rawData && !loading && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) return shell(<OfflineDisplay onRetry={fetchContacts} />);
  if (authLoading || (loading && !rawData)) return shell(<ContactSkeleton />);
  if (error && !rawData) {
    return shell(
      <div className="flex h-full items-center justify-center font-saira">
        <ErrorDisplay title="Contacts Unavailable" message={error} onRetry={fetchContacts} />
      </div>
    );
  }

  return shell(
    <div className="w-full flex flex-col gap-5 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[200px] h-[160px] pointer-events-none select-none z-0">
        <img
          src={contactImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          style={{
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)"
          }}
          alt="Contact Illustration"
        />
      </div>

      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button onClick={fetchContacts} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">Retry</button>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-2">
        <Phone className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none">Contacts</h1>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search department or email..."
          className="w-full h-10 pl-9 pr-9 bg-muted/20 border-border/10 rounded-md text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground cursor-pointer border-0 bg-transparent"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Contact Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center bg-card/80 border border-border/40 rounded-xl shadow-sm backdrop-blur-md">
          <Phone className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-foreground leading-none">No contacts found</p>
          <p className="text-xs text-muted-foreground">Try a different search term.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((contact) => (
            <ContactCard key={contact.department} contact={contact} />
          ))}
        </div>
      )}
    </div>
  );
}
