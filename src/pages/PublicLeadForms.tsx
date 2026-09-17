import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, Routes, Route, Navigate } from "react-router-dom";
import { Plus, FileText, ChevronLeft, ChevronRight, ShieldAlert, WifiOff, Settings2 } from "lucide-react";
import { api, ApiError } from "../services/api";
import { PublicLeadForm } from "../types";
import { UserData } from "../App";
import PublicLeadFormEditorModal from "../components/PublicLeadFormEditorModal";
import PublicLeadFormConfigShell from "../components/FormBuilder/PublicLeadFormConfigShell";
import { getPublicLeadFormEnabledLabel } from "../utils/publicLeadFormPresentation";

type LoadState = "idle" | "loading" | "empty" | "forbidden" | "error" | "success";

const PER_PAGE = 15;

interface PublicLeadFormsProps {
  user: UserData | null;
}

/**
 * `Formularios Web` -- the single sidebar entry and route Form Builder B3 reuses (never a second
 * menu item, never a duplicated route). Two clearly separated concerns, both real routes so
 * deep-links and Back work: `/lead-forms` (Listado) and `/lead-forms/:id/*`
 * (Configuración, delegated to PublicLeadFormConfigShell for its own General/Campos/
 * Preview/Publicación sub-tabs). RBAC here is exclusively capability-driven -- never
 * `role.name` or `user.role` -- and SuperAdmin keeps the existing canonical bypass.
 */
const PublicLeadFormsList: React.FC<{
  user: UserData | null;
  onSelectForm: (id: number) => void;
}> = ({ user, onSelectForm }) => {
  const isSuperAdmin = user?.is_super_admin === true;
  const perms = useMemo<string[]>(() => (Array.isArray(user?.permissions) ? user!.permissions : []), [user]);
  const hasPerm = useCallback((p: string) => isSuperAdmin || perms.includes(p), [isSuperAdmin, perms]);
  const canManage = hasPerm("manage_public_lead_forms");

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList(page);
  }, [page, loadList]);

  const [editorOpen, setEditorOpen] = useState(false);

  const handleEditorSuccess = (form: PublicLeadForm) => {
    loadList(page);
    onSelectForm(form.id);
  };

  const renderLoading = () => <div className="p-12 text-center text-gray-500 animate-pulse font-bold">Cargando...</div>;

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
      <button onClick={onRetry} className="text-xs font-bold text-indigo-600 hover:underline">Reintentar</button>
    </div>
  );

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-end mb-4">
        {canManage && (
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <Plus size={18} /> Nuevo formulario
          </button>
        )}
      </div>

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
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Actualizado</th>
                    <th className="px-4 py-3">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {forms.map((f) => (
                    <tr key={f.id} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{f.name}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{f.key}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{f.branch?.name ?? `#${f.branch_id}`}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            f.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"
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
                          onClick={() => onSelectForm(f.id)}
                          className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline ml-auto"
                        >
                          <Settings2 size={13} /> Configurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          </>
        )}
      </div>

      <PublicLeadFormEditorModal
        isOpen={editorOpen}
        mode="create"
        formToEdit={null}
        onClose={() => setEditorOpen(false)}
        onSuccess={(form) => {
          setEditorOpen(false);
          handleEditorSuccess(form);
        }}
      />
    </div>
  );
};

const ConfigShellRoute: React.FC<{ user: UserData | null; onBack: () => void }> = ({ user, onBack }) => {
  const { id } = useParams<{ id: string }>();
  const formId = Number(id);

  const isSuperAdmin = user?.is_super_admin === true;
  const perms = useMemo<string[]>(() => (Array.isArray(user?.permissions) ? user!.permissions : []), [user]);
  const hasPerm = useCallback((p: string) => isSuperAdmin || perms.includes(p), [isSuperAdmin, perms]);

  if (!Number.isFinite(formId) || formId <= 0) {
    return <Navigate to=".." replace />;
  }

  return (
    <PublicLeadFormConfigShell
      formId={formId}
      canManage={hasPerm("manage_public_lead_forms")}
      canPublish={hasPerm("publish_public_lead_forms")}
      onBack={onBack}
    />
  );
};

const PublicLeadForms: React.FC<PublicLeadFormsProps> = ({ user }) => {
  const navigate = useNavigate();

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
      </header>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <Routes>
          <Route
            index
            element={<PublicLeadFormsList user={user} onSelectForm={(id) => navigate(`${id}/general`)} />}
          />
          <Route
            path=":id/*"
            element={<ConfigShellRoute user={user} onBack={() => navigate("..")} />}
          />
        </Routes>
      </div>
    </div>
  );
};

export default PublicLeadForms;
