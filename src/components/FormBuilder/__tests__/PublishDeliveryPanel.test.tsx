import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublishDeliveryPanel from "../PublishDeliveryPanel";
import { api, ApiError } from "../../../services/api";
import type { PublicLeadForm, PublicLeadFormReadiness, PublicLeadFormVersion } from "../../../types";

vi.mock("../../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/api")>();
  return {
    ...actual,
    api: {
      listPublicLeadFormVersions: vi.fn(),
      publishPublicLeadFormDraft: vi.fn(),
      activatePublicLeadForm: vi.fn(),
      pausePublicLeadForm: vi.fn(),
    },
  };
});

const FORM = (overrides: Partial<PublicLeadForm> = {}): PublicLeadForm => ({
  id: 1,
  uuid: "abcabc12-1111-4111-8111-111111111111",
  name: "Contact Form",
  key: "contact-form",
  branch_id: 1,
  branch: { id: 1, name: "Main Branch" },
  lead_source_key: "public_web_form",
  enabled: false,
  allowed_origins: [],
  embed_origins: [],
  created_by_user_id: null,
  created_by: null,
  updated_by_user_id: null,
  updated_by: null,
  created_at: null,
  updated_at: null,
  ...overrides,
});

const READINESS = (overrides: Partial<PublicLeadFormReadiness> = {}): PublicLeadFormReadiness => ({
  form_id: 1,
  form_uuid: "abcabc12-1111-4111-8111-111111111111",
  environment: "qa",
  form_enabled: false,
  master_enabled: true,
  prerequisites_ready: true,
  activatable: false,
  published: false,
  blocking_condition: null,
  context_ready: true,
  draft_publishable: true,
  draft_blocking_condition: null,
  has_published_version: false,
  activation_blocking_condition: null,
  ...overrides,
});

const VERSION = (overrides: Partial<PublicLeadFormVersion> = {}): PublicLeadFormVersion => ({
  uuid: "v-uuid-1",
  version_number: 1,
  status: "published",
  created_at: "2026-09-01T00:00:00Z",
  published_at: "2026-09-02T00:00:00Z",
  published_by: { name: "María López" },
  ...overrides,
});

const defaultProps = {
  formId: 1,
  onRefreshReadiness: vi.fn(),
  onFormMutated: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listPublicLeadFormVersions).mockResolvedValue([]);
});

describe("PublishDeliveryPanel — RBAC (canPublish gate)", () => {
  it("without publish_public_lead_forms, publish/activate/pause are disabled and never send a request when clicked", async () => {
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS()}
        readinessState="success"
        canPublish={false}
      />,
    );

    const publishBtn = await screen.findByRole("button", { name: /Publicar borrador/i });
    expect(publishBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Activar$/i })).toBeDisabled();

    // Disabled buttons never fire a click handler in the DOM -- confirms no request is even
    // attempted, not merely that the visual affordance looks inactive.
    expect(api.publishPublicLeadFormDraft).not.toHaveBeenCalled();
    expect(api.activatePublicLeadForm).not.toHaveBeenCalled();
  });

  it("with canPublish=true and draft_publishable=true, Publicar is enabled", async () => {
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS({ draft_publishable: true })}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByRole("button", { name: /Publicar borrador/i })).not.toBeDisabled();
  });
});

describe("PublishDeliveryPanel — readiness gating (backend is the only authority)", () => {
  it("Publicar stays disabled when draft_publishable=false even for a canPublish user", async () => {
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS({ draft_publishable: false })}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByRole("button", { name: /Publicar borrador/i })).toBeDisabled();
  });

  it("Activar stays disabled when activatable=false", async () => {
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS({ activatable: false })}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByRole("button", { name: /^Activar$/i })).toBeDisabled();
  });

  it("Pausar is disabled while the form is already paused", async () => {
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM({ enabled: false })}
        readiness={READINESS()}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByRole("button", { name: /^Pausar$/i })).toBeDisabled();
  });
});

describe("PublishDeliveryPanel — publish confirmation and double-submit prevention", () => {
  it("clicking Publicar opens a confirmation and does not call the endpoint yet", async () => {
    const user = userEvent.setup();
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS({ draft_publishable: true })}
        readinessState="success"
        canPublish={true}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /Publicar borrador/i }));

    expect(screen.getByText(/¿Confirmas la publicación\?/i)).toBeTruthy();
    expect(api.publishPublicLeadFormDraft).not.toHaveBeenCalled();
  });

  it("confirming calls /draft/publish exactly once and refreshes versions, readiness, and the form", async () => {
    vi.mocked(api.publishPublicLeadFormDraft).mockResolvedValue(VERSION());
    const onRefreshReadiness = vi.fn();
    const onFormMutated = vi.fn();
    const user = userEvent.setup();
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        onRefreshReadiness={onRefreshReadiness}
        onFormMutated={onFormMutated}
        form={FORM()}
        readiness={READINESS({ draft_publishable: true })}
        readinessState="success"
        canPublish={true}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /Publicar borrador/i }));
    await user.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => expect(api.publishPublicLeadFormDraft).toHaveBeenCalledTimes(1));
    expect(onRefreshReadiness).toHaveBeenCalled();
    expect(onFormMutated).toHaveBeenCalled();
    expect(api.listPublicLeadFormVersions).toHaveBeenCalledTimes(2); // initial mount + post-publish refresh
  });

  it("disables the confirm button while the request is in flight, preventing a double submission", async () => {
    let resolvePublish: (v: PublicLeadFormVersion) => void = () => {};
    vi.mocked(api.publishPublicLeadFormDraft).mockImplementation(
      () => new Promise((resolve) => { resolvePublish = resolve; }),
    );
    const user = userEvent.setup();
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS({ draft_publishable: true })}
        readinessState="success"
        canPublish={true}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /Publicar borrador/i }));
    const confirmBtn = screen.getByRole("button", { name: /Confirmar/i });
    await user.click(confirmBtn);

    expect(screen.getByRole("button", { name: /Procesando/i })).toBeDisabled();
    expect(api.publishPublicLeadFormDraft).toHaveBeenCalledTimes(1);

    resolvePublish(VERSION());
  });

  it("on a 409 conflict, shows a clear message, re-queries readiness, and preserves prior state (never applies optimistically)", async () => {
    vi.mocked(api.publishPublicLeadFormDraft).mockRejectedValue(
      new ApiError("No draft version exists to publish.", { status: 409, code: "NO_DRAFT_TO_PUBLISH" }),
    );
    const onRefreshReadiness = vi.fn();
    const user = userEvent.setup();
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        onRefreshReadiness={onRefreshReadiness}
        form={FORM()}
        readiness={READINESS({ draft_publishable: true })}
        readinessState="success"
        canPublish={true}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /Publicar borrador/i }));
    await user.click(screen.getByRole("button", { name: /Confirmar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/No hay un borrador para publicar/i);
    expect(onRefreshReadiness).toHaveBeenCalled();
  });
});

describe("PublishDeliveryPanel — version history (public identifiers only)", () => {
  it("renders version_number/status/dates/published_by, and never an internal id", async () => {
    vi.mocked(api.listPublicLeadFormVersions).mockResolvedValue([VERSION()]);
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS()}
        readinessState="success"
        canPublish={true}
      />,
    );

    expect(await screen.findByText("v1")).toBeTruthy();
    // "Publicada" also labels a table column header -- assert on the status badge specifically.
    expect(screen.getAllByText("Publicada").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("María López")).toBeTruthy();
    // No numeric internal id ever rendered as a version identifier.
    expect(screen.queryByText(/"id"/)).toBeNull();
  });

  it("shows an empty state distinctly, never a false 'no permission' or crash", async () => {
    vi.mocked(api.listPublicLeadFormVersions).mockResolvedValue([]);
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM()}
        readiness={READINESS()}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByText(/Todavía no hay versiones/i)).toBeTruthy();
  });
});

describe("PublishDeliveryPanel — delivery", () => {
  it("shows a not-deliverable state when there is no published version", async () => {
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM({ enabled: false })}
        readiness={READINESS({ has_published_version: false })}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByText(/Entrega al cliente/i)).toBeTruthy();
    expect(screen.getByText(/actívalo para habilitar la entrega|publica un borrador/i)).toBeTruthy();
  });

  it("without a backend-delivered page_url, shows an honest 'not available' state -- never a fabricated URL", async () => {
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM({ enabled: true, page_url: undefined })}
        readiness={READINESS({ has_published_version: true })}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByText(/no están disponibles/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Copiar URL/i)).toBeNull();
  });

  it("with a backend-delivered page_url, shows the hosted URL, snippet, and QR using exactly that URL", async () => {
    const pageUrl = "https://forms.example.com/f/abcabc12-1111-4111-8111-111111111111";
    render(
      <PublishDeliveryPanel
        {...defaultProps}
        form={FORM({ enabled: true, page_url: pageUrl })}
        readiness={READINESS({ has_published_version: true })}
        readinessState="success"
        canPublish={true}
      />,
    );
    expect(await screen.findByDisplayValue(pageUrl)).toBeTruthy();
    expect(screen.getByText(new RegExp(pageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy();
  });
});
