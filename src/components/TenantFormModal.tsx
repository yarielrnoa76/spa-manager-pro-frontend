import React, { useEffect, useState } from "react";
import { api, ApiError } from "../services/api";
import {
  Tenant,
  TenantStatus,
  TenantSalesMode,
  TenantPaymentPolicy,
  DownPaymentType,
  UpdateTenantProfilePayload,
  N8nConnection,
} from "../types";
import ChatwootConfigTab from "./ChatwootConfigTab";
import {
  Building2,
  X,
  Shield,
  RefreshCw as RetryIcon,
  MessageSquare,
  Link2,
  Globe,
  MapPin,
  User as UserIcon,
  Settings2,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { SectionHeader, TextField, SelectField, MaskedInput } from "./tenant/TenantFormFields";
import { TimezoneSelect } from "./tenant/TimezoneSelect";
import { EMAIL_RE, buildAddressPayload, normalizeWebsiteUrl } from "./tenant/tenantPayloadHelpers";

type Tab = "profile" | "sales" | "payment" | "n8n" | "chatwoot";

type FieldErrors = Record<string, string>;

/** Maps an ApiError (422 or general) onto field-level + general error state for one section. */
function applySectionError(
  err: unknown,
  setFieldErrors: (e: FieldErrors) => void,
  setGeneralError: (m: string | null) => void,
) {
  if (err instanceof ApiError && err.status === 422) {
    const mapped: FieldErrors = {};
    Object.entries(err.errors ?? {}).forEach(([key, messages]) => {
      if (messages && messages.length > 0) mapped[key] = messages[0];
    });
    setFieldErrors(mapped);
    setGeneralError(Object.keys(mapped).length > 0 ? null : err.message || "Validation failed.");
  } else if (err instanceof ApiError) {
    setFieldErrors({});
    setGeneralError(err.message || "No se pudo guardar esta sección.");
  } else {
    setFieldErrors({});
    setGeneralError("No se pudo guardar esta sección. Verifica tu conexión e intenta de nuevo.");
  }
}

const TenantFormModal: React.FC<{
  tenant: Tenant;
  onClose: () => void;
  onTenantUpdated: (tenant: Tenant) => void;
}> = ({ tenant, onClose, onTenantUpdated }) => {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // ── Identidad (existing, unchanged fields/flow) ──
  const [name, setName] = useState(tenant.name || "");
  const [slug, setSlug] = useState(tenant.slug || "");
  const [status, setStatus] = useState<TenantStatus>(tenant.status || "active");

  // ── Integraciones N8N (existing, unchanged fields) ──
  const [tenantApiToken, setTenantApiToken] = useState(tenant.tenant_api_token || "");
  const [n8nApiKey, setN8nApiKey] = useState(tenant.n8n_api_key || "");
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(tenant.n8n_webhook_url || "");

  // ── Conexión n8n administrada (global N8nConnection assignment) ── seeded strictly from
  // tenant.n8n_connection_id -- never from any connection's is_default flag. That flag is only
  // a suggested starting point for the create/edit form in N8nConnectionsSection, never an
  // implicit fallback a tenant should inherit automatically.
  const [n8nConnectionId, setN8nConnectionId] = useState<number | null>(tenant.n8n_connection_id ?? null);
  const [n8nConnections, setN8nConnections] = useState<N8nConnection[]>([]);
  const [n8nConnectionsLoading, setN8nConnectionsLoading] = useState(false);

  // ── Integraciones Chatwoot (existing, unchanged fields) ──
  const [chatwootBaseUrl, setChatwootBaseUrl] = useState(tenant.chatwoot_base_url || "");
  const [chatwootApiToken, setChatwootApiToken] = useState(tenant.chatwoot_api_token || "");
  const [chatwootAccountId, setChatwootAccountId] = useState(tenant.chatwoot_account_id || "");
  const [chatwootInboxId, setChatwootInboxId] = useState(tenant.chatwoot_inbox_id || "");

  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // ── Perfil comercial (already present on the list's tenant object — every Tenant model
  //    column is returned by tenantWithMaskedCredentials(), so these seed immediately) ──
  const [legalName, setLegalName] = useState(tenant.legal_name ?? "");
  const [tradeName, setTradeName] = useState(tenant.trade_name ?? "");
  const [businessEmail, setBusinessEmail] = useState(tenant.business_email ?? "");
  const [billingEmail, setBillingEmail] = useState(tenant.billing_email ?? "");
  const [businessPhone, setBusinessPhone] = useState(tenant.business_phone ?? "");
  const [website, setWebsite] = useState(tenant.website ?? "");
  const [timezone, setTimezone] = useState(tenant.timezone ?? "");
  const [currency, setCurrency] = useState(tenant.currency ?? "");
  const [locale, setLocale] = useState(tenant.locale ?? "");
  const [countryCode, setCountryCode] = useState(tenant.country_code ?? "");

  // ── Dirección / Contacto / Ventas / Pagos — NOT present on the list's tenant object; start
  //    blank and are populated once the scoped fetch below resolves ──
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCountryCode, setAddressCountryCode] = useState("");

  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPhoneExtension, setContactPhoneExtension] = useState("");

  const [ownerName, setOwnerName] = useState(tenant.owner?.name ?? "");
  const [ownerEmail, setOwnerEmail] = useState(tenant.owner?.email ?? "");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPasswordConfirmation, setOwnerPasswordConfirmation] = useState("");
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  const [salesMode, setSalesMode] = useState<TenantSalesMode>("grouped_sale");
  const [paymentPolicy, setPaymentPolicy] = useState<TenantPaymentPolicy>("full_balance");
  const [downPaymentType, setDownPaymentType] = useState<DownPaymentType>("percentage");
  const [downPaymentValue, setDownPaymentValue] = useState("");

  const [loadingExtras, setLoadingExtras] = useState(true);
  const [loadExtrasError, setLoadExtrasError] = useState<string | null>(null);
  const [loadToken, setLoadToken] = useState(0);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileGeneralError, setProfileGeneralError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<FieldErrors>({});

  const [salesSaving, setSalesSaving] = useState(false);
  const [salesGeneralError, setSalesGeneralError] = useState<string | null>(null);
  const [salesFieldErrors, setSalesFieldErrors] = useState<FieldErrors>({});

  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentGeneralError, setPaymentGeneralError] = useState<string | null>(null);
  const [paymentFieldErrors, setPaymentFieldErrors] = useState<FieldErrors>({});

  const anySaving = identitySaving || profileSaving || salesSaving || paymentSaving;

  // Loads address/contact/settings (never on the list's tenant object) for THIS tenant
  // specifically, via a per-request X-Tenant-ID override — never touches localStorage, never
  // changes the SuperAdmin's globally-selected tenant, no reload involved.
  useEffect(() => {
    let cancelled = false;
    setLoadingExtras(true);
    setLoadExtrasError(null);

    api
      .getTenantProfile(tenant.id)
      .then((full) => {
        if (cancelled) return;
        setAddressLine1(full.address?.address_line_1 ?? "");
        setAddressLine2(full.address?.address_line_2 ?? "");
        setAddressCity(full.address?.city ?? "");
        setAddressState(full.address?.state ?? "");
        setAddressPostalCode(full.address?.postal_code ?? "");
        setAddressCountryCode(full.address?.country_code ?? "");

        setContactFirstName(full.contact?.first_name ?? "");
        setContactLastName(full.contact?.last_name ?? "");
        setContactJobTitle(full.contact?.job_title ?? "");
        setContactEmail(full.contact?.email ?? "");
        setContactPhone(full.contact?.phone ?? "");
        setContactPhoneExtension(full.contact?.phone_extension ?? "");

        setOwnerName(full.owner?.name ?? "");
        setOwnerEmail(full.owner?.email ?? "");

        setSalesMode(full.settings?.sales_mode ?? "grouped_sale");
        setPaymentPolicy(full.settings?.payment_policy ?? "full_balance");
        setDownPaymentType(full.settings?.down_payment_type ?? "percentage");
        setDownPaymentValue(
          full.settings?.down_payment_value != null ? String(full.settings.down_payment_value) : "",
        );

        // Re-sync profile fields too, in case they changed since the list was fetched.
        setLegalName(full.legal_name ?? "");
        setTradeName(full.trade_name ?? "");
        setBusinessEmail(full.business_email ?? "");
        setBillingEmail(full.billing_email ?? "");
        setBusinessPhone(full.business_phone ?? "");
        setWebsite(full.website ?? "");
        setTimezone(full.timezone ?? "");
        setCurrency(full.currency ?? "");
        setLocale(full.locale ?? "");
        setCountryCode(full.country_code ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "No se pudo cargar la información completa del tenant.";
        setLoadExtrasError(message);
      })
      .finally(() => {
        if (!cancelled) setLoadingExtras(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenant.id, loadToken]);

  // ── Global n8n connections, for the "Conexión n8n administrada" selector ── independent of
  // the profile-extras fetch above: this is platform-level data (Configuration -> Integrations
  // -> n8n), not per-tenant, so it doesn't need tenantIdOverride and never resets when the
  // tenant's own extras reload.
  useEffect(() => {
    let cancelled = false;
    setN8nConnectionsLoading(true);

    api
      .listN8nConnections()
      .then((connections) => {
        if (!cancelled) setN8nConnections(connections);
      })
      .catch(() => {
        // Non-fatal: the selector degrades to "no connections available" rather than blocking
        // the rest of the modal.
      })
      .finally(() => {
        if (!cancelled) setN8nConnectionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Only meaningful when it resolves to an INACTIVE connection -- that's the one case the UI
  // must surface explicitly (see the n8n tab below) rather than silently reflect.
  const assignedN8nConnection = n8nConnections.find((c) => c.id === n8nConnectionId) ?? null;

  const clearProfileFieldError = (key: string) => {
    setProfileFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearPaymentFieldError = (key: string) => {
    setPaymentFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ================= Identidad + Integraciones (PUT /api/tenants/{tenant}) =================

  const handleSaveIdentity = async () => {
    if (identitySaving || !name.trim()) return;
    setIdentitySaving(true);
    setIdentityError(null);
    try {
      const payload: Partial<Tenant> = {
        name, slug: slug || undefined, status,
        tenant_api_token: tenantApiToken || undefined,
        n8n_api_key: n8nApiKey || undefined,
        n8n_webhook_url: n8nWebhookUrl.trim() || null,
        n8n_connection_id: n8nConnectionId,
        chatwoot_base_url: chatwootBaseUrl.trim() || null,
        chatwoot_api_token: chatwootApiToken || undefined,
        chatwoot_account_id: chatwootAccountId.trim() || null,
        chatwoot_inbox_id: chatwootInboxId.trim() || null,
      };
      const updated = await api.updateTenant(tenant.id, payload);
      onTenantUpdated(updated);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "No se pudieron guardar los cambios.";
      setIdentityError(message);
    } finally {
      setIdentitySaving(false);
    }
  };

  // ================= Perfil + Dirección + Contacto (PATCH /api/tenant/profile) =================

  const validateProfile = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!tradeName.trim()) errors["trade_name"] = "El nombre comercial es obligatorio.";
    if (!timezone.trim()) errors["timezone"] = "La zona horaria es obligatoria.";
    if (!currency.trim()) errors["currency"] = "La moneda es obligatoria.";
    if (countryCode.trim().length !== 2) errors["country_code"] = "Debe tener exactamente 2 caracteres (ISO).";
    if (businessEmail.trim() && !EMAIL_RE.test(businessEmail.trim())) {
      errors["business_email"] = "Formato de email inválido.";
    }
    if (billingEmail.trim() && !EMAIL_RE.test(billingEmail.trim())) {
      errors["billing_email"] = "Formato de email inválido.";
    }
    if (addressCountryCode.trim() && addressCountryCode.trim().length !== 2) {
      errors["address.country_code"] = "Debe tener exactamente 2 caracteres (ISO).";
    }
    if (!contactFirstName.trim()) errors["contact.first_name"] = "El nombre del contacto es obligatorio.";
    if (!contactLastName.trim()) errors["contact.last_name"] = "El apellido del contacto es obligatorio.";
    if (!contactEmail.trim()) {
      errors["contact.email"] = "El email del contacto es obligatorio.";
    } else if (!EMAIL_RE.test(contactEmail.trim())) {
      errors["contact.email"] = "Formato de email inválido.";
    }

    if (ownerName.trim() || ownerEmail.trim() || ownerPassword.trim()) {
      if (!ownerName.trim()) errors["owner.name"] = "El nombre del usuario principal es obligatorio.";
      if (!ownerEmail.trim()) {
        errors["owner.email"] = "El email del usuario principal es obligatorio.";
      } else if (!EMAIL_RE.test(ownerEmail.trim())) {
        errors["owner.email"] = "Formato de email inválido.";
      }
      if (ownerPassword) {
        if (ownerPassword.length < 8) {
          errors["owner.password"] = "Debe tener al menos 8 caracteres.";
        } else if (ownerPassword !== ownerPasswordConfirmation) {
          errors["owner.password"] = "Las contraseñas no coinciden.";
        }
      }
    }

    return errors;
  };

  const handleSaveProfile = async () => {
    if (profileSaving) return;
    const clientErrors = validateProfile();
    if (Object.keys(clientErrors).length > 0) {
      setProfileFieldErrors(clientErrors);
      setProfileGeneralError(null);
      return;
    }
    setProfileFieldErrors({});
    setProfileGeneralError(null);
    setProfileSaving(true);

    const address = buildAddressPayload({
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city: addressCity,
      state: addressState,
      postal_code: addressPostalCode,
      country_code: addressCountryCode,
    });

    const ownerPayload = (ownerName.trim() || ownerEmail.trim() || ownerPassword.trim()) ? {
      name: ownerName.trim(),
      email: ownerEmail.trim(),
      ...(ownerPassword.trim() ? { password: ownerPassword, password_confirmation: ownerPasswordConfirmation } : {}),
    } : undefined;

    const payload: UpdateTenantProfilePayload = {
      legal_name: legalName.trim() || null,
      trade_name: tradeName.trim(),
      business_email: businessEmail.trim() || null,
      billing_email: billingEmail.trim() || null,
      business_phone: businessPhone.trim() || null,
      website: normalizeWebsiteUrl(website),
      timezone: timezone.trim(),
      currency: currency.trim().toUpperCase(),
      locale: locale.trim() || null,
      country_code: countryCode.trim().toUpperCase(),
      ...(address ? { address } : {}),
      contact: {
        first_name: contactFirstName.trim(),
        last_name: contactLastName.trim(),
        job_title: contactJobTitle.trim() || null,
        email: contactEmail.trim(),
        phone: contactPhone.trim() || null,
        phone_extension: contactPhoneExtension.trim() || null,
      },
      ...(ownerPayload ? { owner: ownerPayload } : {}),
    };

    try {
      const updated = await api.updateTenantProfile(payload, tenant.id);
      setLegalName(updated.legal_name ?? "");
      setTradeName(updated.trade_name ?? "");
      setBusinessEmail(updated.business_email ?? "");
      setBillingEmail(updated.billing_email ?? "");
      setBusinessPhone(updated.business_phone ?? "");
      setWebsite(updated.website ?? "");
      setTimezone(updated.timezone ?? "");
      setCurrency(updated.currency ?? "");
      setLocale(updated.locale ?? "");
      setCountryCode(updated.country_code ?? "");
      setAddressLine1(updated.address?.address_line_1 ?? "");
      setAddressLine2(updated.address?.address_line_2 ?? "");
      setAddressCity(updated.address?.city ?? "");
      setAddressState(updated.address?.state ?? "");
      setAddressPostalCode(updated.address?.postal_code ?? "");
      setAddressCountryCode(updated.address?.country_code ?? "");
      setContactFirstName(updated.contact?.first_name ?? "");
      setContactLastName(updated.contact?.last_name ?? "");
      setContactJobTitle(updated.contact?.job_title ?? "");
      setContactEmail(updated.contact?.email ?? "");
      setContactPhone(updated.contact?.phone ?? "");
      setContactPhoneExtension(updated.contact?.phone_extension ?? "");
      if (updated.owner) {
        setOwnerName(updated.owner.name ?? "");
        setOwnerEmail(updated.owner.email ?? "");
        setOwnerPassword("");
        setOwnerPasswordConfirmation("");
      }
      onTenantUpdated(updated);
    } catch (err: unknown) {
      applySectionError(err, setProfileFieldErrors, setProfileGeneralError);
    } finally {
      setProfileSaving(false);
    }
  };

  // ================= Ventas (PATCH /api/tenant/sales-settings) =================

  const handleSaveSales = async () => {
    if (salesSaving) return;
    setSalesFieldErrors({});
    setSalesGeneralError(null);
    setSalesSaving(true);
    try {
      const updated = await api.updateTenantSalesSettings({ sales_mode: salesMode }, tenant.id);
      setSalesMode(updated.settings?.sales_mode ?? salesMode);
      onTenantUpdated(updated);
    } catch (err: unknown) {
      applySectionError(err, setSalesFieldErrors, setSalesGeneralError);
    } finally {
      setSalesSaving(false);
    }
  };

  // ================= Pagos (PATCH /api/tenant/payment-settings) =================

  const validatePayment = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (paymentPolicy === "down_payment") {
      const value = Number(downPaymentValue);
      if (!downPaymentValue.trim() || Number.isNaN(value) || value <= 0) {
        errors["down_payment_value"] = "Ingresa un valor de anticipo válido.";
      } else if (downPaymentType === "percentage" && value > 100) {
        errors["down_payment_value"] = "El porcentaje debe ser mayor que 0 y menor o igual a 100.";
      }
    }
    return errors;
  };

  const handleSavePayment = async () => {
    if (paymentSaving) return;
    const clientErrors = validatePayment();
    if (Object.keys(clientErrors).length > 0) {
      setPaymentFieldErrors(clientErrors);
      setPaymentGeneralError(null);
      return;
    }
    setPaymentFieldErrors({});
    setPaymentGeneralError(null);
    setPaymentSaving(true);
    try {
      const updated = await api.updateTenantPaymentSettings(
        {
          payment_policy: paymentPolicy,
          down_payment_type: paymentPolicy === "down_payment" ? downPaymentType : null,
          down_payment_value: paymentPolicy === "down_payment" ? Number(downPaymentValue) : null,
        },
        tenant.id,
      );
      setPaymentPolicy(updated.settings?.payment_policy ?? paymentPolicy);
      setDownPaymentType(updated.settings?.down_payment_type ?? "percentage");
      setDownPaymentValue(
        updated.settings?.down_payment_value != null ? String(updated.settings.down_payment_value) : "",
      );
      onTenantUpdated(updated);
    } catch (err: unknown) {
      applySectionError(err, setPaymentFieldErrors, setPaymentGeneralError);
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleClose = () => {
    if (anySaving) return;
    onClose();
  };

  const tabBtn = (tab: Tab, icon: React.ReactNode, label: string, configured?: boolean) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-bold transition-all ${
        activeTab === tab ? "bg-indigo-600 text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      <div className="flex-1">
        <div>{label}</div>
        {configured && activeTab !== tab && (
          <div className="text-[10px] font-medium opacity-70 mt-0.5">Configurado</div>
        )}
      </div>
    </button>
  );

  const n8nConfigured = !!(tenantApiToken && n8nApiKey);
  const cwConfigured = !!(chatwootBaseUrl && chatwootAccountId && chatwootInboxId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 size={22} className="text-indigo-600" />
            Editar Tenant
          </h2>
          <button
            onClick={handleClose}
            disabled={anySaving}
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        {/* Common Fields — always visible */}
        <div className="px-6 py-4 border-b bg-white flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField label="Nombre" required value={name} onChange={setName} placeholder="Ej: AVA Day Spa" />
            <TextField label="Slug" value={slug} onChange={setSlug} placeholder="auto-generado" />
            <SelectField
              label="Estado"
              value={status}
              onChange={(v) => setStatus(v as TenantStatus)}
              options={[
                { value: "active", label: "Activo" },
                { value: "suspended", label: "Suspendido" },
              ]}
            />
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <div className="w-52 border-r bg-gray-50/50 p-3 space-y-2 flex-shrink-0 overflow-y-auto">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">Negocio</div>
            {tabBtn("profile", <Globe size={18} />, "Perfil del negocio")}
            {tabBtn("sales", <Settings2 size={18} />, "Ventas")}
            {tabBtn("payment", <Settings2 size={18} />, "Pagos")}

            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2 mt-4">
              Integraciones
            </div>
            {tabBtn("n8n", <Link2 size={18} />, "N8N", n8nConfigured)}
            {tabBtn("chatwoot", <MessageSquare size={18} />, "Chatwoot", cwConfigured)}
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "profile" && (
              <div className="space-y-6">
                {loadingExtras ? (
                  <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                    Cargando información completa…
                  </div>
                ) : loadExtrasError ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={16} /> {loadExtrasError}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLoadToken((n) => n + 1)}
                      className="flex items-center gap-1 text-xs font-bold text-red-700 hover:underline flex-shrink-0"
                    >
                      <RetryIcon size={12} /> Reintentar
                    </button>
                  </div>
                ) : (
                  <>
                    {profileGeneralError && (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {profileGeneralError}
                      </div>
                    )}

                    <div className="space-y-3">
                      <SectionHeader icon={Globe} title="Perfil comercial" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField
                          label="Nombre comercial"
                          required
                          value={tradeName}
                          onChange={(v) => { setTradeName(v); clearProfileFieldError("trade_name"); }}
                          error={profileFieldErrors["trade_name"]}
                        />
                        <TextField label="Razón social" value={legalName} onChange={setLegalName} />
                        <TextField
                          label="Email de negocio"
                          type="email"
                          value={businessEmail}
                          onChange={(v) => { setBusinessEmail(v); clearProfileFieldError("business_email"); }}
                          error={profileFieldErrors["business_email"]}
                        />
                        <TextField
                          label="Email de facturación"
                          type="email"
                          value={billingEmail}
                          onChange={(v) => { setBillingEmail(v); clearProfileFieldError("billing_email"); }}
                          error={profileFieldErrors["billing_email"]}
                        />
                        <TextField label="Teléfono" value={businessPhone} onChange={setBusinessPhone} />
                        <TextField label="Sitio web" type="url" value={website} onChange={setWebsite} placeholder="https://negocio.com" />
                        <TimezoneSelect
                          label="Zona horaria"
                          required
                          value={timezone}
                          onChange={(v) => { setTimezone(v); clearProfileFieldError("timezone"); }}
                          error={profileFieldErrors["timezone"]}
                        />
                        <TextField
                          label="Moneda"
                          required
                          value={currency}
                          onChange={(v) => { setCurrency(v.toUpperCase()); clearProfileFieldError("currency"); }}
                          error={profileFieldErrors["currency"]}
                          maxLength={3}
                        />
                        <TextField label="Idioma / Locale" value={locale} onChange={setLocale} />
                        <TextField
                          label="País"
                          required
                          value={countryCode}
                          onChange={(v) => { setCountryCode(v.toUpperCase()); clearProfileFieldError("country_code"); }}
                          error={profileFieldErrors["country_code"]}
                          maxLength={2}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <SectionHeader icon={MapPin} title="Dirección" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField label="Línea 1" value={addressLine1} onChange={setAddressLine1} />
                        <TextField label="Línea 2" value={addressLine2} onChange={setAddressLine2} />
                        <TextField label="Ciudad" value={addressCity} onChange={setAddressCity} />
                        <TextField label="Estado / Provincia" value={addressState} onChange={setAddressState} />
                        <TextField label="Código postal" value={addressPostalCode} onChange={setAddressPostalCode} />
                        <TextField
                          label="País de la dirección"
                          value={addressCountryCode}
                          onChange={(v) => { setAddressCountryCode(v.toUpperCase()); clearProfileFieldError("address.country_code"); }}
                          error={profileFieldErrors["address.country_code"]}
                          maxLength={2}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <SectionHeader icon={KeyRound} title="Usuario principal" />
                      <p className="text-xs text-gray-400 -mt-1">
                        Administrador principal del tenant. Deja la contraseña en blanco si no deseas cambiarla.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField
                          label="Nombre completo"
                          required
                          value={ownerName}
                          onChange={(v) => { setOwnerName(v); clearProfileFieldError("owner.name"); }}
                          error={profileFieldErrors["owner.name"]}
                        />
                        <TextField
                          label="Email"
                          required
                          type="email"
                          value={ownerEmail}
                          onChange={(v) => { setOwnerEmail(v); clearProfileFieldError("owner.email"); }}
                          error={profileFieldErrors["owner.email"]}
                        />
                        <TextField
                          label="Nueva contraseña (opcional)"
                          type={showOwnerPassword ? "text" : "password"}
                          value={ownerPassword}
                          onChange={(v) => { setOwnerPassword(v); clearProfileFieldError("owner.password"); }}
                          error={profileFieldErrors["owner.password"]}
                          placeholder="Mínimo 8 caracteres"
                        />
                        <TextField
                          label="Confirmar contraseña"
                          type={showOwnerPassword ? "text" : "password"}
                          value={ownerPasswordConfirmation}
                          onChange={(v) => { setOwnerPasswordConfirmation(v); clearProfileFieldError("owner.password"); }}
                          placeholder="Repite la clave"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showOwnerPassword}
                          onChange={(e) => setShowOwnerPassword(e.target.checked)}
                          className="w-3.5 h-3.5"
                        />
                        Mostrar contraseña
                      </label>
                    </div>

                    <div className="space-y-3">
                      <SectionHeader icon={UserIcon} title="Contacto principal" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField
                          label="Nombre"
                          required
                          value={contactFirstName}
                          onChange={(v) => { setContactFirstName(v); clearProfileFieldError("contact.first_name"); }}
                          error={profileFieldErrors["contact.first_name"]}
                        />
                        <TextField
                          label="Apellido"
                          required
                          value={contactLastName}
                          onChange={(v) => { setContactLastName(v); clearProfileFieldError("contact.last_name"); }}
                          error={profileFieldErrors["contact.last_name"]}
                        />
                        <TextField label="Cargo" value={contactJobTitle} onChange={setContactJobTitle} />
                        <TextField
                          label="Email"
                          required
                          type="email"
                          value={contactEmail}
                          onChange={(v) => { setContactEmail(v); clearProfileFieldError("contact.email"); }}
                          error={profileFieldErrors["contact.email"]}
                        />
                        <TextField label="Teléfono" value={contactPhone} onChange={setContactPhone} />
                        <TextField label="Extensión" value={contactPhoneExtension} onChange={setContactPhoneExtension} />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
                      >
                        {profileSaving ? "Guardando…" : "Guardar perfil"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "sales" && (
              <div className="space-y-4">
                <SectionHeader icon={Settings2} title="Configuración de ventas" />
                {salesGeneralError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {salesGeneralError}
                  </div>
                )}
                <SelectField
                  label="Modo de venta"
                  required
                  value={salesMode}
                  onChange={(v) => setSalesMode(v as TenantSalesMode)}
                  error={salesFieldErrors["sales_mode"]}
                  options={[
                    { value: "grouped_sale", label: "Venta agrupada" },
                    { value: "independent_sales", label: "Ventas independientes" },
                  ]}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSales}
                    disabled={salesSaving || loadingExtras}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
                  >
                    {salesSaving ? "Guardando…" : "Guardar ventas"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "payment" && (
              <div className="space-y-4">
                <SectionHeader icon={Settings2} title="Configuración de pagos" />
                {paymentGeneralError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {paymentGeneralError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectField
                    label="Política de pago"
                    required
                    value={paymentPolicy}
                    onChange={(v) => {
                      setPaymentPolicy(v as TenantPaymentPolicy);
                      clearPaymentFieldError("down_payment_value");
                      clearPaymentFieldError("down_payment_type");
                    }}
                    options={[
                      { value: "full_balance", label: "Pago completo" },
                      { value: "down_payment", label: "Anticipo" },
                    ]}
                  />
                  {paymentPolicy === "down_payment" && (
                    <>
                      <SelectField
                        label="Tipo de anticipo"
                        required
                        value={downPaymentType}
                        onChange={(v) => { setDownPaymentType(v as DownPaymentType); clearPaymentFieldError("down_payment_value"); }}
                        options={[
                          { value: "percentage", label: "Porcentaje" },
                          { value: "fixed", label: "Monto fijo" },
                        ]}
                      />
                      <TextField
                        label={downPaymentType === "percentage" ? "Valor del anticipo (%)" : "Valor del anticipo"}
                        required
                        type="number"
                        value={downPaymentValue}
                        onChange={(v) => { setDownPaymentValue(v); clearPaymentFieldError("down_payment_value"); }}
                        error={paymentFieldErrors["down_payment_value"]}
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePayment}
                    disabled={paymentSaving || loadingExtras}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
                  >
                    {paymentSaving ? "Guardando…" : "Guardar pagos"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "n8n" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <Shield size={16} className="text-indigo-600" /> Configuración N8N
                </h3>
                <MaskedInput
                  label="Tenant API Token (n8n → SPA)"
                  value={tenantApiToken}
                  onChange={setTenantApiToken}
                  placeholder="Clave para header X-API-KEY"
                  copyValue={tenant.tenant_api_token || ""}
                />
                <p className="text-[10px] text-gray-400 italic -mt-2">
                  Proporcione este token a n8n para autenticar las llamadas entrantes.
                </p>
                <MaskedInput
                  label="N8N API Key (SPA → n8n)"
                  value={n8nApiKey}
                  onChange={setN8nApiKey}
                  placeholder="API Key interna de n8n"
                  copyValue={tenant.n8n_api_key || ""}
                />
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    N8N Webhook URL (Salida)
                  </label>
                  <input
                    type="url"
                    value={n8nWebhookUrl}
                    onChange={(e) => setN8nWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                    placeholder="https://n8n.tudominio.com/webhook/..."
                  />
                </div>

                {/* Clearly separated from the three legacy fields above -- this is a
                    DIFFERENT credential class (the global n8n Management API instance this
                    tenant is administered through), not the tenant's own webhook secrets. */}
                <div className="border-t pt-4 mt-2">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
                    <Link2 size={16} className="text-indigo-600" /> Conexión n8n administrada
                  </h4>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Instancia global de n8n asignada explícitamente a este tenant. No se usa ninguna conexión
                    predeterminada automáticamente.
                  </p>
                  <select
                    aria-label="Conexión n8n administrada"
                    value={n8nConnectionId !== null ? String(n8nConnectionId) : ""}
                    onChange={(e) => setN8nConnectionId(e.target.value === "" ? null : Number(e.target.value))}
                    disabled={n8nConnectionsLoading}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">Sin conexión asignada</option>
                    {n8nConnections
                      .filter((c) => c.active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    {assignedN8nConnection && !assignedN8nConnection.active && (
                      <option value={assignedN8nConnection.id} disabled>
                        {assignedN8nConnection.name} (inactiva — asignación actual)
                      </option>
                    )}
                  </select>
                  {assignedN8nConnection && !assignedN8nConnection.active && (
                    <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                      <AlertTriangle size={12} className="shrink-0" />
                      La conexión asignada actualmente está inactiva. La asignación se conserva tal cual hasta
                      que elijas otra o la desasignes — nunca se cambia automáticamente.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "chatwoot" && (
              <ChatwootConfigTab
                baseUrl={chatwootBaseUrl}
                apiToken={chatwootApiToken}
                accountId={chatwootAccountId}
                inboxId={chatwootInboxId}
                onBaseUrlChange={setChatwootBaseUrl}
                onApiTokenChange={setChatwootApiToken}
                onAccountIdChange={setChatwootAccountId}
                onInboxIdChange={setChatwootInboxId}
                isEdit={true}
              />
            )}
          </div>
        </div>

        {/* Footer — saves Identidad + Integraciones (unchanged endpoint/payload) */}
        <div className="px-6 py-4 border-t bg-gray-50/80 flex-shrink-0">
          {identityError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {identityError}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={anySaving}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSaveIdentity}
              disabled={identitySaving || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
            >
              {identitySaving ? "Guardando…" : "Guardar identidad e integraciones"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantFormModal;
