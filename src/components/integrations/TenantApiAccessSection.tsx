import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2, AlertTriangle, Check, X } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { TenantApiTokenIssued, TenantApiTokenStatus } from "../../types";
import TenantApiTokenRevealModal from "./TenantApiTokenRevealModal";

/**
 * Settings -> Integrations -> Tenant API Access.
 *
 * Manages the tenant's Sanctum integration token: the scoped, rotatable replacement for the legacy
 * `tenant_api_token` / `X-API-KEY` credential. This screen shows **metadata only** — id, name,
 * scopes, creation and last use. No endpoint behind it can return a token, so there is nothing here
 * that could reveal an existing one; the plaintext appears exactly once, in the modal, immediately
 * after it is minted.
 *
 * SuperAdmin-only, matching the backend exactly: the routes sit behind the `superadmin` middleware
 * and `TenantPolicy::view/update`. No new permission is invented for this, and the section is not
 * rendered read-only for tenant staff either — every call would be rejected anyway, so showing it
 * would only promise something that cannot happen.
 *
 * Rotation is deliberately two-step. Minting a candidate leaves the current token fully active, so
 * a consumer like n8n or Chatwoot can be updated and verified before anything is revoked; confirm
 * makes the swap, discard abandons it and changes nothing.
 */
const TenantApiAccessSection: React.FC<{ tenantId: number }> = ({ tenantId }) => {
  const [status, setStatus] = useState<TenantApiTokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  // The ONLY place a plaintext token ever lives on the client. Set from a mint response, cleared
  // the moment the modal closes, never written to storage and never sent anywhere.
  const [issued, setIssued] = useState<TenantApiTokenIssued | null>(null);
  const [issuedIsCandidate, setIssuedIsCandidate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.getTenantApiTokenStatus(tenantId);
      setStatus(next);
      // Pre-select what the active token already carries, so rotation preserves scopes unless the
      // operator deliberately narrows them.
      setSelected(next.active?.abilities ?? next.available_abilities.map((a) => a.value));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el estado del token.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      // ApiError carries only the backend's own sanitized message; nothing here inspects or
      // re-prints a response body that could contain more than that.
      setError(err instanceof ApiError ? err.message : "La operación no pudo completarse.");
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = () =>
    run("create", async () => {
      const result = await api.createTenantApiToken(tenantId, selected);
      setIssuedIsCandidate(false);
      setIssued(result);
    });

  const handleRotate = () =>
    run("rotate", async () => {
      const result = await api.rotateTenantApiToken(tenantId, selected);
      setIssuedIsCandidate(true);
      setIssued(result);
    });

  const handleConfirm = () =>
    run("confirm", async () => {
      const { status: next } = await api.confirmTenantApiTokenRotation(tenantId);
      setStatus(next);
      setNotice("Rotación confirmada. El token anterior fue revocado.");
    });

  const handleDiscard = () =>
    run("discard", async () => {
      const { status: next } = await api.discardTenantApiTokenRotation(tenantId);
      setStatus(next);
      setNotice("Candidato descartado. El token anterior sigue intacto.");
    });

  const handleRevoke = () =>
    run("revoke", async () => {
      await api.revokeTenantApiToken(tenantId);
      setConfirmingRevoke(false);
      setNotice("Token revocado. Los consumidores que lo usaban dejarán de autenticar.");
      await load();
    });

  /** Closing is the only path out of the reveal modal, and it drops the plaintext for good. */
  const handleRevealClosed = () => {
    setIssued(null);
    setIssuedIsCandidate(false);
    setNotice("El token ya no puede recuperarse. Si lo perdió, genere o rote otro.");
    void load();
  };

  const toggleAbility = (value: string) =>
    setSelected((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );

  const meta = (label: string, value: string | null | undefined) => (
    <div>
      <dt className="text-[11px] font-bold text-gray-500 uppercase">{label}</dt>
      <dd className="text-sm text-gray-800 break-all">{value ?? "—"}</dd>
    </div>
  );

  const pendingRotation = status?.pending_rotation ?? null;
  const active = status?.active ?? null;

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <KeyRound size={18} className="text-indigo-600" />
            Tenant API Access
          </h3>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Token de integración para consumidores máquina a máquina (n8n, Chatwoot). Sustituye al
            campo legacy <code className="text-xs bg-gray-100 px-1 rounded">X-API-KEY</code> con
            permisos acotados y rotación sin interrupción.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {loading && !status ? (
        <p className="mt-4 text-sm text-gray-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {/* ---------------- active token ---------------- */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-800 mb-3">Token activo</h4>
            {active ? (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {meta("Nombre", active.name)}
                  {meta("Creado", active.created_at)}
                  {meta("Último uso", active.last_used_at ?? "Nunca")}
                  {meta("Identificador", `#${active.id}`)}
                </dl>
                <div className="mt-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Permisos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {active.abilities.map((a) => (
                      <span key={a} className="text-xs font-mono bg-gray-100 text-gray-700 border border-gray-200 rounded px-2 py-0.5">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500 flex items-start gap-1.5">
                  <ShieldCheck size={13} className="text-indigo-500 mt-0.5 shrink-0" />
                  El valor del token no puede consultarse. Solo es posible rotarlo o revocarlo.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Este tenant todavía no tiene token de acceso API.</p>
            )}
          </div>

          {/* ---------------- ability selection ---------------- */}
          {!pendingRotation && (
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-bold text-gray-800 px-1">
                Permisos {active ? "del nuevo token" : "a otorgar"}
              </legend>
              <p className="text-xs text-gray-500 mb-3">
                Otorgue únicamente lo que el consumidor necesita.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(status?.available_abilities ?? []).map((ability) => (
                  <label key={ability.value} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(ability.value)}
                      onChange={() => toggleAbility(ability.value)}
                      className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    <span>
                      <span className="font-mono text-xs text-gray-800">{ability.value}</span>
                      <span className="block text-xs text-gray-500">{ability.label}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!active ? (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={busy !== null || selected.length === 0}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition flex items-center gap-2 text-sm"
                  >
                    {busy === "create" ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    Generar token
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRotate}
                    disabled={busy !== null || selected.length === 0}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition flex items-center gap-2 text-sm"
                  >
                    {busy === "rotate" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Iniciar rotación
                  </button>
                )}
              </div>
            </fieldset>
          )}

          {/* ---------------- pending rotation ---------------- */}
          {pendingRotation && (
            <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600" />
                Rotación pendiente
              </h4>
              <p className="text-sm text-amber-900/90 mt-1">
                Hay un token candidato generado. El token anterior <strong>sigue activo</strong>.
                Actualice el consumidor y verifíquelo antes de confirmar.
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {meta("Candidato creado", pendingRotation.created_at)}
                {meta("Último uso del candidato", pendingRotation.last_used_at ?? "Nunca")}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy !== null}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-green-300 transition flex items-center gap-2 text-sm"
                >
                  {busy === "confirm" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Confirmar rotación
                </button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={busy !== null}
                  className="px-4 py-2.5 border border-gray-300 bg-white rounded-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition flex items-center gap-2 text-sm"
                >
                  {busy === "discard" ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                  Descartar candidato
                </button>
              </div>
            </div>
          )}

          {/* ---------------- revoke ---------------- */}
          {active && !pendingRotation && (
            <div className="border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-bold text-red-800">Revocar acceso</h4>
              <p className="text-sm text-gray-600 mt-1">
                Elimina el token sin reemplazo. Todo consumidor que lo use dejará de autenticar de
                inmediato.
              </p>
              {confirmingRevoke ? (
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-semibold text-red-800">¿Confirma la revocación?</span>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={busy !== null}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-red-300 transition flex items-center gap-2 text-sm"
                  >
                    {busy === "revoke" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    Sí, revocar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRevoke(false)}
                    disabled={busy !== null}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRevoke(true)}
                  className="mt-3 px-4 py-2 border border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition flex items-center gap-2 text-sm"
                >
                  <Trash2 size={15} />
                  Revocar token
                </button>
              )}
            </div>
          )}

          {/* ---------------- static consumer instructions ---------------- */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-800 mb-2">Cómo debe autenticar el consumidor</h4>
            <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-lg px-3 py-2.5 overflow-x-auto font-mono">
{`Authorization: Bearer <token>
X-Tenant-ID: ${tenantId}`}
            </pre>
            <p className="text-[11px] text-gray-500 mt-1.5">
              El token real solo se muestra en el momento de generarlo o rotarlo; este ejemplo nunca
              lo contiene.
            </p>
          </div>
        </div>
      )}

      {issued && (
        <TenantApiTokenRevealModal
          plainTextToken={issued.plain_text_token}
          tenantId={tenantId}
          abilities={issued.token.abilities}
          isRotationCandidate={issuedIsCandidate}
          onClose={handleRevealClosed}
        />
      )}
    </section>
  );
};

export default TenantApiAccessSection;
