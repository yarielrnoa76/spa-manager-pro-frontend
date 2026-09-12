import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicLeadFormEditorModal from "../PublicLeadFormEditorModal";
import { api, ApiError } from "../../services/api";
import type { PublicLeadForm } from "../../types";

/**
 * Form Builder B2 — create/edit modal. `key` and `branch_id` are immutable after creation: the
 * create form collects them, the edit form only ever shows them read-only and never sends them
 * in the PATCH payload.
 */

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: {
      listBranches: vi.fn(),
      createPublicLeadForm: vi.fn(),
      updatePublicLeadForm: vi.fn(),
    },
  };
});

const BRANCHES = [
  { id: "1", name: "Main Branch", code: "MB", address: "" },
  { id: "2", name: "North Branch", code: "NB", address: "" },
];

const EXISTING_FORM: PublicLeadForm = {
  id: 42,
  uuid: "uuid-42",
  name: "Contact Us",
  key: "contact-us",
  branch_id: 1,
  branch: { id: 1, name: "Main Branch" },
  lead_source_key: "public_web_form",
  enabled: false,
  allowed_origins: ["https://example.com"],
  created_by_user_id: 7,
  created_by: { id: 7, name: "Admin" },
  updated_by_user_id: 7,
  updated_by: { id: 7, name: "Admin" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listBranches).mockResolvedValue(BRANCHES);
});

describe("PublicLeadFormEditorModal — create", () => {
  const fillValidCreateForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText("Nombre"), "Website Leads");
    await user.type(screen.getByLabelText("Identificador (key)"), "website-leads");
    await user.selectOptions(screen.getByLabelText("Sucursal"), "1");
    await user.type(screen.getByLabelText("Origen permitido 1"), "https://example.com");
  };

  it("sends exactly name, key, branch_id and allowed_origins -- nothing server-controlled", async () => {
    vi.mocked(api.createPublicLeadForm).mockResolvedValue({ ...EXISTING_FORM, name: "Website Leads" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<PublicLeadFormEditorModal isOpen mode="create" onClose={() => {}} onSuccess={onSuccess} />);

    await screen.findByLabelText("Sucursal");
    await fillValidCreateForm(user);
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    await waitFor(() => expect(api.createPublicLeadForm).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(api.createPublicLeadForm).mock.calls[0][0];
    expect(payload).toEqual({
      name: "Website Leads",
      key: "website-leads",
      branch_id: 1,
      allowed_origins: ["https://example.com"],
    });
    expect(Object.keys(payload).sort()).toEqual(["allowed_origins", "branch_id", "key", "name"]);
    // Never any server-authoritative field.
    expect(payload).not.toHaveProperty("uuid");
    expect(payload).not.toHaveProperty("tenant_id");
    expect(payload).not.toHaveProperty("enabled");
    expect(payload).not.toHaveProperty("lead_source_key");
    expect(payload).not.toHaveProperty("created_by_user_id");

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: "Website Leads" }));
  });

  it("rejects an invalid key format before ever calling the API", async () => {
    const user = userEvent.setup();
    render(<PublicLeadFormEditorModal isOpen mode="create" onClose={() => {}} onSuccess={() => {}} />);

    await screen.findByLabelText("Sucursal");
    await user.type(screen.getByLabelText("Nombre"), "Website Leads");
    await user.type(screen.getByLabelText("Identificador (key)"), "Website_Leads");
    await user.selectOptions(screen.getByLabelText("Sucursal"), "1");
    await user.type(screen.getByLabelText("Origen permitido 1"), "https://example.com");
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    expect(await screen.findByText(/minúsculas, números y guiones/i)).toBeTruthy();
    expect(api.createPublicLeadForm).not.toHaveBeenCalled();
  });

  it("rejects an origin with a path, credentials or query before calling the API", async () => {
    const user = userEvent.setup();
    render(<PublicLeadFormEditorModal isOpen mode="create" onClose={() => {}} onSuccess={() => {}} />);

    await screen.findByLabelText("Sucursal");
    await user.type(screen.getByLabelText("Nombre"), "Website Leads");
    await user.type(screen.getByLabelText("Identificador (key)"), "website-leads");
    await user.selectOptions(screen.getByLabelText("Sucursal"), "1");
    await user.type(screen.getByLabelText("Origen permitido 1"), "https://user:pass@example.com/path");
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    expect(await screen.findByText(/este origen no es válido/i)).toBeTruthy();
    expect(api.createPublicLeadForm).not.toHaveBeenCalled();
  });

  it("rejects a duplicate origin (case/trailing-slash insensitive) before calling the API", async () => {
    const user = userEvent.setup();
    render(<PublicLeadFormEditorModal isOpen mode="create" onClose={() => {}} onSuccess={() => {}} />);

    await screen.findByLabelText("Sucursal");
    await user.type(screen.getByLabelText("Nombre"), "Website Leads");
    await user.type(screen.getByLabelText("Identificador (key)"), "website-leads");
    await user.selectOptions(screen.getByLabelText("Sucursal"), "1");
    await user.type(screen.getByLabelText("Origen permitido 1"), "https://example.com");
    await user.click(screen.getByText(/Agregar origen/i));
    await user.type(screen.getByLabelText("Origen permitido 2"), "https://EXAMPLE.com/");
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    expect(await screen.findByText(/ya fue agregado/i)).toBeTruthy();
    expect(api.createPublicLeadForm).not.toHaveBeenCalled();
  });

  it("shows a clear message for a 422 response and never calls onSuccess", async () => {
    vi.mocked(api.createPublicLeadForm).mockRejectedValue(
      new ApiError("Validation failed", { status: 422, errors: { key: ["El identificador ya está en uso."] } }),
    );
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<PublicLeadFormEditorModal isOpen mode="create" onClose={() => {}} onSuccess={onSuccess} />);

    await screen.findByLabelText("Sucursal");
    await fillValidCreateForm(user);
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    expect(await screen.findByText("El identificador ya está en uso.")).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a clear message for a 409 incompatible lead source response", async () => {
    vi.mocked(api.createPublicLeadForm).mockRejectedValue(
      new ApiError("conflict", { status: 409, code: "INCOMPATIBLE_LEAD_SOURCE" }),
    );
    const user = userEvent.setup();
    render(<PublicLeadFormEditorModal isOpen mode="create" onClose={() => {}} onSuccess={() => {}} />);

    await screen.findByLabelText("Sucursal");
    await fillValidCreateForm(user);
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/incompatible/i);
  });

  it("reuses the existing branches endpoint, never a new one", async () => {
    render(<PublicLeadFormEditorModal isOpen mode="create" onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => expect(api.listBranches).toHaveBeenCalledTimes(1));
  });
});

describe("PublicLeadFormEditorModal — edit", () => {
  it("shows key and branch as read-only, prefilled with the existing values", async () => {
    render(
      <PublicLeadFormEditorModal isOpen mode="edit" formToEdit={EXISTING_FORM} onClose={() => {}} onSuccess={() => {}} />,
    );

    expect(await screen.findByDisplayValue("Contact Us")).toBeTruthy();
    expect(screen.getByText("contact-us")).toBeTruthy();
    expect(screen.getByText("Main Branch")).toBeTruthy();
    // Never editable in this mode.
    expect(screen.queryByLabelText("Identificador (key)")).toBeNull();
    expect(screen.queryByLabelText("Sucursal")).toBeNull();
  });

  it("PATCHes exactly name and allowed_origins -- never key or branch_id", async () => {
    vi.mocked(api.updatePublicLeadForm).mockResolvedValue({ ...EXISTING_FORM, name: "New Name" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <PublicLeadFormEditorModal isOpen mode="edit" formToEdit={EXISTING_FORM} onClose={() => {}} onSuccess={onSuccess} />,
    );

    const nameInput = await screen.findByLabelText("Nombre");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => expect(api.updatePublicLeadForm).toHaveBeenCalledTimes(1));
    const [id, payload] = vi.mocked(api.updatePublicLeadForm).mock.calls[0];
    expect(id).toBe(42);
    expect(payload).toEqual({ name: "New Name", allowed_origins: ["https://example.com"] });
    expect(payload).not.toHaveProperty("key");
    expect(payload).not.toHaveProperty("branch_id");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows a clear message when the backend rejects the edit because the form is not paused (409)", async () => {
    vi.mocked(api.updatePublicLeadForm).mockRejectedValue(
      new ApiError("conflict", { status: 409, code: "PUBLIC_LEAD_FORM_MUST_BE_PAUSED" }),
    );
    const user = userEvent.setup();
    render(
      <PublicLeadFormEditorModal isOpen mode="edit" formToEdit={EXISTING_FORM} onClose={() => {}} onSuccess={() => {}} />,
    );

    await screen.findByLabelText("Nombre");
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(await screen.findByText(/debe estar pausado antes de poder editarlo/i)).toBeTruthy();
  });

  it("never calls listBranches in edit mode -- the branch is already known and immutable", async () => {
    render(
      <PublicLeadFormEditorModal isOpen mode="edit" formToEdit={EXISTING_FORM} onClose={() => {}} onSuccess={() => {}} />,
    );
    await screen.findByLabelText("Nombre");
    expect(api.listBranches).not.toHaveBeenCalled();
  });
});
