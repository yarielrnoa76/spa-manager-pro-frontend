import React from "react";
import N8nConnectionsSection from "../components/integrations/N8nConnectionsSection";

/**
 * Configuration -> Integrations (SuperAdmin only, global — not tenant-scoped). n8n is the
 * only integration today; this wrapper exists so a second one (e.g. a future global OpenAI
 * or Chatwoot section) has somewhere to attach without reshaping Settings.tsx again.
 *
 * isSuperAdmin is re-checked here (not just at the Settings.tsx tab-gate level) so this
 * component is never silently reachable if it's ever rendered from anywhere else later —
 * mirrors NotificationsSettings' own defensive re-check. The real enforcement is always the
 * backend's 'superadmin' middleware; this is UI-only, matching every other page in the app.
 */
const IntegrationsSettings: React.FC<{ isSuperAdmin?: boolean }> = ({ isSuperAdmin }) => {
  if (!isSuperAdmin) {
    return <div className="p-4 text-center text-gray-500">Acceso denegado. Solo administradores.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Integraciones</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configuración global de integraciones de la plataforma, compartida por todos los tenants.
        </p>
      </div>

      <N8nConnectionsSection />
    </div>
  );
};

export default IntegrationsSettings;
