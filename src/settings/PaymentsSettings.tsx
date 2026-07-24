import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { UserData } from "../App";
import {
  TenantStripeAccountSafe,
  PaymentConnectionStatus,
  OnboardingStatus,
} from "../types/payments";

type ActionKey = "connect" | "refresh" | "oauth" | "toggle" | "note";

type Banner = { type: "success" | "error" | "info"; message: string };

type WebhookHealth = {
  last_received_event_at: string | null;
  recent_signature_failures_24h: number;
  last_signature_failure_at: string | null;
};

function getErrorMessage(e: any): string {
  const status = e?.status;
  const errors: Record<string, string[]> | undefined = e?.errors;
  if (status === 422 && errors) {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.[0] : null;
    return firstMsg ?? "Validation failed.";
  }
  return e?.message ?? "Ocurrió un error.";
}

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  express_created_by_platform: "Express (creada por la plataforma)",
  standard_oauth_authorized_by_owner: "Standard (OAuth autorizado por el owner)",
  manual_external_reference: "Referencia externa manual",
};

const CONNECTION_STATUS_LABELS: Record<PaymentConnectionStatus, string> = {
  not_connected: "No conectado",
  pending: "Pendiente",
  connected: "Conectado",
  disconnected: "Desconectado",
  revoked: "Revocado",
  error: "Error",
};

const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_connected: "No iniciado",
  pending: "Pendiente",
  complete: "Completo",
};

function statusBadgeClass(status: PaymentConnectionStatus | OnboardingStatus): string {
  if (status === "connected" || status === "complete") return "bg-green-100 text-green-800";
  if (status === "pending") return "bg-yellow-100 text-yellow-800";
  if (status === "revoked" || status === "error") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

function boolBadge(value: boolean | null) {
  if (value === null) return <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500">—</span>;
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${value ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
      {value ? "Sí" : "No"}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatRelative(value: string | null): string {
  if (!value) return "nunca";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return value;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

const PaymentsSettings: React.FC<{
  isSuperAdmin?: boolean;
  user?: UserData | null;
}> = ({ isSuperAdmin, user }) => {
  const isAdminRole = user?.role?.name === "admin";

  const [account, setAccount] = useState<TenantStripeAccountSafe | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [note, setNote] = useState("");

  const [webhookHealth, setWebhookHealth] = useState<WebhookHealth | null>(null);
  const [webhookHealthLoading, setWebhookHealthLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const canManageConnection = !!isSuperAdmin;
  const canStartOAuth = !!isSuperAdmin || (isAdminRole && !!account?.owner_oauth_authorization_enabled);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TenantStripeAccountSafe>("/payments/stripe-account");
      setAccount(res);
      setNote(res.external_reference_note ?? "");
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookHealth = async () => {
    if (!isSuperAdmin) return;
    setWebhookHealthLoading(true);
    try {
      const res = await api.get<WebhookHealth>("/payments/stripe-account/webhook-health");
      setWebhookHealth(res);
    } catch {
      // Silently degrade — this is a diagnostic panel, not core connection state.
      setWebhookHealth(null);
    } finally {
      setWebhookHealthLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadWebhookHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    const status = searchParams.get("status");

    if (oauth === "success") {
      setBanner({ type: "success", message: "Cuenta de Stripe autorizada correctamente vía OAuth." });
    } else if (oauth === "error") {
      setBanner({ type: "error", message: searchParams.get("message") || "No se pudo completar la autorización OAuth." });
    } else if (status === "return") {
      setBanner({ type: "info", message: "Volviste del onboarding de Stripe. Actualizando estado…" });
    } else if (status === "refresh") {
      setBanner({ type: "info", message: "El link de onboarding expiró o fue cancelado. Podés generar uno nuevo." });
    }

    if (oauth || status) {
      setSearchParams({}, { replace: true });
      if (status === "return" && isSuperAdmin) {
        handleRefresh();
      } else {
        load();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setBusy("connect");
    setError(null);
    try {
      const res = await api.post<{ url: string } & TenantStripeAccountSafe>("/payments/stripe-account/connect");
      setAccount(res);
      if (res.url) window.location.href = res.url;
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy("refresh");
    setError(null);
    try {
      const res = await api.post<TenantStripeAccountSafe>("/payments/stripe-account/refresh");
      setAccount(res);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleStartOAuth = async () => {
    setBusy("oauth");
    setError(null);
    try {
      const res = await api.get<{ url: string }>("/payments/stripe-account/oauth/authorize-url");
      if (res.url) window.location.href = res.url;
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleToggleOwnerOauth = async (enabled: boolean) => {
    setBusy("toggle");
    setError(null);
    try {
      const res = await api.patch<TenantStripeAccountSafe>("/payments/stripe-account/owner-oauth-toggle", { enabled });
      setAccount(res);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("note");
    setError(null);
    try {
      const res = await api.post<TenantStripeAccountSafe>("/payments/stripe-account/external-reference", {
        note: note.trim() ? note.trim() : null,
      });
      setAccount(res);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const connectionStatus = account?.connection_status ?? "not_connected";
  const onboardingStatus = account?.onboarding_status ?? "not_connected";
  const connectionTypeLabel = account?.connection_type
    ? CONNECTION_TYPE_LABELS[account.connection_type] ?? account.connection_type
    : "Sin conexión";

  return (
    <div className="space-y-5">
      {banner && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            banner.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : banner.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-indigo-50 border-indigo-200 text-indigo-800"
          }`}
        >
          {banner.message}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-900">Estado de la conexión</h4>
          {canManageConnection && (
            <button
              onClick={handleRefresh}
              disabled={loading || busy !== null || account?.connection_type === "manual_external_reference"}
              className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === "refresh" ? "Actualizando…" : "Refresh status"}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Tipo de conexión</p>
              <p className="font-semibold text-gray-800">{connectionTypeLabel}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Estado de conexión</p>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusBadgeClass(connectionStatus)}`}>
                {CONNECTION_STATUS_LABELS[connectionStatus]}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Onboarding</p>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusBadgeClass(onboardingStatus)}`}>
                {ONBOARDING_STATUS_LABELS[onboardingStatus]}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Charges enabled</p>
              {boolBadge(account?.charges_enabled ?? false)}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Payouts enabled</p>
              {boolBadge(account?.payouts_enabled ?? false)}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Details submitted</p>
              {boolBadge(account?.details_submitted ?? false)}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Moneda por defecto</p>
              <p className="font-semibold text-gray-800">{account?.default_currency?.toUpperCase() ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">OAuth scope</p>
              <p className="font-semibold text-gray-800">{account?.oauth_scope ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Live mode</p>
              {boolBadge(account?.live_mode ?? null)}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Owner OAuth habilitado</p>
              {boolBadge(account?.owner_oauth_authorization_enabled ?? false)}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Conectado el</p>
              <p className="font-semibold text-gray-800">{formatDate(account?.connected_at ?? null)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Desconectado el</p>
              <p className="font-semibold text-gray-800">{formatDate(account?.disconnected_at ?? null)}</p>
            </div>
          </div>
        )}

        {account?.connection_type === "manual_external_reference" && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm">
            <p className="font-bold">Este tenant cobra fuera de SPA Manager Pro.</p>
            <p className="opacity-90 mt-1">Este modo es solo informativo: <strong>no genera Stripe Checkout</strong>.</p>
            <p className="mt-2">Nota guardada: {account.external_reference_note ?? "(sin nota)"}</p>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-900">Estado de los Webhooks (entrante)</h4>
              <p className="text-sm text-gray-500">
                "Refresh status" arriba solo confirma que la plataforma puede llamar a Stripe (saliente).
                Esto confirma lo contrario: que Stripe nos está alcanzando y que podemos verificar lo que envía.
              </p>
            </div>
            <button
              onClick={loadWebhookHealth}
              disabled={webhookHealthLoading}
              className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {webhookHealthLoading ? "…" : "Actualizar"}
            </button>
          </div>

          {webhookHealthLoading && !webhookHealth ? (
            <p className="text-sm text-gray-500">Cargando…</p>
          ) : webhookHealth ? (
            <>
              {webhookHealth.recent_signature_failures_24h > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm">
                  <p className="font-bold">
                    {webhookHealth.recent_signature_failures_24h} fallo(s) de verificación de firma en las últimas 24h.
                  </p>
                  <p className="opacity-90 mt-1">
                    Stripe está intentando entregar eventos, pero <code>STRIPE_WEBHOOK_SECRET</code> no coincide
                    con el destino que los está firmando. Revisa el signing secret en Stripe Dashboard → Webhooks,
                    y si acabas de rotarlo, corre <code>php artisan config:clear</code> y reinicia PHP-FPM en el servidor.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Último evento recibido</p>
                  <p className="font-semibold text-gray-800">
                    {formatRelative(webhookHealth.last_received_event_at)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(webhookHealth.last_received_event_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Fallos de firma (24h)</p>
                  <span
                    className={`px-2 py-1 rounded-md text-xs font-medium ${
                      webhookHealth.recent_signature_failures_24h > 0
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {webhookHealth.recent_signature_failures_24h}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Último fallo de firma</p>
                  <p className="font-semibold text-gray-800">
                    {formatRelative(webhookHealth.last_signature_failure_at)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(webhookHealth.last_signature_failure_at)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No se pudo cargar el estado de los webhooks.</p>
          )}
        </div>
      )}

      {canManageConnection && (
        <div className="border rounded-xl p-4 space-y-3">
          <h4 className="font-bold text-gray-900">Crear cuenta Stripe Express</h4>
          <p className="text-sm text-gray-500">
            Crea (o continúa) la cuenta Express del tenant y genera un link de onboarding hospedado por Stripe.
          </p>
          <button
            onClick={handleConnect}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
          >
            {busy === "connect" ? "Generando link…" : "Crear cuenta Express / continuar onboarding"}
          </button>
        </div>
      )}

      <div className="border rounded-xl p-4 space-y-3">
        <h4 className="font-bold text-gray-900">Conectar cuenta Stripe existente (OAuth)</h4>
        <p className="text-sm text-gray-500">
          Autoriza una cuenta de Stripe que el tenant ya tiene, vía Stripe Connect Standard OAuth.
        </p>
        {canStartOAuth ? (
          <button
            onClick={handleStartOAuth}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
          >
            {busy === "oauth" ? "Generando…" : "Connect existing Stripe account"}
          </button>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No tenés autorización para iniciar esta conexión. Pedile a un SuperAdmin que la habilite.
          </p>
        )}
      </div>

      {canManageConnection && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-900">Autorización OAuth del owner</h4>
              <p className="text-sm text-gray-500">
                Si está activo, el Admin del tenant puede iniciar OAuth Standard sin depender de un SuperAdmin.
              </p>
            </div>
            <button
              onClick={() => handleToggleOwnerOauth(!account?.owner_oauth_authorization_enabled)}
              disabled={busy !== null}
              className={`px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                account?.owner_oauth_authorization_enabled
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {busy === "toggle" ? "Guardando…" : account?.owner_oauth_authorization_enabled ? "Habilitado" : "Deshabilitado"}
            </button>
          </div>
        </div>
      )}

      {canManageConnection && (
        <div className="border rounded-xl p-4 space-y-3">
          <h4 className="font-bold text-gray-900">Referencia externa manual</h4>
          <p className="text-sm text-gray-500">
            Para tenants que cobran fuera de SPA Manager Pro. Esto solo registra una nota informativa y{" "}
            <strong>no habilita Stripe Checkout</strong>.
          </p>
          <form onSubmit={handleSaveNote} className="space-y-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Ej: el tenant cobra en su propia terminal POS."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === "note" ? "Guardando…" : "Registrar referencia manual"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default PaymentsSettings;
