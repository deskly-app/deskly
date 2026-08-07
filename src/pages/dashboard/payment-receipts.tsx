import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getPaymentReceipts, Receipt } from "@/lib/features";
import { ErrorDisplay } from "@/components/error-display";
import { isNetworkError, fetchWithTimeout } from "@/lib/utils";
import {
  FileText,
  CreditCard,
  User,
  Receipt as ReceiptIcon,
  Hash,
  MapPin,
  Building,
  Calendar,
  WifiOff,
} from "lucide-react";

// ─── Currency Formatter ───────────────────────────────────────────────────────
function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Date Parser ──────────────────────────────────────────────────────────────
function parseReceiptDate(dateStr: string): Date {
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return new Date();
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toUpperCase();
  const year = parseInt(parts[2], 10);
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  return new Date(year, months[monthStr] ?? 0, day);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/65 ${className}`} />;
}

function PaymentSkeleton() {
  return (
    <div className="w-full lg:h-[calc(100vh-5rem)] lg:flex lg:flex-col lg:overflow-hidden space-y-6">
      <div className="flex justify-between pb-6 border-b border-border/40 shrink-0">
        <div className="space-y-2">
          <Sk className="h-7 w-48" />
          <Sk className="h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 min-h-[104px]">
            <div className="flex items-center justify-between w-full">
              <Sk className="h-3 w-20" />
              <Sk className="h-4 w-4 rounded-md" />
            </div>
            <Sk className="h-7 w-24 mt-3" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pb-4 border-b border-border/20 shrink-0 pt-4">
        <div className="space-y-2">
          <Sk className="h-5 w-44" />
          <Sk className="h-3 w-56" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-2">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border/30 text-xs font-black uppercase tracking-wider text-muted-foreground">
              <th className="py-4 px-3 w-12">#</th>
              <th className="py-4 px-3 w-40">Receipt No.</th>
              <th className="py-4 px-3">Date</th>
              <th className="py-4 px-3">Campus</th>
              <th className="py-4 px-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {[...Array(6)].map((_, i) => (
              <tr key={i} className="animate-pulse border-b border-border/10">
                <td className="py-4 px-3"><Sk className="h-4 w-6" /></td>
                <td className="py-4 px-3"><Sk className="h-4 w-32" /></td>
                <td className="py-4 px-3"><Sk className="h-4 w-24" /></td>
                <td className="py-4 px-3"><Sk className="h-4 w-16" /></td>
                <td className="py-4 px-3 text-right"><Sk className="h-4 w-20 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Expanded Row Detail Panel ────────────────────────────────────────────────
function ReceiptDetailPanel({ item, onClose }: { item: Receipt; onClose: () => void }) {
  const details = [
    { icon: Hash,     label: "Receipt ID",      value: item.receiptId || "—" },
    { icon: FileText, label: "Receipt Number",  value: item.receiptNumber },
    { icon: Calendar, label: "Payment Date",    value: item.date },
    { icon: MapPin,   label: "Campus Code",     value: item.campusCode },
    { icon: Building, label: "Application No.", value: item.applNo || "—" },
    { icon: User,     label: "Registration ID", value: item.regNo || "—" },
  ];

  return (
    <div className="bg-muted/20 border-b border-border/20 px-6 py-5">
      <div className="flex items-start justify-between gap-6 max-w-4xl">
        {/* Amount */}
        <div className="space-y-1 shrink-0">
          <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">Amount Paid</p>
          <p className="text-2xl font-black text-foreground tabular-nums">{formatINR(item.amount)}</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 flex-1 min-w-0">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 min-w-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground/50 uppercase tracking-wide leading-none">{label}</p>
                <p className="text-xs font-semibold text-foreground mt-1 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider shrink-0 border-0 bg-transparent cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PaymentReceiptsPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    try {
      const cached = localStorage.getItem("deskly::cache::payment_receipts");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(receipts.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  async function load() {
    try {
      const hasCache = receipts.length > 0;
      setLoading(!hasCache);
      const res = await fetchWithTimeout(getPaymentReceipts(), 15000);
      if (res.success && res.data) {
        const cleanList = res.data.filter(
          (r) => r.receiptNumber.trim().toUpperCase() !== "RECEIPT NUMBER"
        );
        setReceipts(cleanList);
        localStorage.setItem("deskly::cache::payment_receipts", JSON.stringify(cleanList));
      } else {
        if (!hasCache) setError(res.error ?? "Failed to fetch payment receipts.");
      }
    } catch (err) {
      if (receipts.length === 0)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, authLoading]);

  const stats = useMemo(() => {
    if (receipts.length === 0) return { totalPaid: 0, count: 0, latestDate: "N/A" };
    const totalPaid = receipts.reduce((sum, r) => sum + r.amount, 0);
    const latest = receipts.reduce((a, b) =>
      parseReceiptDate(a.date) > parseReceiptDate(b.date) ? a : b
    );
    return { totalPaid, count: receipts.length, latestDate: latest.date };
  }, [receipts]);

  const studentMeta = useMemo(() => {
    if (receipts.length === 0) return null;
    return {
      regNo: receipts[0].regNo || "N/A",
      applNo: receipts[0].applNo || "N/A",
      campusCode: receipts[0].campusCode || "N/A",
    };
  }, [receipts]);

  const isOffline = receipts.length === 0 && isNetworkError(error, true);

  const shell = (children: React.ReactNode) => <>{children}</>;

  if (authLoading || (loading && receipts.length === 0)) return shell(<PaymentSkeleton />);

  if (error && receipts.length === 0) {
    return shell(
      <div className="flex h-full items-center justify-center">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full lg:h-[calc(100vh-5rem)] lg:flex lg:flex-col lg:overflow-hidden space-y-6">

      {/* Sync error banner */}
      {error && !isOffline && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md gap-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span className="truncate">Sync failed: {error} (Viewing cached data)</span>
          </div>
          <button onClick={load} className="text-xs uppercase font-bold tracking-wider hover:underline focus:outline-none shrink-0 border-0 bg-transparent cursor-pointer text-destructive">
            Retry
          </button>
        </div>
      )}

      {/* Offline banner */}
      {isOffline && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-md shrink-0">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="font-semibold">You're offline — showing cached data</span>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/20 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary shrink-0" />
            Payment Receipts
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Your complete payment history and receipts</p>
        </div>
      </header>

      {/* ── Stats Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">

        {/* Total Receipts */}
        <div className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-primary/10 transition-colors duration-200 min-h-[104px]">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Total Receipts</span>
            <ReceiptIcon className="w-5 h-5 text-primary shrink-0" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground leading-none">{stats.count}</span>
            <span className="text-xs font-bold text-muted-foreground/60 leading-none">Payments</span>
          </div>
        </div>

        {/* Total Amount Paid */}
        <div className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-primary/10 transition-colors duration-200 min-h-[104px]">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Total Paid</span>
            <CreditCard className="w-5 h-5 text-primary shrink-0" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground leading-none tabular-nums">{formatINR(stats.totalPaid)}</span>
            <span className="text-xs font-bold text-muted-foreground/60 leading-none">Cumulative</span>
          </div>
        </div>

        {/* Registration Info */}
        <div className="flex flex-col justify-between bg-card/40 border border-border/30 rounded-lg p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-primary/10 transition-colors duration-200 min-h-[104px]">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Registration</span>
            <User className="w-5 h-5 text-primary shrink-0" />
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="text-sm font-black text-foreground leading-none truncate">{studentMeta?.regNo ?? "—"}</span>
            <span className="text-xs font-bold text-muted-foreground/60 leading-none shrink-0">{studentMeta?.campusCode ?? ""}</span>
          </div>
        </div>

      </div>

      {/* ── Section Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-2 border-b border-border/20 shrink-0 pt-2">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">Receipt Records</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Click a row to view full receipt details</p>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-2">
        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-bold text-foreground">No receipts found</p>
              <p className="text-xs text-muted-foreground mt-1">No payment records are available.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar -mx-6 px-6 md:mx-0 md:px-0">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border/30 text-xs font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-4 px-3 w-12">#</th>
                  <th className="py-4 px-3 w-44">Receipt No.</th>
                  <th className="py-4 px-3">Date</th>
                  <th className="py-4 px-3 w-28">Campus</th>
                  <th className="py-4 px-3 w-32 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-sm font-semibold text-muted-foreground/90">
                {receipts.map((receipt, idx) => {
                  const isExpanded = expandedRow === receipt.receiptNumber;
                  return (
                    <>
                      <tr
                        key={receipt.receiptNumber}
                        onClick={() => setExpandedRow(isExpanded ? null : receipt.receiptNumber)}
                        className={`hover:bg-muted/15 transition-colors duration-150 border-b border-border/10 cursor-pointer ${isExpanded ? "bg-muted/10" : ""}`}
                      >
                        <td className="py-4 px-3 font-bold text-foreground/80">{idx + 1}</td>
                        <td className="py-4 px-3 font-extrabold tracking-wider text-primary">
                          #{receipt.receiptNumber}
                        </td>
                        <td className="py-4 px-3 font-bold text-foreground">{receipt.date}</td>
                        <td className="py-4 px-3 font-bold">{receipt.campusCode}</td>
                        <td className="py-4 px-3 font-black text-foreground text-right tabular-nums">
                          {formatINR(receipt.amount)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${receipt.receiptNumber}-detail`}>
                          <td colSpan={5} className="p-0">
                            <ReceiptDetailPanel
                              item={receipt}
                              onClose={() => setExpandedRow(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
