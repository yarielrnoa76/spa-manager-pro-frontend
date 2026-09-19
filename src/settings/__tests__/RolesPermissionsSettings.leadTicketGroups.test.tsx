import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RolesPermissionsSettings from "../RolesPermissionsSettings";
import { REAL_PERMISSION_NAMES } from "../../test/permissionCatalogFixture";

/**
 * B2.1.2: the Roles & Permissions screen used to file `view_unassigned_leads` and
 * `assign_unassigned_ticket` (and `manage_ticket_config`, `change_support_ticket_status`) under
 * "otros permisos" because its noun-suffix dictionary was incomplete. These tests render the screen
 * with the REAL backend catalog and check what the administrator actually sees and sends.
 */

vi.mock("../../services/api", () => {
  class ApiError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, opts?: { code?: string; status?: number }) {
      super(message);
      this.code = opts?.code;
      this.status = opts?.status;
    }
  }
  return {
    ApiError,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import { api } from "../../services/api";

type Perm = { id: number; name: string; is_protected?: boolean };

const CATALOG: Perm[] = REAL_PERMISSION_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  ...(name === "publish_public_lead_forms" ? { is_protected: true } : {}),
}));

const idOf = (name: string): number => {
  const found = CATALOG.find((p) => p.name === name);
  if (!found) throw new Error(`unknown permission ${name}`);
  return found.id;
};

const LEAD_PERMISSIONS = [
  "assign_lead",
  "create_lead",
  "delete_lead",
  "edit_lead",
  "import_leads",
  "view_leads",
  "view_unassigned_leads",
];

const TICKET_PERMISSIONS = [
  "assign_unassigned_ticket",
  "create_ticket",
  "delete_ticket",
  "edit_ticket",
  "reassign_ticket",
  "view_ticket",
];

function role(permissionNames: string[], overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    name: "front_desk",
    tenant_id: 3,
    is_system_role: false,
    resource_scopes: { leads: "branch" },
    permissions: permissionNames.map((name) => ({ id: idOf(name), name })),
    ...overrides,
  };
}

function mockLoad(roles: unknown[], permissions: Perm[] = CATALOG) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.includes("resource-scope-catalog")) return Promise.resolve({ leads: ["own", "branch", "all"] });
    if (path.startsWith("/permissions")) return Promise.resolve(permissions);
    if (path.startsWith("/roles")) return Promise.resolve(roles);
    return Promise.resolve([]);
  });
}

async function openScreen(roles: unknown[], roleId = 5, permissions: Perm[] = CATALOG) {
  mockLoad(roles, permissions);
  render(<RolesPermissionsSettings canManage={true} />);
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i }), String(roleId));
  return user;
}

/** Any name-substring search opens every group holding a match; "_" matches every permission. */
async function search(user: ReturnType<typeof userEvent.setup>, term: string) {
  await user.type(await screen.findByPlaceholderText(/Buscar permiso o modelo/i), term);
}

/** The accordion card whose header title is `groupName` (not a resource-scope row of the same text). */
function group(groupName: string): HTMLElement {
  const title = screen.getAllByText(groupName).find((el) => el.closest("button"));
  if (!title) throw new Error(`no accordion group "${groupName}"`);
  return title.closest("button")!.closest("div.rounded-xl") as HTMLElement;
}

const label = (permission: string) => permission.replaceAll("_", " ");

function labelsIn(card: HTMLElement): string[] {
  return Array.from(card.querySelectorAll("label")).map((l) => l.textContent?.replace(/Protegido|Sin efecto/g, "").trim() ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Roles & Permissions — Leads and Tickets grouping with the real catalog", () => {
  it("shows every ordinary Leads permission under Leads, assign_lead and view_unassigned_leads included", async () => {
    const user = await openScreen([role([])]);
    await search(user, "_");

    const leads = group("leads");
    expect(labelsIn(leads).sort()).toEqual(LEAD_PERMISSIONS.map(label).sort());
    expect(within(leads).getByText(label("assign_lead"))).toBeTruthy();
    expect(within(leads).getByText(label("view_unassigned_leads"))).toBeTruthy();
  });

  it("shows every ordinary Tickets permission under Tickets, assign_unassigned_ticket and reassign_ticket included", async () => {
    const user = await openScreen([role([])]);
    await search(user, "_");

    const tickets = group("tickets");
    expect(labelsIn(tickets).sort()).toEqual(TICKET_PERMISSIONS.map(label).sort());
    expect(within(tickets).getByText(label("assign_unassigned_ticket"))).toBeTruthy();
    expect(within(tickets).getByText(label("reassign_ticket"))).toBeTruthy();
  });

  it("keeps Public Lead Forms, Support Tickets and ticket configuration in their own groups", async () => {
    const user = await openScreen([role([])]);
    await search(user, "_");

    const forms = labelsIn(group("formularios web"));
    expect(forms.sort()).toEqual(
      ["manage_public_lead_forms", "publish_public_lead_forms", "view_public_lead_forms"].map(label).sort(),
    );

    const support = labelsIn(group("support_tickets"));
    expect(support).toContain(label("change_support_ticket_status"));
    expect(support).toContain(label("view_support_tickets"));
    expect(support).not.toContain(label("view_ticket"));
    expect(support).not.toContain(label("assign_unassigned_ticket"));

    const configuration = labelsIn(group("configuración"));
    expect(configuration).toContain(label("manage_ticket_config"));
    expect(configuration).toContain(label("configure_ticket_types"));
    expect(configuration).toContain(label("configure_ticket_priorities"));

    // Nothing from those special groups leaked into the ordinary ones.
    const leads = labelsIn(group("leads"));
    const tickets = labelsIn(group("tickets"));
    for (const name of forms) expect(leads).not.toContain(name);
    for (const name of support) expect(tickets).not.toContain(name);
    expect(tickets).not.toContain(label("manage_ticket_config"));
  });

  it("renders every permission of the catalog exactly once", async () => {
    const user = await openScreen([role([])]);
    await search(user, "_");

    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(CATALOG.length);
    for (const name of REAL_PERMISSION_NAMES) {
      expect(screen.getAllByText(label(name)), name).toHaveLength(1);
    }
  });

  it("no longer leaves any Leads, Tickets, support-ticket or ticket-configuration permission in 'otros permisos'", async () => {
    const user = await openScreen([role([])]);
    await search(user, "_");

    const fallback = labelsIn(group("otros permisos"));
    expect(fallback.length).toBeGreaterThan(0);
    for (const name of [
      "view_unassigned_leads",
      "assign_unassigned_ticket",
      "manage_ticket_config",
      "change_support_ticket_status",
      "assign_lead",
      "reassign_ticket",
    ]) {
      expect(fallback, name).not.toContain(label(name));
    }
    // ...while genuinely unclassified permissions still are there.
    expect(fallback).toContain(label("view_dashboard"));
    expect(fallback).toContain(label("manage_inventory"));
  });

  it("still shows a permission nobody has classified in the fallback, never dropping it", async () => {
    const withUnknown: Perm[] = [...CATALOG, { id: 9001, name: "view_lead_scoring" }, { id: 9002, name: "manage_ticket_sla" }];
    const user = await openScreen([role([])], 5, withUnknown);
    await search(user, "_");

    const fallback = labelsIn(group("otros permisos"));
    expect(fallback).toContain(label("view_lead_scoring"));
    expect(fallback).toContain(label("manage_ticket_sla"));
    expect(labelsIn(group("leads"))).not.toContain(label("view_lead_scoring"));
    expect(labelsIn(group("tickets"))).not.toContain(label("manage_ticket_sla"));
  });
});

describe("Roles & Permissions — counts reflect the corrected classification", () => {
  it("shows the group size and the assigned count for Leads and Tickets", async () => {
    const user = await openScreen([role(["view_leads", "assign_lead", "view_ticket"])]);
    await search(user, "_");

    const leads = group("leads");
    expect(within(leads).getByText(String(LEAD_PERMISSIONS.length))).toBeTruthy();
    expect(within(leads).getByText(`2/${LEAD_PERMISSIONS.length} asignados`)).toBeTruthy();

    const tickets = group("tickets");
    expect(within(tickets).getByText(String(TICKET_PERMISSIONS.length))).toBeTruthy();
    expect(within(tickets).getByText(`1/${TICKET_PERMISSIONS.length} asignados`)).toBeTruthy();
  });

  it("counts a newly recognized permission the role already holds", async () => {
    const user = await openScreen([role(["view_unassigned_leads", "assign_unassigned_ticket"])]);
    await search(user, "_");

    expect(within(group("leads")).getByText(`1/${LEAD_PERMISSIONS.length} asignados`)).toBeTruthy();
    expect(within(group("tickets")).getByText(`1/${TICKET_PERMISSIONS.length} asignados`)).toBeTruthy();
  });
});

describe("Roles & Permissions — search", () => {
  it("finds view_unassigned_leads under Leads and assign_unassigned_ticket under Tickets", async () => {
    const user = await openScreen([role([])]);
    await search(user, "unassigned");

    expect(labelsIn(group("leads"))).toEqual([label("view_unassigned_leads")]);
    expect(labelsIn(group("tickets"))).toEqual([label("assign_unassigned_ticket")]);
    expect(screen.queryByText("otros permisos")).toBeNull();
  });

  it("finds assign_lead and shows only its group", async () => {
    const user = await openScreen([role([])]);
    await search(user, "assign_lead");

    expect(labelsIn(group("leads"))).toEqual([label("assign_lead")]);
    expect(screen.queryAllByText("tickets").filter((el) => el.closest("button"))).toHaveLength(0);
  });
});

describe("Roles & Permissions — group selection sends the right ids", () => {
  it("'Seleccionar Todos' on Leads adds exactly the Leads ids and keeps everything else", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const user = await openScreen([role(["view_ticket", "view_dashboard"])]);
    await search(user, "_");

    await user.click(within(group("leads")).getByRole("button", { name: /Seleccionar Todos/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/roles/5/permissions", expect.anything()));
    const sent = (vi.mocked(api.put).mock.calls[0][1] as { permission_ids: number[] }).permission_ids;
    expect([...sent].sort((a, b) => a - b)).toEqual(
      [...LEAD_PERMISSIONS.map(idOf), idOf("view_ticket"), idOf("view_dashboard")].sort((a, b) => a - b),
    );
    expect(sent).toContain(idOf("assign_lead"));
    expect(sent).toContain(idOf("view_unassigned_leads"));
    for (const name of TICKET_PERMISSIONS.filter((n) => n !== "view_ticket")) expect(sent).not.toContain(idOf(name));
  });

  it("'Seleccionar Todos' on Tickets adds exactly the Tickets ids", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const user = await openScreen([role([])]);
    await search(user, "_");

    await user.click(within(group("tickets")).getByRole("button", { name: /Seleccionar Todos/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const sent = (vi.mocked(api.put).mock.calls[0][1] as { permission_ids: number[] }).permission_ids;
    expect([...sent].sort((a, b) => a - b)).toEqual(TICKET_PERMISSIONS.map(idOf).sort((a, b) => a - b));
    expect(sent).toContain(idOf("assign_unassigned_ticket"));
    expect(sent).toContain(idOf("reassign_ticket"));
    expect(sent).not.toContain(idOf("manage_ticket_config"));
    expect(sent).not.toContain(idOf("view_support_tickets"));
  });

  it("'Desmarcar Todos' on Leads removes only the Leads ids", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const user = await openScreen([role([...LEAD_PERMISSIONS, "view_ticket"])]);
    await search(user, "_");

    const button = within(group("leads")).getByRole("button", { name: /Desmarcar Todos/i });
    await user.click(button);

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const sent = (vi.mocked(api.put).mock.calls[0][1] as { permission_ids: number[] }).permission_ids;
    expect(sent).toEqual([idOf("view_ticket")]);
  });

  it("toggling one newly grouped permission sends only that change", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const user = await openScreen([role(["view_leads"])]);
    await search(user, "view_unassigned_leads");

    const checkbox = within(group("leads")).getByRole("checkbox");
    await user.click(checkbox);

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const sent = (vi.mocked(api.put).mock.calls[0][1] as { permission_ids: number[] }).permission_ids;
    expect([...sent].sort((a, b) => a - b)).toEqual([idOf("view_leads"), idOf("view_unassigned_leads")].sort((a, b) => a - b));
  });
});

describe("Roles & Permissions — protected permissions and global roles are unaffected", () => {
  const MANAGER = role([], { id: 9, name: "Manager", is_system_role: true, system_role_key: "manager" });

  it("group selection on a non-Admin role still never sends the protected permission", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const user = await openScreen([MANAGER], 9);
    await search(user, "public_lead_forms");

    await user.click(within(group("formularios web")).getByRole("button", { name: /Seleccionar Todos/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const sent = (vi.mocked(api.put).mock.calls[0][1] as { permission_ids: number[] }).permission_ids;
    expect(sent).not.toContain(idOf("publish_public_lead_forms"));
    expect(sent).toEqual(expect.arrayContaining([idOf("view_public_lead_forms"), idOf("manage_public_lead_forms")]));
  });

  it("the platform role is still never offered as an editable role", async () => {
    const platform = { id: 1, name: "superadmin", tenant_id: null, is_system_role: true, permissions: [] };
    mockLoad([platform, role([])]);
    render(<RolesPermissionsSettings canManage={true} />);

    const select = await screen.findByRole("combobox", { name: /Seleccionar Rol Existente/i });
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options.join(" ")).not.toMatch(/superadmin/i);
    expect(options.join(" ")).toMatch(/front_desk/);
  });
});
