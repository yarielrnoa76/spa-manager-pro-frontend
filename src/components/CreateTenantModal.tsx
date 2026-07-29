import React, { useState } from "react";
import { api, ApiError } from "../services/api";
import {
  Tenant,
  CreateTenantPayload,
  TenantSalesMode,
  TenantPaymentPolicy,
  DownPaymentType,
  TenantStatus,
} from "../types";
import { Building2, X, Globe, User, MapPin, Settings2 } from "lucide-react";
import { SectionHeader, TextField } from "./tenant/TenantFormFields";
import { EMAIL_RE, buildAddressPayload } from "./tenant/tenantPayloadHelpers";

/** Browser timezone, falling back to America/New_York if unavailable or empty. */
function resolveDefaultTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.trim() ? tz : "America/New_York";
  } catch {
    return "America/New_York";
  }
}

type FieldErrors = Record<string, string>;

const CreateTenantModal: React.FC<{
  onClose: () => void;
  onCreated: (tenant: Tenant) => void;
}> = ({ onClose, onCreated }) => {
  // Identidad del negocio
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<TenantStatus>("active");

  // Perfil del Tenant
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [timezone, setTimezone] = useState(resolveDefaultTimezone());
  const [currency, setCurrency] = useState("USD");
  const [locale, setLocale] = useState("");
  const [countryCode, setCountryCode] = useState("US");

  // Contacto principal
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPhoneExtension, setContactPhoneExtension] = useState("");

  // Dirección (opcional)
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCountryCode, setAddressCountryCode] = useState("");

  // Configuración comercial
  const [salesMode, setSalesMode] = useState<TenantSalesMode>("grouped_sale");
  const [paymentPolicy, setPaymentPolicy] = useState<TenantPaymentPolicy>("full_balance");
  const [downPaymentType, setDownPaymentType] = useState<DownPaymentType>("percentage");
  const [downPaymentValue, setDownPaymentValue] = useState("");

  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!name.trim()) errors["name"] = "El nombre es obligatorio.";
    if (!tradeName.trim()) errors["trade_name"] = "El nombre comercial es obligatorio.";
    if (!timezone.trim()) errors["timezone"] = "La zona horaria es obligatoria.";
    if (!currency.trim()) errors["currency"] = "La moneda es obligatoria.";
    if (countryCode.trim().length !== 2) errors["country_code"] = "Debe tener exactamente 2 caracteres (ISO).";

    if (!contactFirstName.trim()) errors["contact.first_name"] = "El nombre del contacto es obligatorio.";
    if (!contactLastName.trim()) errors["contact.last_name"] = "El apellido del contacto es obligatorio.";
    if (!contactEmail.trim()) {
      errors["contact.email"] = "El email del contacto es obligatorio.";
    } else if (!EMAIL_RE.test(contactEmail.trim())) {
      errors["contact.email"] = "Formato de email inválido.";
    }

    if (businessEmail.trim() && !EMAIL_RE.test(businessEmail.trim())) {
      errors["business_email"] = "Formato de email inválido.";
    }
    if (billingEmail.trim() && !EMAIL_RE.test(billingEmail.trim())) {
      errors["billing_email"] = "Formato de email inválido.";
    }

    if (addressCountryCode.trim() && addressCountryCode.trim().length !== 2) {
      errors["address.country_code"] = "Debe tener exactamente 2 caracteres (ISO).";
    }

    if (paymentPolicy === "down_payment") {
      const value = Number(downPaymentValue);
      if (!downPaymentValue.trim() || Number.isNaN(value) || value <= 0) {
        errors["settings.down_payment_value"] = "Ingresa un valor de anticipo válido.";
      } else if (downPaymentType === "percentage" && value > 100) {
        errors["settings.down_payment_value"] = "El porcentaje debe ser mayor que 0 y menor o igual a 100.";
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setGeneralError(null);
      return;
    }

    setFieldErrors({});
    setGeneralError(null);
    setSaving(true);

    const address = buildAddressPayload({
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city: addressCity,
      state: addressState,
      postal_code: addressPostalCode,
      country_code: addressCountryCode,
    });

    const payload: CreateTenantPayload = {
      name: name.trim(),
      ...(slug.trim() ? { slug: slug.trim() } : {}),
      status,
      legal_name: legalName.trim() || null,
      trade_name: tradeName.trim(),
      business_email: businessEmail.trim() || null,
      billing_email: billingEmail.trim() || null,
      business_phone: businessPhone.trim() || null,
      website: website.trim() || null,
      timezone: timezone.trim(),
      currency: currency.trim(),
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
      settings: {
        sales_mode: salesMode,
        payment_policy: paymentPolicy,
        down_payment_type: paymentPolicy === "down_payment" ? downPaymentType : null,
        down_payment_value: paymentPolicy === "down_payment" ? Number(downPaymentValue) : null,
      },
    };

    try {
      const tenant = await api.createTenant(payload);
      onCreated(tenant);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const mapped: FieldErrors = {};
        Object.entries(err.errors ?? {}).forEach(([key, messages]) => {
          if (messages && messages.length > 0) mapped[key] = messages[0];
        });
        setFieldErrors(mapped);
        setGeneralError(Object.keys(mapped).length > 0 ? null : err.message || "Validation failed.");
      } else if (err instanceof ApiError) {
        setGeneralError(err.message || "No se pudo crear el tenant.");
      } else {
        setGeneralError("No se pudo crear el tenant. Verifica tu conexión e intenta de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 size={22} className="text-indigo-600" />
            Crear Tenant
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {generalError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {generalError}
              </div>
            )}

            {/* Identidad del negocio */}
            <div className="space-y-3">
              <SectionHeader icon={Building2} title="Identidad del negocio" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextField
                  label="Nombre"
                  required
                  value={name}
                  onChange={(v) => {
                    setName(v);
                    clearFieldError("name");
                  }}
                  error={fieldErrors["name"]}
                  placeholder="Ej: AVA Day Spa"
                />
                <TextField label="Slug" value={slug} onChange={setSlug} placeholder="auto-generado" />
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TenantStatus)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm bg-white"
                  >
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Perfil del Tenant */}
            <div className="space-y-3">
              <SectionHeader icon={Globe} title="Perfil del Tenant" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  label="Nombre comercial"
                  required
                  value={tradeName}
                  onChange={(v) => {
                    setTradeName(v);
                    clearFieldError("trade_name");
                  }}
                  error={fieldErrors["trade_name"]}
                  placeholder="Ej: AVA Spa"
                />
                <TextField label="Razón social" value={legalName} onChange={setLegalName} placeholder="Ej: AVA Spa LLC" />
                <TextField
                  label="Email de negocio"
                  type="email"
                  value={businessEmail}
                  onChange={(v) => {
                    setBusinessEmail(v);
                    clearFieldError("business_email");
                  }}
                  error={fieldErrors["business_email"]}
                  placeholder="contacto@negocio.com"
                />
                <TextField
                  label="Email de facturación"
                  type="email"
                  value={billingEmail}
                  onChange={(v) => {
                    setBillingEmail(v);
                    clearFieldError("billing_email");
                  }}
                  error={fieldErrors["billing_email"]}
                  placeholder="facturacion@negocio.com"
                />
                <TextField label="Teléfono" value={businessPhone} onChange={setBusinessPhone} placeholder="+1 555 123 4567" />
                <TextField label="Sitio web" type="url" value={website} onChange={setWebsite} placeholder="https://negocio.com" />
                <TextField
                  label="Zona horaria"
                  required
                  value={timezone}
                  onChange={(v) => {
                    setTimezone(v);
                    clearFieldError("timezone");
                  }}
                  error={fieldErrors["timezone"]}
                  placeholder="America/New_York"
                />
                <TextField
                  label="Moneda"
                  required
                  value={currency}
                  onChange={(v) => {
                    setCurrency(v);
                    clearFieldError("currency");
                  }}
                  error={fieldErrors["currency"]}
                  placeholder="USD"
                />
                <TextField label="Idioma / Locale" value={locale} onChange={setLocale} placeholder="en, es..." />
                <TextField
                  label="País"
                  required
                  value={countryCode}
                  onChange={(v) => {
                    setCountryCode(v.toUpperCase());
                    clearFieldError("country_code");
                  }}
                  error={fieldErrors["country_code"]}
                  placeholder="US"
                  maxLength={2}
                />
              </div>
            </div>

            {/* Contacto principal */}
            <div className="space-y-3">
              <SectionHeader icon={User} title="Contacto principal" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  label="Nombre"
                  required
                  value={contactFirstName}
                  onChange={(v) => {
                    setContactFirstName(v);
                    clearFieldError("contact.first_name");
                  }}
                  error={fieldErrors["contact.first_name"]}
                  placeholder="Ada"
                />
                <TextField
                  label="Apellido"
                  required
                  value={contactLastName}
                  onChange={(v) => {
                    setContactLastName(v);
                    clearFieldError("contact.last_name");
                  }}
                  error={fieldErrors["contact.last_name"]}
                  placeholder="Lovelace"
                />
                <TextField label="Cargo" value={contactJobTitle} onChange={setContactJobTitle} placeholder="Ej: Gerente General" />
                <TextField
                  label="Email"
                  required
                  type="email"
                  value={contactEmail}
                  onChange={(v) => {
                    setContactEmail(v);
                    clearFieldError("contact.email");
                  }}
                  error={fieldErrors["contact.email"]}
                  placeholder="ada@negocio.com"
                />
                <TextField label="Teléfono" value={contactPhone} onChange={setContactPhone} placeholder="+1 555 123 4567" />
                <TextField label="Extensión" value={contactPhoneExtension} onChange={setContactPhoneExtension} placeholder="Ej: 101" />
              </div>
            </div>

            {/* Dirección (opcional) */}
            <div className="space-y-3">
              <SectionHeader icon={MapPin} title="Dirección (opcional)" />
              <p className="text-xs text-gray-400 -mt-1">Déjala en blanco si no deseas registrar una dirección todavía.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="Línea 1" value={addressLine1} onChange={setAddressLine1} placeholder="123 Main St" />
                <TextField label="Línea 2" value={addressLine2} onChange={setAddressLine2} placeholder="Suite 100" />
                <TextField label="Ciudad" value={addressCity} onChange={setAddressCity} placeholder="Miami" />
                <TextField label="Estado / Provincia" value={addressState} onChange={setAddressState} placeholder="FL" />
                <TextField label="Código postal" value={addressPostalCode} onChange={setAddressPostalCode} placeholder="33101" />
                <TextField
                  label="País de la dirección"
                  value={addressCountryCode}
                  onChange={(v) => {
                    setAddressCountryCode(v.toUpperCase());
                    clearFieldError("address.country_code");
                  }}
                  error={fieldErrors["address.country_code"]}
                  placeholder="US"
                  maxLength={2}
                />
              </div>
            </div>

            {/* Configuración comercial */}
            <div className="space-y-3">
              <SectionHeader icon={Settings2} title="Configuración comercial" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modo de venta *</label>
                  <select
                    value={salesMode}
                    onChange={(e) => setSalesMode(e.target.value as TenantSalesMode)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm bg-white"
                  >
                    <option value="grouped_sale">Venta agrupada</option>
                    <option value="independent_sales">Ventas independientes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Política de pago *</label>
                  <select
                    value={paymentPolicy}
                    onChange={(e) => {
                      const value = e.target.value as TenantPaymentPolicy;
                      setPaymentPolicy(value);
                      clearFieldError("settings.down_payment_value");
                      clearFieldError("settings.down_payment_type");
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm bg-white"
                  >
                    <option value="full_balance">Pago completo</option>
                    <option value="down_payment">Anticipo</option>
                  </select>
                </div>
                {paymentPolicy === "down_payment" && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de anticipo *</label>
                      <select
                        value={downPaymentType}
                        onChange={(e) => {
                          setDownPaymentType(e.target.value as DownPaymentType);
                          clearFieldError("settings.down_payment_value");
                        }}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm bg-white"
                      >
                        <option value="percentage">Porcentaje</option>
                        <option value="fixed">Monto fijo</option>
                      </select>
                    </div>
                    <TextField
                      label={downPaymentType === "percentage" ? "Valor del anticipo (%)" : "Valor del anticipo"}
                      required
                      type="number"
                      value={downPaymentValue}
                      onChange={(v) => {
                        setDownPaymentValue(v);
                        clearFieldError("settings.down_payment_value");
                      }}
                      error={fieldErrors["settings.down_payment_value"]}
                      placeholder={downPaymentType === "percentage" ? "25" : "50"}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50/80 flex-shrink-0">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
              >
                {saving ? "Creando…" : "Crear Tenant"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTenantModal;
