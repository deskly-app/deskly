import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getPaymentReceipts, Receipt } from "@/lib/features";
import { ErrorDisplay } from "@/components/error-display";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineDisplay } from "@/components/offline-display";
import { isNetworkError } from "@/lib/utils";
import { useOfflineData } from "@/hooks/use-offline-data";
import paymentImg from "@/assets/payment.png";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  CreditCard,
  User,
  Receipt as ReceiptIcon,
  X,
  ChevronRight,
  Calendar,
  Hash,
  MapPin,
  Building,
} from "lucide-react";

// ─── Currency Formatter Helper ────────────────────────────────────────────────

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

// ─── Date Parser Helper ───────────────────────────────────────────────────────

function parseReceiptDate(dateStr: string): Date {
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return new Date();
  
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toUpperCase();
  const year = parseInt(parts[2], 10);

  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
  };
  
  const month = months[monthStr] ?? 0;
  return new Date(year, month, day);
}

// ─── Loader Skeleton Layout ───────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/65 ${className}`} />;
}

function PaymentReceiptsSkeleton() {
  return (
    <div className="w-full space-y-6 px-2 py-4 animate-pulse font-saira">
      <div className="space-y-1">
        <Sk className="h-7 w-44" />
      </div>
      <Sk className="h-20 w-full rounded-xl" />
      <Sk className="h-24 w-full rounded-xl" />
      <div className="space-y-3 pt-2">
        <Sk className="h-5 w-36" />
        {[...Array(4)].map((_, i) => (
          <Sk key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Receipt Drawer Component ──────────────────────────────────────────────────

function ReceiptDrawer({
  item,
  open,
  onOpenChange,
}: {
  item: Receipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;

  const details = [
    { icon: Hash,        label: "Receipt ID",       value: item.receiptId || "—" },
    { icon: FileText,    label: "Receipt Number",   value: item.receiptNumber },
    { icon: Calendar,    label: "Payment Date",     value: item.date },
    { icon: MapPin,      label: "Campus Code",      value: item.campusCode },
    { icon: Building,    label: "Application No.",  value: item.applNo || "—" },
    { icon: User,        label: "Registration ID",  value: item.regNo || "—" },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-8 font-saira max-h-[92vh]">
        <div className="overflow-y-auto no-scrollbar px-6 space-y-6 pt-6">
          
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <span className="text-xs font-bold text-primary uppercase tracking-widest leading-none block">
                  Receipt Details
                </span>
                <h2 className="text-xl font-bold text-foreground leading-snug tracking-tight truncate">
                  Receipt #{item.receiptNumber}
                </h2>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground active:opacity-75 transition-all border-none cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Separator className="bg-border/15" />

          {/* Amount Paid block */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
              Amount Paid
            </p>
            <p className="text-3xl font-black text-foreground leading-none tabular-nums">
              {formatINR(item.amount)}
            </p>
          </div>

          {/* Detailed Specifications */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">
              Receipt Info
            </p>

            <div className="divide-y divide-border/15 border-t border-b border-border/15">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3 shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide leading-none">{label}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground text-right truncate max-w-[60%]">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentReceiptsPage() {
  const { loading: authLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const { data: rawData, loading, error, retry: load } = useOfflineData<Receipt[]>({
    cacheKey: "deskly::cache::payment_receipts",
    fetcher: getPaymentReceipts,
    transform: (data) => data.filter((r) => r.receiptNumber.trim().toUpperCase() !== "RECEIPT NUMBER"),
  });
  const receipts = rawData || [];

  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const filteredReceipts = useMemo(() => receipts, [receipts]);

  const stats = useMemo(() => {
    if (filteredReceipts.length === 0) {
      return { totalPaid: 0, count: 0, latestDate: "N/A" };
    }

    const count = filteredReceipts.length;
    const totalPaid = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
    
    const latestReceipt = filteredReceipts.reduce((latest, current) => {
      const latestDate = parseReceiptDate(latest.date);
      const currentDate = parseReceiptDate(current.date);
      return currentDate > latestDate ? current : latest;
    }, filteredReceipts[0]);

    return {
      totalPaid,
      count,
      latestDate: latestReceipt?.date || "N/A"
    };
  }, [filteredReceipts]);

  const studentMeta = useMemo(() => {
    if (receipts.length === 0) return null;
    return {
      regNo: receipts[0].regNo || "N/A",
      applNo: receipts[0].applNo || "N/A",
      campusCode: receipts[0].campusCode || "N/A"
    };
  }, [receipts]);

  const shell = (children: React.ReactNode) => <>{children}</>;
  const showOffline = !rawData && !loading && (isOnline === false || isNetworkError(error, isOnline));

  if (showOffline) {
    return shell(<OfflineDisplay onRetry={load} />);
  }

  if (authLoading || (loading && !rawData)) {
    return shell(<PaymentReceiptsSkeleton />);
  }

  if (error && !rawData) {
    return shell(
      <div className="flex h-full items-center justify-center font-saira">
        <ErrorDisplay message={error} onRetry={load} />
      </div>
    );
  }

  return shell(
    <div className="w-full space-y-6 px-2 py-4 font-saira select-none overscroll-y-contain relative">
      <style>{`.font-saira { font-family: 'Saira', sans-serif !important; }`}</style>

      {/* Illustration image absolute header */}
      <div className="absolute -top-4 right-0 w-[200px] h-[160px] pointer-events-none select-none z-0">
        <img
          src={paymentImg}
          className="w-full h-full object-contain opacity-95 dark:opacity-75"
          style={{
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 30%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)"
          }}
          alt="Payment Illustration"
        />
      </div>

      {/* Error banner */}
      {error && !isNetworkError(error, isOnline) && (
        <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <p className="text-xs font-semibold truncate">Sync failed — {error}</p>
          <button onClick={load} className="text-xs font-bold uppercase tracking-wider shrink-0 border-0 bg-transparent text-destructive cursor-pointer">
            Retry
          </button>
        </div>
      )}
      
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center gap-2">
        <CreditCard className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-2xl font-medium tracking-tight text-foreground leading-none">Receipts</h1>
      </header>

      {/* ── Registration Details Card ────────────────────────────────────────── */}
      {studentMeta && (
        <div className="relative z-10 bg-card/70 backdrop-blur-md border border-border/30 p-5 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Registration Info</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <span className="text-xs text-muted-foreground/60 uppercase tracking-wider block leading-none">Reg. No.</span>
              <span className="text-xs font-bold text-foreground block mt-1.5 leading-none">{studentMeta.regNo}</span>
            </div>
            <div className="border-x border-border/15 px-2">
              <span className="text-xs text-muted-foreground/60 uppercase tracking-wider block leading-none">Appl. No.</span>
              <span className="text-xs font-bold text-foreground block mt-1.5 leading-none">{studentMeta.applNo}</span>
            </div>
            <div className="pl-2">
              <span className="text-xs text-muted-foreground/60 uppercase tracking-wider block leading-none">Campus</span>
              <span className="text-xs font-bold text-foreground block mt-1.5 leading-none">{studentMeta.campusCode}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Overview Stats Card ──────────────────────────────────────────────── */}
      <div className="relative z-10 bg-card/70 backdrop-blur-md border border-border/30 p-5 rounded-xl shadow-sm space-y-4">
        {/* Row 1: Receipts and Latest Date */}
        <div className="flex items-center justify-between text-center">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground/50 uppercase tracking-widest block leading-none mb-2">Receipts</span>
            <span className="text-xl font-black text-foreground leading-none">{stats.count}</span>
          </div>
          <div className="w-px h-8 bg-border/20 shrink-0 mx-4" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground/50 uppercase tracking-widest block leading-none mb-2">Latest Date</span>
            <span className="text-xs font-black text-foreground leading-none block pt-1 truncate">{stats.latestDate}</span>
          </div>
        </div>

        <Separator className="bg-border/15" />

        {/* Row 2: Total Amount Paid */}
        <div className="text-center">
          <span className="text-xs text-muted-foreground/50 uppercase tracking-widest block leading-none mb-2">Total Amount Paid</span>
          <span className="text-2xl font-black text-foreground leading-none tracking-tight block">
            {formatINR(stats.totalPaid)}
          </span>
        </div>
      </div>

      {/* ── Receipt Records ──────────────────────────────────────────────────── */}
      <section className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <ReceiptIcon className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest leading-none">Receipt Records</h2>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center bg-card/70 backdrop-blur-md border border-border/30 rounded-xl shadow-sm">
            <FileText className="w-8 h-8 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-foreground leading-none">No receipts found</p>
            <p className="text-xs text-muted-foreground">No payment records are available.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredReceipts.map((receipt) => {
              return (
                <div
                  key={receipt.receiptNumber}
                  onClick={() => setSelectedReceipt(receipt)}
                  className="bg-card/70 backdrop-blur-md border border-border/30 p-4 rounded-xl shadow-sm flex items-center justify-between gap-4 active:opacity-75 hover:bg-muted/5 transition-all duration-150 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold text-foreground leading-none truncate">
                        Receipt #{receipt.receiptNumber}
                      </h3>
                      <p className="text-xs text-muted-foreground/60 font-semibold mt-1.5 leading-none">
                        {receipt.date}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-black text-foreground tabular-nums">
                      {formatINR(receipt.amount)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Receipt Details Drawer */}
      {selectedReceipt && (
        <ReceiptDrawer
          open={!!selectedReceipt}
          onOpenChange={(open) => !open && setSelectedReceipt(null)}
          item={selectedReceipt}
        />
      )}
    </div>
  );
}
