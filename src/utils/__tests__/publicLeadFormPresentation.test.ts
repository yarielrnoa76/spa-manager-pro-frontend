import { describe, it, expect } from "vitest";
import { ApiError } from "../../services/api";
import type { PublicLeadFormReadiness } from "../../types";
import {
  getPublicLeadFormReadinessStatus,
  getPublicLeadFormEnabledLabel,
  getPublicLeadFormMutationErrorMessage,
  getCodeMessage,
  isValidPublicLeadFormKey,
  isValidAllowedOrigin,
  findDuplicateAllowedOriginIndex,
  PUBLIC_LEAD_FORM_CODE_MESSAGES,
} from "../publicLeadFormPresentation";

/**
 * Form Builder B2 — administrative control plane. `enabled` (persisted) and `published`
 * (effective public availability, gated additionally by the platform-wide master flag) are
 * never conflated -- these tests exercise every state the module distinguishes.
 */

const baseReadiness = (overrides: Partial<PublicLeadFormReadiness> = {}): PublicLeadFormReadiness => ({
  form_id: 1,
  form_uuid: "uuid-1",
  environment: "qa",
  form_enabled: false,
  master_enabled: true,
  prerequisites_ready: true,
  activatable: true,
  published: false,
  blocking_condition: null,
  ...overrides,
});

describe("getPublicLeadFormReadinessStatus", () => {
  it("returns 'Publicado' when published is true", () => {
    const status = getPublicLeadFormReadinessStatus(
      baseReadiness({ published: true, form_enabled: true }),
    );
    expect(status).toEqual({ key: "published", label: "Publicado" });
  });

  it("returns 'Listo para publicar' when paused and activatable", () => {
    const status = getPublicLeadFormReadinessStatus(
      baseReadiness({ form_enabled: false, activatable: true, published: false }),
    );
    expect(status).toEqual({ key: "ready_to_publish", label: "Listo para publicar" });
  });

  it("returns 'Requiere configuración' when a real prerequisite is blocking", () => {
    const status = getPublicLeadFormReadinessStatus(
      baseReadiness({
        prerequisites_ready: false,
        activatable: false,
        blocking_condition: { code: "TICKET_CATEGORY", message: "no active category" },
      }),
    );
    expect(status).toEqual({ key: "needs_configuration", label: "Requiere configuración" });
  });

  it("returns 'Captación global desactivada' only when the form itself is enabled and the master flag is off", () => {
    const status = getPublicLeadFormReadinessStatus(
      baseReadiness({
        form_enabled: true,
        master_enabled: false,
        activatable: false,
        published: false,
        blocking_condition: { code: "PUBLIC_WEB_INTAKE_DISABLED", message: "disabled" },
      }),
    );
    expect(status).toEqual({ key: "global_intake_disabled", label: "Captación global desactivada" });
  });

  it("returns 'Pausado' when the form is paused and only the master flag blocks activation", () => {
    const status = getPublicLeadFormReadinessStatus(
      baseReadiness({
        form_enabled: false,
        master_enabled: false,
        activatable: false,
        published: false,
        blocking_condition: { code: "PUBLIC_WEB_INTAKE_DISABLED", message: "disabled" },
      }),
    );
    expect(status).toEqual({ key: "paused", label: "Pausado" });
  });

  it("never treats enabled=true alone as proof of published", () => {
    // form_enabled true but master flag off -> NOT published, distinct from the enabled flag.
    const status = getPublicLeadFormReadinessStatus(
      baseReadiness({
        form_enabled: true,
        master_enabled: false,
        published: false,
        activatable: false,
        blocking_condition: { code: "PUBLIC_WEB_INTAKE_DISABLED", message: "disabled" },
      }),
    );
    expect(status.key).not.toBe("published");
  });
});

describe("getPublicLeadFormEnabledLabel", () => {
  it("maps enabled=true to Publicado and false to Pausado -- the list's own two-state label", () => {
    expect(getPublicLeadFormEnabledLabel(true)).toBe("Publicado");
    expect(getPublicLeadFormEnabledLabel(false)).toBe("Pausado");
  });
});

describe("getCodeMessage / PUBLIC_LEAD_FORM_CODE_MESSAGES — required Spanish messages", () => {
  const requiredCodes = [
    "TENANT",
    "BRANCH",
    "LEAD_SOURCE",
    "TICKET_CATEGORY",
    "TICKET_PRIORITY",
    "LEAD_NOTIFICATION_RECIPIENT",
    "ALLOWED_ORIGINS",
    "TURNSTILE_SECRET",
    "TRUSTED_PROXIES",
    "PUBLIC_WEB_INTAKE_DISABLED",
    "ENVIRONMENT_RESOLUTION_FAILED",
    "READINESS_CHECK_FAILED",
  ];

  it.each(requiredCodes)("has a non-empty Spanish message for %s", (code) => {
    expect(PUBLIC_LEAD_FORM_CODE_MESSAGES[code]).toBeTruthy();
    expect(typeof PUBLIC_LEAD_FORM_CODE_MESSAGES[code]).toBe("string");
  });

  it("states plainly for PUBLIC_WEB_INTAKE_DISABLED that this control plane cannot change it", () => {
    expect(PUBLIC_LEAD_FORM_CODE_MESSAGES.PUBLIC_WEB_INTAKE_DISABLED).toBe(
      "La captación pública está desactivada a nivel de plataforma. Esta configuración no puede cambiarse desde este formulario.",
    );
  });

  it("falls back to the provided fallback for an unknown code", () => {
    expect(getCodeMessage("SOMETHING_UNKNOWN", "fallback text")).toBe("fallback text");
  });

  it("falls back for a null/undefined code", () => {
    expect(getCodeMessage(null, "fallback text")).toBe("fallback text");
    expect(getCodeMessage(undefined, "fallback text")).toBe("fallback text");
  });
});

describe("getPublicLeadFormMutationErrorMessage", () => {
  it("prefers a known code's Spanish message over the raw error message", () => {
    const err = new ApiError("raw message", { status: 409, code: "PUBLIC_LEAD_FORM_MUST_BE_PAUSED" });
    expect(getPublicLeadFormMutationErrorMessage(err)).toBe(
      PUBLIC_LEAD_FORM_CODE_MESSAGES.PUBLIC_LEAD_FORM_MUST_BE_PAUSED,
    );
  });

  it("gives a clear 403 message", () => {
    const err = new ApiError("Forbidden", { status: 403 });
    expect(getPublicLeadFormMutationErrorMessage(err)).toMatch(/autorización/i);
  });

  it("gives a clear 404 message", () => {
    const err = new ApiError("Not found", { status: 404 });
    expect(getPublicLeadFormMutationErrorMessage(err)).toBe(PUBLIC_LEAD_FORM_CODE_MESSAGES.NOT_FOUND);
  });

  it("surfaces the first 422 field error", () => {
    const err = new ApiError("Validation failed", {
      status: 422,
      errors: { "allowed_origins.0": ["El origen no es válido."] },
    });
    expect(getPublicLeadFormMutationErrorMessage(err)).toBe("El origen no es válido.");
  });

  it("surfaces the message for a 409 without a mapped code", () => {
    const err = new ApiError("Conflict happened", { status: 409 });
    expect(getPublicLeadFormMutationErrorMessage(err)).toBe("Conflict happened");
  });

  it("returns a generic fallback for a non-ApiError", () => {
    expect(getPublicLeadFormMutationErrorMessage(new TypeError("network down"))).toMatch(/error/i);
  });
});

describe("isValidPublicLeadFormKey", () => {
  it.each(["website-leads", "form1", "a-b-c-9"])("accepts %s", (key) => {
    expect(isValidPublicLeadFormKey(key)).toBe(true);
  });

  it.each(["Website-Leads", "website_leads", "-leads", "leads-", "leads--form", "", "form 1"])(
    "rejects %s",
    (key) => {
      expect(isValidPublicLeadFormKey(key)).toBe(false);
    },
  );
});

describe("isValidAllowedOrigin", () => {
  it.each(["https://example.com", "https://example.com/", "http://sub.example.com:8080"])(
    "accepts %s",
    (origin) => {
      expect(isValidAllowedOrigin(origin)).toBe(true);
    },
  );

  it.each([
    "https://user:pass@example.com",
    "https://example.com/some/path",
    "https://example.com?x=1",
    "https://example.com#frag",
    "not-a-url",
    "",
    "  https://example.com",
  ])("rejects %s", (origin) => {
    expect(isValidAllowedOrigin(origin)).toBe(false);
  });

  it("never silently rewrites the input -- it only reports valid or not", () => {
    const input = "https://example.com/some/path";
    isValidAllowedOrigin(input);
    expect(input).toBe("https://example.com/some/path");
  });
});

describe("findDuplicateAllowedOriginIndex", () => {
  it("finds a duplicate once canonicalized (case/trailing-slash insensitive)", () => {
    const index = findDuplicateAllowedOriginIndex(["https://example.com", "https://EXAMPLE.com"]);
    expect(index).toBe(1);
  });

  it("returns null when there is no duplicate", () => {
    expect(findDuplicateAllowedOriginIndex(["https://example.com", "https://other.com"])).toBeNull();
  });

  it("ignores invalid entries rather than crashing", () => {
    expect(findDuplicateAllowedOriginIndex(["not-a-url", "https://example.com"])).toBeNull();
  });
});
