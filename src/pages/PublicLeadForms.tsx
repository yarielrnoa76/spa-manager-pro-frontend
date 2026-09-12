import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  WifiOff,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "../services/api";
import { PublicLeadForm, PublicLeadFormReadiness } from "../types";
import { UserData } from "../App";
import PublicLeadFormEditorModal from "../components/PublicLeadFormEditorModal";
import {
  getPublicLeadFormEnabledLabel,
  getPublicLeadFormReadinessStatus,
  getPublicLeadFormMutationErrorMessage,
  getCodeMessage,
} from "../utils/publicLeadFormPresentation";

type LoadState = "idle" | "loading" | "empty" | "forbidden" | "error" | "success";

const PER_PAGE = 15;

interface PublicLeadFormsProps {
  user: UserData | null;
}

const PublicLeadForms: React.FC<PublicLeadFormsProps> = ({ user }) => {
  const isSuperAdmin = user?.is_super_admin === true;
  const perms = useMemo<string[]>(() => (Array.isArray(user?.permissions) ? user!.permissions : []), [user]);
  const hasPerm = useCallback((p: string) => isSuperAdmin || perms.includes(p), [isSuperAdmin, perms]);

  const canManage = hasPerm("manage_public_lead_forms");
  const canPublish = hasPerm("publish_public_lead_forms");

  // --- List ---
  const [forms, setForms] = useState<PublicLeadForm[]>([]);
  const [listMeta, setListMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: PER_PAGE });
  const [listState, setListState] = useState<LoadState>("idle");
  const [page, setPage] = useState(1);

  const loadList = useCallback(async (targetPage: number) => {
    setListState("loading");
    try {
      const res = await api.listPublicLeadForms({ page: targetPage, per_page: PER_PAGE });
      setForms(res.data ?? []);
      setListMeta({
        current_page: res.meta?.current_page ?? targetPage,
        last_page: res.meta?.last_page ?? 1,
        total: res.meta?.total ?? (res.data ?? []).length,
        per_page: res.meta?.per_page ?? PER_PAGE,
      });
      setListState((res.data ?? []).length === 0 ? "empty" : "success");
    } catch (err: unknown) {
      setForms([]);
      const status = err instanceof ApiError ? err.status : undefined;
      setListState(status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    loadList(page);
  }, [page, loadList]);

  // --- Detail + readiness ---
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [selectedForm, setSelectedForm] = useState<PublicLeadForm | null>(null);
  const [detailState, setDetailState] = useState<LoadState>("idle");

  const [readiness, setReadiness] = useState<PublicLeadFormReadiness | null>(null);
  const [readinessState, setReadinessState] = useState<LoadState>("idle");

  const loadDetail = useCallback(async (id: number) => {
    setDetailState("loading");
    try {
      const form = await api.getPublicLeadForm(id);
      setSelectedForm(form);
      setDetailState("success");
    } catch (err: unknown) {
      setSelectedForm(null);
      const status = err instanceof ApiError ? err.status : undefined;
      setDetailState(status === 403 ? "forbidden" : "error");
    }
  }, []);

  const loadReadiness = useCallback(async (id: number) => {
    setReadinessState("loading");
    try {
      const data = await api.getPublicLeadFormReadiness(id);
      setReadiness(data);
      setReadinessState("success");
    } catch (err: unknown) {
      setReadiness(null);
      const status = err instanceof ApiError ? err.status : undefined;
      setReadinessState(status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    if (selectedFormId !== null) {
      loadDetail(selectedFormId);
      loadReadiness(selectedFormId);
    } else {
      setSelectedForm(null);
      setDetailState("idle");
      setReadiness(null);
      setReadinessState("idle");
    }
  }, [selectedFormId, loadDetail, loadReadiness]);

  const selectForm = (id: number) => setSelectedFormId(id);
  const closeDetail = () => setSelectedFormId(null);

  // Never optimistic: every mutation re-asks the server for the confirmed state.
  const refreshAfterMutation = useCallback(() => {
    loadList(page);
    if (selectedFormId !== null) {
      loadDetail(selectedFormId);
      loadReadiness(selectedFormId);
    }
  }, [page, selectedFormId, loadList, loadDetail, loadReadiness]);

  // --- Create / edit modal ---
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");

  const openCreateModal = () => {
    setEditorMode("create");
    setEditorOpen(true);
  };

  const openEditModal = () => {
    setEditorMode("edit");
    setEditorOpen(true);
  };

  const handleEditorSuccess = (form: PublicLeadForm) => {
    setSelectedFormId(form.id);
    refreshAfterMutation();
  };

  // --- Publish / pause ---
  const [publishing, setPublishing] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handlePublish = async () => {
    if (selectedFormId === null) return;
    setActionError(null);
    setPublishing(true);
    try {
      await api.publishPublicLeadForm(selectedFormId);
      refreshAfterMutation();
    } catch (err: unknown) {
      setActionError(getPublicLeadFormMutationErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  const handlePause = async () => {
    if (selectedFormId === null) return;
    setActionError(null);
    setPausing(true);
    try {
      await api.pausePublicLeadForm(selectedFormId);
      setPauseConfirmOpen(false);
      refreshAfterMutation();
    } catch (err: unknown) {
      setActionError(getPublicLeadFormMutationErrorMessage(err));
    } finally {
      setPausing(false);
    }
  };

  // ---------- Renderers ----------

  const renderLoading = () => (
    <div className="p-12 text-center text-gray-500 animate-pulse font-bold">Cargando...</div>
  );

  const renderForbidden = () => (
    <div className="p-12 flex flex-col items-center justify-center text-center gap-3 text-gray-500">
      <ShieldAlert size={40} className="text-red-300" />
      <p className="font-bold text-gray-700">No tienes permiso para ver esta información.</p>
    </div>
  );

  const renderError = (onRetry: () => void) => (
    <div className="p-12 flex flex-col items-center justify-center text-center gap-3 text-gray-500">
      <WifiOff size={40} className="text-gray-300" />
      <p className="font-bold text-gray-700">No se pudo cargar la información.</p>
      <button onClick={onRetry} className="text-xs font-bold text-indigo-600 hover:underline">
        Reintentar
      </button>
    </div>
  );

  const renderPagination = () => (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
      <p className="text-xs text-gray-500">
        {listMeta.total} formulario{listMeta.total === 1 ? "" : "s"} &middot; página {listMeta.current_page} de{" "}
        {listMeta.last_page}
      </p>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="p-1.5 rounded-lg border text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          disabled={page >= listMeta.last_page}
          onClick={() => setPage((p) => p + 1)}
          className="p-1.5 rounded-lg border text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="flex-1 min-w-0">
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {(listState === "loading" || listState === "idle") && renderLoading()}
        {listState === "forbidden" && renderForbidden()}
        {listState === "error" && renderError(() => loadList(page))}
        {listState === "empty" && (
          <div className="p-12 text-center text-gray-400">Todavía no hay formularios de captación creados.</div>
        )}
        {listState === "success" && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Orígenes permitidos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Actualizado</th>
                    <th className="px-4 py-3">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {forms.map((f) => (
                    <tr
                      key={f.id}
                      className={`hover:bg-indigo-50/50 transition-colors ${selectedFormId === f.id ? "bg-indigo-50" : ""}`}
                    >
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{f.name}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{f.key}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{f.branch?.name ?? `#${f.branch_id}`}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] truncate" title={f.allowed_origins.join(", ")}>
                        {f.allowed_origins.join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            f.enabled
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {getPublicLeadFormEnabledLabel(f.enabled)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {f.updated_at ? new Date(f.updated_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => selectForm(f.id)}
                          className="text-xs font-bold text-indigo-600 hover:underline"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        )}
      </div>
    </div>
  );

  const renderReadinessCard = () => {
    if (readinessState === "loading" || readinessState === "idle") {
      return <p className="text-xs text-gray-400 italic">Consultando disponibilidad...</p>;
    }
    if (readinessState === "forbidden") {
      return <p className="text-xs text-red-600 font-semibold">No tienes permiso para consultar la disponibilidad.</p>;
    }
    if (readinessState === "error") {
      return (
        <div className="flex items-center gap-2">
          <p className="text-xs text-red-600 font-semibold">No se pudo consultar la disponibilidad.</p>
          <button onClick={() => selectedFormId !== null && loadReadiness(selectedFormId)} className="text-xs font-bold text-indigo-600 hover:underline">
            Reintentar
          </button>
        </div>
      );
    }
    if (!readiness) return null;

    const status = getPublicLeadFormReadinessStatus(readiness);
    const statusStyles: Record<string, string> = {
      published: "bg-green-50 text-green-700 border-green-200",
      ready_to_publish: "bg-blue-50 text-blue-700 border-blue-200",
      needs_configuration: "bg-amber-50 text-amber-700 border-amber-200",
      global_intake_disabled: "bg-gray-100 text-gray-700 border-gray-300",
      paused: "bg-gray-100 text-gray-600 border-gray-200",
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyles[status.key]}`}>
            {status.key === "published" && <CheckCircle2 size={13} />}
            {status.key === "needs_configuration" && <AlertTriangle size={13} />}
            {status.key === "global_intake_disabled" && <XCircle size={13} />}
            {status.label}
          </span>
          <button
            onClick={() => selectedFormId !== null && loadReadiness(selectedFormId)}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
          >
            <RefreshCw size={12} /> Refrescar
          </button>
        </div>
        {readiness.blocking_condition && (
          <p data-testid="readiness-blocking-message" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            {getCodeMessage(readiness.blocking_condition.code, readiness.blocking_condition.message)}
          </p>
        )}
      </div>
    );
  };

  const renderDetail = () => (
    <div className="w-full lg:w-[420px] bg-white border rounded-xl shadow-lg flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <h4 className="font-bold text-gray-800 flex items-center gap-2">
          <FileText size={18} className="text-indigo-600" />
          {selectedForm?.name ?? "Formulario"}
        </h4>
        <button onClick={closeDetail} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500">
          <XCircle size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {(detailState === "loading" || detailState === "idle") && renderLoading()}
        {detailState === "forbidden" && renderForbidden()}
        {detailState === "error" && renderError(() => selectedFormId !== null && loadDetail(selectedFormId))}

        {detailState === "success" && selectedForm && (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 font-bold uppercase block">Key</span>
                <span className="font-mono">{selectedForm.key}</span>
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase block">Sucursal</span>
                {selectedForm.branch?.name ?? `#${selectedForm.branch_id}`}
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 font-bold uppercase block">Orígenes permitidos</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedForm.allowed_origins.length === 0 ? (
                    <span className="italic text-gray-400">Ninguno</span>
                  ) : (
                    selectedForm.allowed_origins.map((o) => (
                      <span key={o} className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        {o}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase block">Creado por</span>
                {selectedForm.created_by?.name ?? <span className="italic text-gray-400">No disponible</span>}
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase block">Última edición</span>
                {selectedForm.updated_by?.name ?? <span className="italic text-gray-400">No disponible</span>}
              </div>
            </div>

            <hr className="border-gray-100" />

            <div>
              <span className="text-gray-400 font-bold uppercase text-xs block mb-1.5">Disponibilidad</span>
              {renderReadinessCard()}
            </div>

            {actionError && (
              <p role="alert" className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                {actionError}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {canManage && (
                <button
                  onClick={openEditModal}
                  disabled={selectedForm.enabled}
                  title={selectedForm.enabled ? "Pausa el formulario para poder editarlo." : undefined}
                  className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pencil size={14} /> Editar
                </button>
              )}

              {canPublish && !readiness?.published && (
                <button
                  onClick={handlePublish}
                  disabled={publishing || readiness?.activatable !== true}
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle size={14} /> {publishing ? "Publicando..." : "Publicar"}
                </button>
              )}

              {canManage && selectedForm.enabled && (
                <button
                  onClick={() => setPauseConfirmOpen(true)}
                  className="flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-200 py-2 rounded-lg text-xs font-bold hover:bg-red-100"
                >
                  <PauseCircle size={14} /> Pausar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="text-indigo-600" size={26} />
            Formularios Web
          </h2>
          <p className="text-gray-500 font-medium text-sm">
            Administra el ciclo de vida de tus formularios de captación pública.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <Plus size={18} /> Nuevo formulario
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <div className="flex flex-col lg:flex-row gap-6">
          {renderList()}
          {selectedFormId !== null && renderDetail()}
        </div>
      </div>

      <PublicLeadFormEditorModal
        isOpen={editorOpen}
        mode={editorMode}
        formToEdit={editorMode === "edit" ? selectedForm : null}
        onClose={() => setEditorOpen(false)}
        onSuccess={handleEditorSuccess}
      />

      {pauseConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-2">Pausar formulario</h2>
            <p className="text-sm text-gray-600 mb-6">
              El formulario dejará de aceptar envíos públicos hasta que vuelvas a publicarlo. ¿Confirmas la pausa?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPauseConfirmOpen(false)}
                disabled={pausing}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm"
              >
                Volver
              </button>
              <button
                onClick={handlePause}
                disabled={pausing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                {pausing ? "Pausando..." : "Confirmar pausa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicLeadForms;
