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

type Perm = { id: number; name: string };

/**
 * A representative slice of the REAL backend catalog (109 names as of this fix), covering every
 * category the grouping dictionary explicitly recognizes (including ones that used to rely on a
 * fragile raw-suffix coincidence: `view_leads`, `view_sales`) plus the five Professionals
 * permissions this fix specifically restores, plus one deliberately unrecognized name to exercise
 * the fallback bucket.
 */
const PERMISSIONS_CATALOG: Perm[] = [
  { id: 1, name: "view_leads" },
  { id: 2, name: "create_lead" },
  { id: 3, name: "view_sales" },
  { id: 4, name: "create_sale" },
  { id: 50, name: "manage_professionals" },
  { id: 51, name: "view_professionals" },
  { id: 52, name: "create_professional" },
  { id: 53, name: "edit_professional" },
  { id: 54, name: "delete_professional" },
  { id: 90, name: "some_future_unknown_permission" },
];

function mockLoad(roles: unknown[], permissions: Perm[] = PERMISSIONS_CATALOG) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.includes("resource-scope-catalog")) return Promise.resolve(CATALOG);
    if (path.startsWith("/permissions")) return Promise.resolve(permissions);
    if (path.startsWith("/roles")) return Promise.resolve(roles);
    return Promise.resolve([]);
  });
}

/** Finds a permission checkbox by its rendered (lowercase, underscore-replaced) label text. */
function permissionCheckbox(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText).closest("label");
  return label!.querySelector('input[type="checkbox"]') as HTMLInputElement;
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

  /**
   * Sales-context capability-driven hotfix, objective 6: two roles that happen to share the
   * exact same NAME but carry different `resource_scopes` data must render differently -- the
   * scope UI is driven entirely by each role's own persisted data (keyed by id), never by its
   * name being a familiar string like "cajero_dia".
   */
  it("two roles with the identical name but different resource_scopes render according to their own data, not their shared name", async () => {
    const roleA = { ...CUSTOM_ROLE, id: 5, name: "cajero_dia", resource_scopes: { leads: "own", inventory: "branch" } };
    const roleB = { ...CUSTOM_ROLE, id: 7, name: "cajero_dia", resource_scopes: { leads: "own", inventory: "all" } };
    mockLoad([roleA, roleB]);

    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    const roleSelect = await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i });

    await user.selectOptions(roleSelect, "5");
    let inventoryRow = (await screen.findByText("inventory")).closest("div");
    let select = inventoryRow?.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("branch");
    expect(select.selectedOptions[0].textContent).toBe("Sucursal");

    await user.selectOptions(roleSelect, "7");
    inventoryRow = (await screen.findByText("inventory")).closest("div");
    select = inventoryRow?.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("all");
    expect(select.selectedOptions[0].textContent).toBe("Todo");
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

/**
 * QA finding: GET /api/permissions correctly returns manage_professionals/view_professionals/
 * create_professional/edit_professional/delete_professional (confirmed real, id 51 for
 * view_professionals), but none of the five ever appeared in this screen. Root cause: the
 * grouping dictionary only had a SINGULAR key for several categories (lead/product/appointment/
 * refund/conversation/sale); the corresponding PLURAL-suffixed permissions (view_leads,
 * view_products, view_appointments, view_refunds, view_conversations, view_sales, import_sales,
 * export_sales) only ever rendered correctly by a coincidence where the unmatched raw suffix
 * happened to spell the same as the intended group. `professional`/`professionals` were folded
 * into the generic "configuración" bucket with no identity, and had no such lucky coincidence,
 * so an administrator scanning for a Professionals section found nothing. Fixed by making every
 * real category (including the missing plurals) an explicit key, giving Professionals its own
 * "profesionales" group, and routing anything still unmatched into ONE clearly labeled fallback
 * group ("otros permisos") instead of an unlabeled one-off bucket named after its own raw suffix.
 */
describe("RolesPermissionsSettings — complete permission catalog, exactly once, Professionals restored", () => {
  const ROLE_WITH_VIEW_PROFESSIONALS = {
    ...CUSTOM_ROLE,
    permissions: [
      { id: 1, name: "view_leads" },
      { id: 51, name: "view_professionals" },
    ],
  };

  async function openProfessionalsGroup(user: ReturnType<typeof userEvent.setup>) {
    render(<RolesPermissionsSettings canManage={true} />);
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");
    // Any non-empty search term auto-opens every group with at least one match -- the simplest,
    // already-supported way to reveal a group's checkboxes without hardcoding an accordion click.
    await user.type(await screen.findByPlaceholderText(/Buscar permiso o modelo/i), "professional");
  }

  it("1. all five Professionals permissions appear", async () => {
    mockLoad([CUSTOM_ROLE]);
    const user = userEvent.setup();
    await openProfessionalsGroup(user);

    expect(await screen.findByText("profesionales")).toBeTruthy();
    for (const label of ["manage professionals", "view professionals", "create professional", "edit professional", "delete professional"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("2. view_professionals appears checked when the role already has it", async () => {
    mockLoad([ROLE_WITH_VIEW_PROFESSIONALS]);
    const user = userEvent.setup();
    await openProfessionalsGroup(user);

    expect(permissionCheckbox("view professionals").checked).toBe(true);
    expect(permissionCheckbox("manage professionals").checked).toBe(false);
  });

  it("3. can be toggled on and off through the UI", async () => {
    mockLoad([CUSTOM_ROLE]);
    vi.mocked(api.put).mockResolvedValue({ ...CUSTOM_ROLE, permissions: [{ id: 1, name: "view_leads" }, { id: 51, name: "view_professionals" }] });
    const user = userEvent.setup();
    await openProfessionalsGroup(user);

    expect(permissionCheckbox("view professionals").checked).toBe(false);
    await user.click(permissionCheckbox("view professionals"));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/roles/5/permissions", { permission_ids: [1, 51] }),
    );
  });

  it("4. saving it never alters unrelated permissions", async () => {
    const role = { ...CUSTOM_ROLE, permissions: [{ id: 1, name: "view_leads" }, { id: 2, name: "create_lead" }, { id: 4, name: "create_sale" }] };
    mockLoad([role]);
    vi.mocked(api.put).mockResolvedValue(role);
    const user = userEvent.setup();
    await openProfessionalsGroup(user);

    await user.click(permissionCheckbox("view professionals"));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/roles/5/permissions", {
        // The three ALREADY-assigned, unrelated permissions are preserved verbatim; only the
        // toggled id (51) is added.
        permission_ids: expect.arrayContaining([1, 2, 4, 51]),
      }),
    );
    const call = vi.mocked(api.put).mock.calls.find(([path]) => path === "/roles/5/permissions");
    expect((call?.[1] as { permission_ids: number[] }).permission_ids).toHaveLength(4);
  });

  it("5. saving a permission toggle never touches resource_scopes", async () => {
    const role = { ...CUSTOM_ROLE, resource_scopes: { leads: "own", inventory: "branch" }, permissions: [{ id: 1, name: "view_leads" }] };
    mockLoad([role]);
    vi.mocked(api.put).mockResolvedValue(role);
    const user = userEvent.setup();
    await openProfessionalsGroup(user);

    await user.click(permissionCheckbox("view professionals"));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/roles/5/permissions", expect.anything()));
    // The permissions toggle hits a DIFFERENT endpoint than resource_scopes updates -- it must
    // never be the /roles/:id (name + resource_scopes) endpoint at all.
    expect(api.put).not.toHaveBeenCalledWith("/roles/5", expect.anything());
  });

  it("6. a future/unknown permission the backend sends appears in the fallback group, never silently dropped", async () => {
    mockLoad([CUSTOM_ROLE]);
    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");
    await user.type(await screen.findByPlaceholderText(/Buscar permiso o modelo/i), "some_future_unknown_permission");

    expect(await screen.findByText("otros permisos")).toBeTruthy();
    expect(screen.getByText("some future unknown permission")).toBeTruthy();
  });

  it("7 & 8. every permission in the simulated catalog renders exactly once, with no duplicates", async () => {
    mockLoad([CUSTOM_ROLE]);
    render(<RolesPermissionsSettings canManage={true} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), "5");

    // Open every group (accordion headers render regardless of open state; only their body is
    // conditional) so every checkbox this catalog produces is actually in the DOM. `leads` also
    // appears as a resource-scope row label, so the accordion header (inside a <button>) is
    // singled out explicitly.
    for (const groupName of ["leads", "sales", "profesionales", "otros permisos"]) {
      const headerSpan = screen.getAllByText(groupName).find((el) => el.closest("button"));
      await user.click(headerSpan!.closest("button")!);
    }

    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(allCheckboxes.length).toBe(PERMISSIONS_CATALOG.length);

    const labels = PERMISSIONS_CATALOG.map((p) => p.name.replaceAll("_", " "));
    for (const label of labels) {
      expect(screen.getAllByText(label)).toHaveLength(1);
    }
  });

  it("9. a permission the backend sends but the role does NOT have stays unchecked -- never auto-granted by merely rendering it", async () => {
    mockLoad([CUSTOM_ROLE]); // CUSTOM_ROLE.permissions only has view_leads
    const user = userEvent.setup();
    await openProfessionalsGroup(user);

    for (const label of ["manage professionals", "view professionals", "create professional", "edit professional", "delete professional"]) {
      expect(permissionCheckbox(label).checked).toBe(false);
    }
    expect(api.put).not.toHaveBeenCalled();
  });
});
