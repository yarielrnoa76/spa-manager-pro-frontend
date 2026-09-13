import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RolesPermissionsSettings from "../RolesPermissionsSettings";

/**
 * Gate 2 (Granular Resource Visibility / Role Lifecycle finalization), Section 11.2/11.4:
 * catalog-driven resource scopes (never a hardcoded frontend copy, and never offering an
 * option the backend doesn't support for that resource), custom-role deletion, the 409
 * ROLE_IN_USE contract, and system-role protection.
 */

vi.mock("../../services/api", () => {
  class ApiError extends Error {
    code?: string;
    status?: number;
    data?: unknown;
    constructor(message: string, opts?: { code?: string; status?: number; data?: unknown }) {
      super(message);
      this.code = opts?.code;
      this.status = opts?.status;
      this.data = opts?.data;
    }
  }
  return {
    ApiError,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { api, ApiError } from "../../services/api";

const CATALOG = {
  leads: ["own", "branch", "all"],
  inventory: ["branch", "all"],
  users: ["branch", "all"],
  products: ["all"],
  roles: ["all"],
};

const CUSTOM_ROLE = {
  id: 5,
  name: "cajero_noche",
  tenant_id: 3,
  is_system_role: false,
  resource_scopes: { leads: "own", inventory: "branch" },
  permissions: [{ id: 1, name: "view_leads" }],
};

const SYSTEM_ROLE = {
  id: 6,
  name: "admin",
  tenant_id: 3,
  is_system_role: true,
  resource_scopes: { leads: "all" },
  permissions: [{ id: 1, name: "view_leads" }],
};

function mockLoad(roles: unknown[]) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.includes("resource-scope-catalog")) return Promise.resolve(CATALOG);
    if (path.startsWith("/permissions")) return Promise.resolve([{ id: 1, name: "view_leads" }]);
    if (path.startsWith("/roles")) return Promise.resolve(roles);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RolesPermissionsSettings — resource scopes (catalog-driven)", () => {
  it("renders Inventory's scope options as only Sucursal/Todo, never Solo lo Propio", async () => {
    mockLoad([CUSTOM_ROLE]);
    render(<RolesPermissionsSettings canManage={true} />);

    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    const inventoryRow = (await screen.findByText("inventory")).closest("div");
    const select = inventoryRow?.querySelector("select") as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);

    expect(optionLabels).toEqual(["Sucursal", "Todo"]);
    expect(optionLabels).not.toContain("Solo lo Propio");
  });

  it("updates a resource's scope via PUT /roles/:id with the merged resource_scopes", async () => {
    mockLoad([CUSTOM_ROLE]);
    vi.mocked(api.put).mockResolvedValue({ ...CUSTOM_ROLE, resource_scopes: { leads: "all", inventory: "branch" } });

    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    const scopesPanel = (await screen.findByText("Alcances por Recurso")).closest("div")?.parentElement;
    const leadsLabel = Array.from(scopesPanel?.querySelectorAll("span") ?? []).find((el) => el.textContent === "leads");
    const select = leadsLabel?.closest("div")?.querySelector("select") as HTMLSelectElement;
    await user.selectOptions(select, "all");

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/roles/5", {
        name: "cajero_noche",
        resource_scopes: { leads: "all", inventory: "branch" },
      }),
    );
  });
});

describe("RolesPermissionsSettings — role deletion", () => {
  it("deletes a custom role with no users and refreshes the list", async () => {
    mockLoad([CUSTOM_ROLE]);
    vi.mocked(api.delete).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    await user.click(await screen.findByRole("button", { name: /Eliminar rol/i }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/roles/5"));
  });

  it("shows the exact users_count when the backend rejects deletion with 409 ROLE_IN_USE", async () => {
    mockLoad([CUSTOM_ROLE]);
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError("Este rol está en uso y no puede eliminarse hasta reasignar a sus usuarios.", {
        code: "ROLE_IN_USE",
        status: 409,
        data: { code: "ROLE_IN_USE", users_count: 3 },
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");
    await user.click(await screen.findByRole("button", { name: /Eliminar rol/i }));

    expect(await screen.findByText(/en uso por 3 usuario\(s\)/i)).toBeTruthy();
  });

  it("never offers a delete action for a tenant's own protected system role (Admin/Manager/Sales)", async () => {
    mockLoad([SYSTEM_ROLE]);
    render(<RolesPermissionsSettings canManage={true} />);

    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "6");

    expect(await screen.findByText(/Configurar Permisos del Rol/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Eliminar rol/i })).toBeNull();
  });

  it("shows the platform SuperAdmin role in its own read-only panel, never as a manageable/deletable role", async () => {
    mockLoad([{ ...SYSTEM_ROLE, id: 1, name: "superadmin", tenant_id: null }]);
    render(<RolesPermissionsSettings canManage={true} />);

    expect(await screen.findByText(/Rol de plataforma/i)).toBeTruthy();
    // Never selectable from the manageable-role dropdown.
    const options = (await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i })) as HTMLSelectElement;
    expect(Array.from(options.options).some((o) => o.textContent === "superadmin")).toBe(false);
  });

  it("never offers deletion when the actor lacks manage_roles", async () => {
    mockLoad([CUSTOM_ROLE]);
    render(<RolesPermissionsSettings canManage={false} />);

    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    expect(screen.queryByRole("button", { name: /Eliminar rol/i })).toBeNull();
  });
});

/**
 * Sales-context hotfix, objective 7: an absent/invalid `resource_scopes` entry must never render
 * as "Todo" -- the previous defect defaulted a missing scope to the catalog's LAST option
 * (typically "all"), which silently implied a permissive default that fail-closed custom roles
 * never actually have.
 */
describe("RolesPermissionsSettings — resource scope: absent/invalid never reads as Todo", () => {
  function scopeSelectFor(resource: string): HTMLSelectElement {
    const label = screen.getByText(resource);
    return label.closest("div")!.querySelector("select") as HTMLSelectElement;
  }

  it("a resource entirely absent from resource_scopes shows 'Sin configurar', never 'Todo'", async () => {
    const role = { ...CUSTOM_ROLE, resource_scopes: { leads: "own" } }; // products/inventory/users/roles absent
    mockLoad([role]);
    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    await screen.findByText("Alcances por Recurso");
    const select = scopeSelectFor("products");
    expect(select.value).toBe("__unconfigured__");
    expect(select.selectedOptions[0].textContent).toBe("Sin configurar");
    expect(select.selectedOptions[0].textContent).not.toBe("Todo");
  });

  it("a resource explicitly persisted as null shows 'Sin configurar', never 'Todo'", async () => {
    const role = { ...CUSTOM_ROLE, resource_scopes: { leads: "own", products: null } };
    mockLoad([role]);
    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    await screen.findByText("Alcances por Recurso");
    const select = scopeSelectFor("products");
    expect(select.value).toBe("__unconfigured__");
    expect(select.selectedOptions[0].textContent).toBe("Sin configurar");
  });

  it("a resource genuinely materialized as 'all' shows 'Todo'", async () => {
    const role = { ...CUSTOM_ROLE, resource_scopes: { leads: "own", products: "all" } };
    mockLoad([role]);
    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    await screen.findByText("Alcances por Recurso");
    const select = scopeSelectFor("products");
    expect(select.value).toBe("all");
    expect(select.selectedOptions[0].textContent).toBe("Todo");
  });

  it("an invalid/unrecognized persisted scope value is never silently normalized to 'Todo'", async () => {
    const role = { ...CUSTOM_ROLE, resource_scopes: { leads: "own", inventory: "some_future_invalid_value" } };
    mockLoad([role]);
    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    await screen.findByText("Alcances por Recurso");
    const select = scopeSelectFor("inventory");
    // Not one of the resource's own valid options -- treated as unconfigured, never coerced to "all".
    expect(select.value).toBe("__unconfigured__");
    expect(select.selectedOptions[0].textContent).toBe("Sin configurar");
    expect(select.selectedOptions[0].textContent).not.toBe("Todo");
  });

  it("saving one resource's scope never introduces or replaces scopes the user did not touch", async () => {
    const role = { ...CUSTOM_ROLE, resource_scopes: { leads: "own", inventory: "branch" } };
    mockLoad([role]);
    vi.mocked(api.put).mockResolvedValue({ ...role, resource_scopes: { leads: "own", inventory: "branch", products: "all" } });

    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");
    await screen.findByText("Alcances por Recurso");

    await user.selectOptions(scopeSelectFor("products"), "all");

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/roles/5", {
        name: "cajero_noche",
        // leads and inventory -- untouched by this save -- are preserved exactly as they were.
        resource_scopes: { leads: "own", inventory: "branch", products: "all" },
      }),
    );
  });
});
