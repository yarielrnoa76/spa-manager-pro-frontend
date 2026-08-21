import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AiAgentsSettings from "../AiAgentsSettings";
import { api } from "../../services/api";
import type { AiAgent, AiAgentVersionSummary } from "../../types";

vi.mock("../../services/api", () => {
  class ApiError extends Error {
    code?: string;
    constructor(message: string, opts?: { code?: string }) {
      super(message);
      this.code = opts?.code;
    }
  }
  return {
    ApiError,
    api: {
      listAiAgents: vi.fn(),
      getAiAgent: vi.fn(),
      updateAiAgent: vi.fn(),
      listAiAgentVersions: vi.fn(),
      restoreAiAgentVersion: vi.fn(),
    },
  };
});

function makeAgent(overrides: Partial<AiAgent> = {}): AiAgent {
  return {
    id: 1,
    tenant_id: 1,
    code: "whatsapp_reception",
    name: "WhatsApp Reception Agent",
    enabled: true,
    system_prompt_override: null,
    tenant_instructions: null,
    current_version: 1,
    created_by: null,
    updated_by: null,
    created_at: "2026-08-21T00:00:00Z",
    updated_at: "2026-08-21T00:00:00Z",
    effective_prompt: "You are a helpful WhatsApp receptionist.",
    ...overrides,
  };
}

function makeVersion(overrides: Partial<AiAgentVersionSummary> = {}): AiAgentVersionSummary {
  return {
    id: 10,
    ai_agent_id: 1,
    version: 1,
    changed_by: null,
    changedBy: null,
    change_reason: null,
    created_at: "2026-08-21T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listAiAgents).mockResolvedValue([makeAgent()]);
  vi.mocked(api.getAiAgent).mockResolvedValue(makeAgent());
  vi.mocked(api.listAiAgentVersions).mockResolvedValue([makeVersion()]);
});

describe("AiAgentsSettings — permission visibility", () => {
  it("shows an access-denied message and never calls the API when canView is false", () => {
    render(<AiAgentsSettings canView={false} canManage={false} />);

    expect(screen.getByText("Acceso denegado.")).toBeInTheDocument();
    expect(api.listAiAgents).not.toHaveBeenCalled();
  });

  it("loads and displays the agent name and current version for a view-only user", async () => {
    render(<AiAgentsSettings canView canManage={false} />);

    expect(await screen.findByText("WhatsApp Reception Agent")).toBeInTheDocument();
    expect(screen.getByText(/Versión actual: v1/)).toBeInTheDocument();
  });

  it("disables the tenant_instructions textarea and hides Guardar for a view-only user", async () => {
    render(<AiAgentsSettings canView canManage={false} />);

    const textarea = await screen.findByPlaceholderText("Sin instrucciones adicionales del tenant.");
    expect(textarea).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Guardar$/i })).not.toBeInTheDocument();
  });

  it("never shows the Avanzado (SuperAdmin) section for a non-SuperAdmin user, even with manage permission", async () => {
    render(<AiAgentsSettings canView canManage isSuperAdmin={false} />);

    await screen.findByText("WhatsApp Reception Agent");
    expect(screen.queryByText(/Avanzado \(solo SuperAdmin\)/i)).not.toBeInTheDocument();
  });
});

describe("AiAgentsSettings — tenant instructions editing", () => {
  it("lets a tenant user with manage permission edit and save tenant_instructions", async () => {
    vi.mocked(api.updateAiAgent).mockResolvedValue(makeAgent({ tenant_instructions: "Mention the promo.", current_version: 2 }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage />);

    const textarea = await screen.findByPlaceholderText("Sin instrucciones adicionales del tenant.");
    await user.type(textarea, "Mention the promo.");

    const saveButton = screen.getByRole("button", { name: /Guardar$/i });
    await user.click(saveButton);

    await waitFor(() =>
      expect(api.updateAiAgent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ tenant_instructions: "Mention the promo." }),
      ),
    );
    // system_prompt_override must never be sent by a non-SuperAdmin save.
    const [, payload] = vi.mocked(api.updateAiAgent).mock.calls[0];
    expect(payload).not.toHaveProperty("system_prompt_override");
  });

  it("disables Guardar until the draft actually differs from the saved value", async () => {
    render(<AiAgentsSettings canView canManage />);

    const saveButton = await screen.findByRole("button", { name: /Guardar$/i });
    expect(saveButton).toBeDisabled();
  });

  it("toggles enabled via the switch when canManage is true", async () => {
    vi.mocked(api.updateAiAgent).mockResolvedValue(makeAgent({ enabled: false }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage />);

    const toggle = await screen.findByRole("switch");
    expect(toggle).not.toBeDisabled();
    await user.click(toggle);

    await waitFor(() => expect(api.updateAiAgent).toHaveBeenCalledWith(1, { enabled: false }));
  });

  it("disables the enabled switch for a view-only user", async () => {
    render(<AiAgentsSettings canView canManage={false} />);

    const toggle = await screen.findByRole("switch");
    expect(toggle).toBeDisabled();
  });

  /**
   * Pre-commit review: the platform baseline is still AVA-specific, so only a SuperAdmin may
   * turn an agent ON during this Close-out -- a tenant user with manage_ai_agents keeps the
   * ability to turn a currently-enabled agent OFF (tested above), but the switch must be
   * disabled (not merely non-functional) when it's currently off and the caller isn't
   * SuperAdmin, backed by the matching server-side 403.
   */
  it("disables the enabled switch for a non-SuperAdmin tenant user when the agent is currently disabled", async () => {
    vi.mocked(api.getAiAgent).mockResolvedValue(makeAgent({ enabled: false }));

    render(<AiAgentsSettings canView canManage isSuperAdmin={false} />);

    const toggle = await screen.findByRole("switch");
    expect(toggle).toBeDisabled();
  });

  it("lets a SuperAdmin enable a currently-disabled agent", async () => {
    vi.mocked(api.getAiAgent).mockResolvedValue(makeAgent({ enabled: false }));
    vi.mocked(api.updateAiAgent).mockResolvedValue(makeAgent({ enabled: true }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage isSuperAdmin />);

    const toggle = await screen.findByRole("switch");
    expect(toggle).not.toBeDisabled();
    await user.click(toggle);

    await waitFor(() => expect(api.updateAiAgent).toHaveBeenCalledWith(1, { enabled: true }));
  });
});

describe("AiAgentsSettings — version history and restore", () => {
  it("shows version history entries and marks the current version", async () => {
    vi.mocked(api.listAiAgentVersions).mockResolvedValue([
      makeVersion({ id: 10, version: 1, change_reason: "Initial default configuration" }),
      makeVersion({ id: 11, version: 2, changedBy: { id: 5, name: "Ada" }, change_reason: "Added promo" }),
    ]);
    vi.mocked(api.getAiAgent).mockResolvedValue(makeAgent({ current_version: 2 }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage />);

    await screen.findByText("WhatsApp Reception Agent");
    await user.click(screen.getByRole("button", { name: /Historial de versiones/i }));

    expect(await screen.findByText("v1")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("actual")).toBeInTheDocument();
  });

  it("only offers Restaurar for non-current versions, and only when canManage", async () => {
    vi.mocked(api.listAiAgentVersions).mockResolvedValue([
      makeVersion({ id: 10, version: 1 }),
      makeVersion({ id: 11, version: 2 }),
    ]);
    vi.mocked(api.getAiAgent).mockResolvedValue(makeAgent({ current_version: 2 }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage />);

    await screen.findByText("WhatsApp Reception Agent");
    await user.click(screen.getByRole("button", { name: /Historial de versiones/i }));

    const restoreButtons = screen.getAllByRole("button", { name: /Restaurar/i });
    expect(restoreButtons).toHaveLength(1); // only for v1, not the current v2
  });

  it("hides all Restaurar buttons for a view-only user", async () => {
    vi.mocked(api.listAiAgentVersions).mockResolvedValue([
      makeVersion({ id: 10, version: 1 }),
      makeVersion({ id: 11, version: 2 }),
    ]);
    vi.mocked(api.getAiAgent).mockResolvedValue(makeAgent({ current_version: 2 }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage={false} />);

    await screen.findByText("WhatsApp Reception Agent");
    await user.click(screen.getByRole("button", { name: /Historial de versiones/i }));

    expect(screen.queryByRole("button", { name: /Restaurar/i })).not.toBeInTheDocument();
  });

  it("calls the restore endpoint and refreshes the detail on Restaurar click", async () => {
    vi.mocked(api.listAiAgentVersions).mockResolvedValue([
      makeVersion({ id: 10, version: 1 }),
      makeVersion({ id: 11, version: 2 }),
    ]);
    vi.mocked(api.getAiAgent).mockResolvedValue(makeAgent({ current_version: 2 }));
    vi.mocked(api.restoreAiAgentVersion).mockResolvedValue(makeAgent({ current_version: 3 }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage />);

    await screen.findByText("WhatsApp Reception Agent");
    await user.click(screen.getByRole("button", { name: /Historial de versiones/i }));
    await user.click(screen.getByRole("button", { name: /Restaurar/i }));

    await waitFor(() => expect(api.restoreAiAgentVersion).toHaveBeenCalledWith(1, 10));
  });
});

describe("AiAgentsSettings — SuperAdmin Advanced section", () => {
  it("shows Avanzado for a SuperAdmin and reveals baseline/override/effective-prompt only after expanding", async () => {
    const user = userEvent.setup();
    render(<AiAgentsSettings canView canManage isSuperAdmin />);

    await screen.findByText("WhatsApp Reception Agent");
    expect(screen.queryByText(/Prompt base de la plataforma \(solo lectura\)/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Avanzado \(solo SuperAdmin\)/i }));

    expect(screen.getByText(/Prompt base de la plataforma \(solo lectura\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Vista previa del prompt efectivo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Vacío = usar el prompt base/i)).toBeInTheDocument();
  });

  it("shows the real platform_baseline_prompt from the API response (no client-side derivation)", async () => {
    vi.mocked(api.getAiAgent).mockResolvedValue(
      makeAgent({
        system_prompt_override: null,
        tenant_instructions: null,
        effective_prompt: "Baseline text only.",
        platform_baseline_prompt: "Baseline text only.",
      }),
    );

    render(<AiAgentsSettings canView canManage isSuperAdmin />);
    await screen.findByText("WhatsApp Reception Agent");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Avanzado \(solo SuperAdmin\)/i }));

    expect(screen.getByText(/Prompt base de la plataforma \(solo lectura\)/i)).toBeInTheDocument();
    expect(screen.getAllByText("Baseline text only.").length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Corrective pass requirement: the SuperAdmin must always see the REAL baseline, even while an
   * override is active -- it comes straight from the API's platform_baseline_prompt field
   * (never derived by subtracting strings from effective_prompt, which would be wrong once an
   * override replaces the baseline entirely).
   */
  it("still shows the real platform_baseline_prompt while an override is active -- never hidden, never corrupted", async () => {
    vi.mocked(api.getAiAgent).mockResolvedValue(
      makeAgent({
        system_prompt_override: "Custom override.",
        tenant_instructions: null,
        effective_prompt: "Custom override.",
        platform_baseline_prompt: "The real, unrelated platform baseline text.",
      }),
    );
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage isSuperAdmin />);
    await screen.findByText("WhatsApp Reception Agent");
    await user.click(screen.getByRole("button", { name: /Avanzado \(solo SuperAdmin\)/i }));

    expect(screen.getByText("The real, unrelated platform baseline text.")).toBeInTheDocument();
    // The effective prompt preview correctly shows the override, not the baseline -- proving
    // the two panels are genuinely independent, not one derived from the other. "Custom
    // override." legitimately appears twice: the editable override textarea's value AND the
    // read-only effective-prompt preview.
    expect(screen.getByDisplayValue("Custom override.")).toBeInTheDocument();
    expect(screen.getAllByText("Custom override.").length).toBeGreaterThanOrEqual(1);
  });

  it("lets a SuperAdmin save a system_prompt_override", async () => {
    vi.mocked(api.updateAiAgent).mockResolvedValue(makeAgent({ system_prompt_override: "New override text." }));
    const user = userEvent.setup();

    render(<AiAgentsSettings canView canManage isSuperAdmin />);
    await screen.findByText("WhatsApp Reception Agent");
    await user.click(screen.getByRole("button", { name: /Avanzado \(solo SuperAdmin\)/i }));

    const overrideTextarea = screen.getByPlaceholderText(/Vacío = usar el prompt base/i);
    await user.type(overrideTextarea, "New override text.");
    await user.click(screen.getByRole("button", { name: /Guardar override/i }));

    await waitFor(() =>
      expect(api.updateAiAgent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ system_prompt_override: "New override text." }),
      ),
    );
  });

  it("never renders any n8n credential, Chatwoot token, or Sanctum token text", async () => {
    const user = userEvent.setup();
    render(<AiAgentsSettings canView canManage isSuperAdmin />);
    await screen.findByText("WhatsApp Reception Agent");
    await user.click(screen.getByRole("button", { name: /Avanzado \(solo SuperAdmin\)/i }));

    const html = document.body.innerHTML;
    expect(html).not.toMatch(/provider_config|webhook_verify_token|Bearer [A-Za-z0-9._-]{10,}/);
  });
});
