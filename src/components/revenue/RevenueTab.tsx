import React, { useMemo } from "react";
import {
  CheckCircle,
  Clock,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  AlertCircle,
  Link,
  XCircle,
  ArrowDownLeft,
  Loader2,
} from "lucide-react";
import StatCard from "../StatCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentRequestStatus =
  | "pending"
  | "link_generated"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

type PaymentRequest = {
  id: number;
  amount: number | string;
  currency?: string;
  status: PaymentRequestStatus;
  created_at: string;
  paid_at?: string | null;
  cancelled_at?: string | null;
  sale?: {
    client_name?: string;
    service_rendered?: string;
  } | null;
};

type RevenueTabProps = {
  revenuePaid: number;
  revenuePending: number;
  revenueRefunded: number;
  periodSales: any[];
  paymentRequests: PaymentRequest[];
  periodLabel: string;
  revenueLoading: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: any): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtUSD(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  zelle: "Zelle",
  "zelle transfer": "Zelle",
  credit_card: "Tarjeta Crédito",
  debit_card: "Tarjeta Débito",
  card: "Tarjeta",
  cheque: "Cheque",
  deposit: "Depósito",
  stripe: "Stripe",
  "bank transfer": "Transferencia",
  otros: "Otros",
  other: "Otros",
  others: "Otros",
};

function methodLabel(raw: string): string {
  return METHOD_LABELS[raw.toLowerCase()] ?? raw;
}

const STATUS_CONFIG: Record<PaymentRequestStatus, { label: string; color: string; dot: string }> = {
  pending:           { label: "Cobro iniciado",    color: "text-gray-500",   dot: "bg-gray-400" },
  link_generated:    { label: "Link enviado",       color: "text-blue-600",   dot: "bg-blue-500" },
  paid:              { label: "Pago confirmado",    color: "text-emerald-600",dot: "bg-emerald-500" },
  failed:            { label: "Pago fallido",       color: "text-red-600",    dot: "bg-red-500" },
  expired:           { label: "Link expirado",      color: "text-gray-500",   dot: "bg-gray-400" },
  cancelled:         { label: "Cancelado",          color: "text-gray-500",   dot: "bg-gray-400" },
  refunded:          { label: "Reembolso total",    color: "text-amber-600",  dot: "bg-amber-500" },
  partially_refunded:{ label: "Reembolso parcial",  color: "text-amber-500",  dot: "bg-amber-400" },
};

// ─── Section: KPI Cards ───────────────────────────────────────────────────────

const KPISection: React.FC<{
  revenuePaid: number;
  revenuePending: number;
  revenueRefunded: number;
  netRevenue: number;
}> = ({ revenuePaid, revenuePending, revenueRefunded, netRevenue }) => (
  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
    <StatCard
      title="Revenue Cobrado"
      value={fmtUSD(revenuePaid)}
      icon={CheckCircle}
      color="bg-emerald-600"
      trend={revenuePaid > 0 ? "Pagos confirmados" : undefined}
      trendUp
    />
    <StatCard
      title="Revenue Pendiente"
      value={fmtUSD(revenuePending)}
      icon={Clock}
      color="bg-amber-500"
      trend={revenuePending > 0 ? "Links activos" : undefined}
      trendUp={false}
    />
    <StatCard
      title="Revenue Reembolsado"
      value={fmtUSD(revenueRefunded)}
      icon={RotateCcw}
      color="bg-red-500"
      trend={revenueRefunded > 0 ? "Devoluciones procesadas" : undefined}
      trendUp={false}
    />
    <StatCard
      title="Net Revenue"
      value={fmtUSD(netRevenue)}
      icon={TrendingUp}
      color={netRevenue >= 0 ? "bg-blue-600" : "bg-red-600"}
      trend={`${netRevenue >= 0 ? "Positivo" : "Negativo"} · Cobrado – Reembolsado`}
      trendUp={netRevenue >= 0}
    />
  </div>
);

// ─── Section: Payment Method Breakdown ────────────────────────────────────────

type MethodRow = { method: string; amount: number; pct: number };

const BreakdownSection: React.FC<{ rows: MethodRow[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-full flex items-center justify-center text-gray-400 text-sm">
        Sin ventas en el período seleccionado
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-5">
        <CreditCard size={16} className="text-indigo-500" />
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">
          Breakdown por Método de Pago
        </h3>
      </div>
      <div className="space-y-3">
        {rows.map(({ method, amount, pct }) => (
          <div key={method}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-gray-700">{methodLabel(method)}</span>
              <span className="text-xs font-black text-gray-900">
                {fmtUSD(amount)}{" "}
                <span className="text-[10px] font-bold text-gray-400">
                  ({pct.toFixed(1)}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Section: Cashflow Summary ────────────────────────────────────────────────

const CashflowSection: React.FC<{
  revenuePaid: number;
  revenueRefunded: number;
  netRevenue: number;
}> = ({ revenuePaid, revenueRefunded, netRevenue }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-full">
    <div className="flex items-center gap-2 mb-5">
      <Banknote size={16} className="text-emerald-500" />
      <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">
        Resumen de Cashflow
      </h3>
    </div>
    <div className="space-y-4">
      <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-600" />
          <span className="text-xs font-bold text-emerald-700">Total Ingresado</span>
        </div>
        <span className="text-sm font-black text-emerald-700">{fmtUSD(revenuePaid)}</span>
      </div>
      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-red-500" />
          <span className="text-xs font-bold text-red-600">Total Reembolsado</span>
        </div>
        <span className="text-sm font-black text-red-600">− {fmtUSD(revenueRefunded)}</span>
      </div>
      <div className="border-t border-gray-100 pt-3">
        <div className={`flex justify-between items-center p-3 rounded-lg ${netRevenue >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
          <div className="flex items-center gap-2">
            <ArrowDownLeft size={14} className={netRevenue >= 0 ? "text-blue-600" : "text-red-600"} />
            <span className={`text-xs font-black uppercase tracking-wider ${netRevenue >= 0 ? "text-blue-700" : "text-red-700"}`}>
              Net Revenue
            </span>
          </div>
          <span className={`text-lg font-black ${netRevenue >= 0 ? "text-blue-700" : "text-red-700"}`}>
            {fmtUSD(netRevenue)}
          </span>
        </div>
      </div>
    </div>
  </div>
);

// ─── Section: Stripe Detail Panel ────────────────────────────────────────────

const StripePanel: React.FC<{
  revenuePaid: number;
  revenuePending: number;
  revenueRefunded: number;
  failedCount: number;
}> = ({ revenuePaid, revenuePending, revenueRefunded, failedCount }) => {
  const hasAny = revenuePaid > 0 || revenuePending > 0 || revenueRefunded > 0 || failedCount > 0;
  if (!hasAny) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-4 flex items-center gap-2">
        <CreditCard size={16} className="text-violet-200" />
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Stripe — Estado de Cobros</h3>
        <span className="ml-auto text-[10px] font-bold text-violet-200 bg-violet-500 px-2 py-0.5 rounded-full">
          Stripe Connect
        </span>
      </div>
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <CheckCircle size={20} className="text-emerald-600 mx-auto mb-2" />
          <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Cobrado</p>
          <p className="text-base font-black text-emerald-700">{fmtUSD(revenuePaid)}</p>
          <p className="text-[10px] text-emerald-500 mt-0.5">Webhook confirmado</p>
        </div>
        <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
          <Link size={20} className="text-amber-500 mx-auto mb-2" />
          <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Pendiente</p>
          <p className="text-base font-black text-amber-700">{fmtUSD(revenuePending)}</p>
          <p className="text-[10px] text-amber-500 mt-0.5">Checkout activo</p>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
          <RotateCcw size={20} className="text-orange-500 mx-auto mb-2" />
          <p className="text-[10px] font-black text-orange-600 uppercase mb-1">Reembolsado</p>
          <p className="text-base font-black text-orange-700">{fmtUSD(revenueRefunded)}</p>
          <p className="text-[10px] text-orange-500 mt-0.5">Monto original</p>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
          <XCircle size={20} className="text-red-500 mx-auto mb-2" />
          <p className="text-[10px] font-black text-red-600 uppercase mb-1">Fallidos</p>
          <p className="text-base font-black text-red-700">{failedCount}</p>
          <p className="text-[10px] text-red-500 mt-0.5">Cobros no completados</p>
        </div>
      </div>
      <div className="px-6 pb-4">
        <p className="text-[10px] text-gray-400 font-medium">
          * Revenue Cobrado y Pendiente incluyen todos los métodos de pago, no exclusivamente Stripe.
          Para separación exacta por proveedor, se requiere endpoint futuro.
        </p>
      </div>
    </div>
  );
};

// ─── Section: Financial Timeline ──────────────────────────────────────────────

const FinancialTimeline: React.FC<{
  paymentRequests: PaymentRequest[];
  loading: boolean;
}> = ({ paymentRequests, loading }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
      <AlertCircle size={16} className="text-indigo-500" />
      <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">
        Timeline Financiero
      </h3>
      {loading && <Loader2 size={14} className="text-gray-400 ml-auto animate-spin" />}
    </div>

    {!loading && paymentRequests.length === 0 ? (
      <div className="p-8 text-center text-gray-400 text-sm">
        No hay cobros Stripe registrados en este período.
      </div>
    ) : (
      <div className="divide-y divide-gray-50">
        {paymentRequests.slice(0, 15).map((pr) => {
          const cfg = STATUS_CONFIG[pr.status] ?? STATUS_CONFIG["pending"];
          const clientName = pr.sale?.client_name ?? "Cliente desconocido";
          const service = pr.sale?.service_rendered ?? "";
          const eventDate = pr.paid_at ?? pr.cancelled_at ?? pr.created_at;
          return (
            <div key={pr.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dot} mt-1`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-black ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-[11px] text-gray-600 font-semibold truncate">
                      {clientName}
                      {service ? <span className="text-gray-400 font-normal"> · {service}</span> : null}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-gray-900">{fmtUSD(toNum(pr.amount))}</p>
                    <p className="text-[10px] text-gray-400">{fmtDate(eventDate)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {paymentRequests.length > 15 && (
          <div className="px-6 py-3 text-center text-[11px] text-gray-400 font-bold">
            Mostrando los últimos 15 eventos · {paymentRequests.length} total
          </div>
        )}
      </div>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const RevenueTab: React.FC<RevenueTabProps> = ({
  revenuePaid,
  revenuePending,
  revenueRefunded,
  periodSales,
  paymentRequests,
  periodLabel,
  revenueLoading,
}) => {
  const netRevenue = revenuePaid - revenueRefunded;

  const methodBreakdown = useMemo<MethodRow[]>(() => {
    const map = new Map<string, number>();
    periodSales.forEach((s: any) => {
      const m = (String(s?.payment_method ?? "otros")).toLowerCase().trim();
      map.set(m, (map.get(m) ?? 0) + toNum(s?.amount));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([method, amount]) => ({ method, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodSales]);

  const failedCount = useMemo(
    () => paymentRequests.filter((pr) => pr.status === "failed").length,
    [paymentRequests],
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Period badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-200">
            Revenue · {periodLabel}
          </span>
          {revenueLoading && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Actualizando…
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 font-medium">
          Datos pre-calculados por backend · payment_status driven
        </p>
      </div>

      {/* 1. KPI Cards */}
      <KPISection
        revenuePaid={revenuePaid}
        revenuePending={revenuePending}
        revenueRefunded={revenueRefunded}
        netRevenue={netRevenue}
      />

      {/* 2. Breakdown + Cashflow side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownSection rows={methodBreakdown} />
        <CashflowSection
          revenuePaid={revenuePaid}
          revenueRefunded={revenueRefunded}
          netRevenue={netRevenue}
        />
      </div>

      {/* 3. Stripe panel — only if Stripe data exists */}
      <StripePanel
        revenuePaid={revenuePaid}
        revenuePending={revenuePending}
        revenueRefunded={revenueRefunded}
        failedCount={failedCount}
      />

      {/* 4. Financial Timeline */}
      <FinancialTimeline
        paymentRequests={paymentRequests}
        loading={revenueLoading && paymentRequests.length === 0}
      />
    </div>
  );
};

export default RevenueTab;
