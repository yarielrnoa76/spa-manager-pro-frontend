import React, { useState } from "react";
import N8nConnectionsSection from "../components/integrations/N8nConnectionsSection";
import ChatwootConnectionSettings from "../components/integrations/ChatwootConnectionSettings";
import WhatsappTemplatesSettings from "../components/integrations/WhatsappTemplatesSettings";

/**
 * Configuration -> Integrations.
 *
 * n8n stays SuperAdmin-only and global (unchanged) -- it is platform-level infrastructure, not
 * tied to any tenant.
 *
 * Chatwoot is split into two sections with different authorization boundaries, matching the
 * backend exactly:
 *  - Connection (health test / token rotation): SuperAdmin-only, and requires an active tenant
 *    context, mirroring TenantPolicy::update -- the same boundary that already governs editing
 *    chatwoot_api_token itself via the Tenant form. Not shown to regular tenant staff even
 *    read-only, since the backend would reject every call anyway.
 *  - WhatsApp Templates (list/sync/enable/disable/default): tenant-scoped and permission-gated
 *    (view_whatsapp_templates / manage_whatsapp_templates), reachable by tenant staff with that
 *    permission -- not limited to SuperAdmin. Reuses the tenant's existing Chatwoot
 *    configuration; this screen never introduces a second/parallel Chatwoot config.
 */
const IntegrationsSettings: React.FC<{
  isSuperAdmin?: boolean;
  currentTenantId?: number | null;
  canViewWhatsappTemplates?: boolean;
  canManageWhatsappTemplates?: boolean;
}> = ({ isSuperAdmin, currentTenantId, canViewWhatsappTemplates, canManageWhatsappTemplates }) => {
  // Bumped after a successful token rotation (which triggers an automatic template refresh
  // server-side) so the WhatsApp Templates table below reflects it without a manual re-sync.
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);

  if (!isSuperAdmin && !canViewWhatsappTemplates && !canManageWhatsappTemplates) {
    return <div className="p-4 text-center text-gray-500">Acceso denegado.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Integraciones</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configuración de integraciones de la plataforma y del tenant actual.
        </p>
      </div>

      {isSuperAdmin && <N8nConnectionsSection />}

      {isSuperAdmin && currentTenantId && (
        <ChatwootConnectionSettings
          tenantId={currentTenantId}
          onTokenRotated={() => setTemplatesRefreshKey((k) => k + 1)}
        />
      )}

      {(canViewWhatsappTemplates || canManageWhatsappTemplates) && (
        <WhatsappTemplatesSettings key={templatesRefreshKey} canManage={!!canManageWhatsappTemplates} />
      )}
    </div>
  );
};

export default IntegrationsSettings;
