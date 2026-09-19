import { describe, it, expect } from "vitest";
import {
  FALLBACK_PERMISSION_GROUP,
  PERMISSION_GROUP,
  classifyPermission,
  groupPermissions,
  permissionNoun,
} from "../permissionGroups";
import { REAL_PERMISSION_NAMES } from "../../test/permissionCatalogFixture";

const asPerms = (names: readonly string[]) => names.map((name, i) => ({ id: i + 1, name }));

const sorted = (values: readonly string[]) => [...values].sort();

describe("permissionNoun", () => {
  it("is everything after the first underscore, or 'general' when there is none", () => {
    expect(permissionNoun("view_unassigned_leads")).toBe("unassigned_leads");
    expect(permissionNoun("manage_public_lead_forms")).toBe("public_lead_forms");
    expect(permissionNoun("ConversationAdmin")).toBe("general");
  });
});

describe("classifyPermission — Leads", () => {
  it.each([
    "create_lead",
    "delete_lead",
    "edit_lead",
    "import_leads",
    "view_leads",
    "assign_lead",
    "view_unassigned_leads",
  ])("%s belongs to leads", (name) => {
    expect(classifyPermission(name)).toBe(PERMISSION_GROUP.LEADS);
  });

  it("recognizes the domain's singular, plural and its known qualifiers", () => {
    for (const name of ["view_lead", "view_all_leads", "assign_unassigned_lead", "assign_unassigned_leads"]) {
      expect(classifyPermission(name), name).toBe(PERMISSION_GROUP.LEADS);
    }
  });
});

describe("classifyPermission — Tickets", () => {
  it.each([
    "create_ticket",
    "delete_ticket",
    "edit_ticket",
    "view_ticket",
    "reassign_ticket",
    "assign_unassigned_ticket",
  ])("%s belongs to tickets", (name) => {
    expect(classifyPermission(name)).toBe(PERMISSION_GROUP.TICKETS);
  });

  it("recognizes the domain's plural and its known qualifiers", () => {
    for (const name of ["view_tickets", "view_all_tickets", "assign_unassigned_tickets"]) {
      expect(classifyPermission(name), name).toBe(PERMISSION_GROUP.TICKETS);
    }
  });
});

describe("classifyPermission — special categories keep their own group", () => {
  it("Public Lead Forms never mixes with Leads", () => {
    for (const name of ["view_public_lead_forms", "manage_public_lead_forms", "publish_public_lead_forms"]) {
      expect(classifyPermission(name), name).toBe(PERMISSION_GROUP.PUBLIC_LEAD_FORMS);
    }
    expect(classifyPermission("view_public_lead_form_versions")).toBe(PERMISSION_GROUP.PUBLIC_LEAD_FORMS);
  });

  it("Support Tickets never mix with ordinary Tickets", () => {
    for (const name of [
      "view_support_tickets",
      "view_all_support_tickets",
      "manage_support_tickets",
      "create_support_ticket",
      "edit_support_ticket",
      "delete_support_ticket",
      "assign_support_ticket",
      "comment_support_ticket",
      "change_support_ticket_status",
      "silence_ticket_notifications",
      "create_internal_notes",
      "view_internal_notes",
    ]) {
      expect(classifyPermission(name), name).toBe(PERMISSION_GROUP.SUPPORT_TICKETS);
    }
  });

  it("Ticket configuration stays in configuración, never in Tickets", () => {
    for (const name of ["manage_ticket_config", "configure_ticket_types", "configure_ticket_priorities"]) {
      expect(classifyPermission(name), name).toBe(PERMISSION_GROUP.CONFIGURATION);
    }
  });

  it("does not pull other domains into Leads or Tickets", () => {
    expect(classifyPermission("view_conversations")).toBe(PERMISSION_GROUP.CONVERSATIONS);
    expect(classifyPermission("view_payment_requests")).toBe(FALLBACK_PERMISSION_GROUP);
    expect(classifyPermission("refund_payments")).toBe(FALLBACK_PERMISSION_GROUP);
    expect(classifyPermission("view_sales")).toBe(PERMISSION_GROUP.SALES);
    expect(classifyPermission("view_refunds")).toBe(PERMISSION_GROUP.REFUNDS);
  });
});

describe("classifyPermission — precedence and safety against look-alike names", () => {
  it("special categories win over the ordinary domain that a substring would suggest", () => {
    // Each of these contains the word "lead" or "ticket" but must land in its special group.
    expect(classifyPermission("manage_public_lead_forms")).not.toBe(PERMISSION_GROUP.LEADS);
    expect(classifyPermission("view_support_tickets")).not.toBe(PERMISSION_GROUP.TICKETS);
    expect(classifyPermission("manage_ticket_config")).not.toBe(PERMISSION_GROUP.TICKETS);
    expect(classifyPermission("silence_ticket_notifications")).not.toBe(PERMISSION_GROUP.TICKETS);
  });

  it("never files a future permission under Leads or Tickets just because it contains the word", () => {
    for (const name of [
      "view_lead_scoring",
      "manage_lead_sources",
      "export_leads_report",
      "manage_ticket_sla",
      "view_ticket_reports",
      "view_unassigned_customers",
      "view_misleading_metrics",
      "manage_bulletin_boards",
    ]) {
      expect(classifyPermission(name), name).toBe(FALLBACK_PERMISSION_GROUP);
    }
  });

  it("a name with no underscore, or an unknown one, gets the fallback", () => {
    expect(classifyPermission("ConversationAdmin")).toBe(FALLBACK_PERMISSION_GROUP);
    expect(classifyPermission("some_future_unknown_permission")).toBe(FALLBACK_PERMISSION_GROUP);
    expect(classifyPermission("")).toBe(FALLBACK_PERMISSION_GROUP);
  });

  it("keeps the previously recognized legacy categories exactly as they were", () => {
    const expected: Record<string, string> = {
      view_users: PERMISSION_GROUP.CONFIGURATION,
      create_branch: PERMISSION_GROUP.CONFIGURATION,
      manage_roles: PERMISSION_GROUP.CONFIGURATION,
      manage_settings: PERMISSION_GROUP.CONFIGURATION,
      view_professionals: PERMISSION_GROUP.PROFESSIONALS,
      manage_professionals: PERMISSION_GROUP.PROFESSIONALS,
      sale_increase_price: PERMISSION_GROUP.SALES,
      view_all_sales: PERMISSION_GROUP.SALES,
      view_my_sales_only: PERMISSION_GROUP.SALES,
      import_sales: PERMISSION_GROUP.SALES,
      view_products: PERMISSION_GROUP.PRODUCTS,
      view_appointments: PERMISSION_GROUP.APPOINTMENTS,
      approve_refund: PERMISSION_GROUP.REFUNDS,
      view_all_conversations: PERMISSION_GROUP.CONVERSATIONS,
      create_expense: PERMISSION_GROUP.EXPENSES,
    };
    for (const [name, group] of Object.entries(expected)) {
      expect(classifyPermission(name), name).toBe(group);
    }
  });
});

describe("the real backend catalog", () => {
  const groups = groupPermissions(asPerms(REAL_PERMISSION_NAMES));
  const namesIn = (group: string) => sorted((groups[group] ?? []).map((p) => p.name));

  it("places every permission in exactly one group, none lost and none duplicated", () => {
    const all = Object.values(groups).flat().map((p) => p.name);
    expect(all).toHaveLength(REAL_PERMISSION_NAMES.length);
    expect(new Set(all).size).toBe(REAL_PERMISSION_NAMES.length);
    expect(sorted(all)).toEqual(sorted(REAL_PERMISSION_NAMES));
  });

  it("groups every ordinary Leads permission together, assign_lead and view_unassigned_leads included", () => {
    expect(namesIn(PERMISSION_GROUP.LEADS)).toEqual(
      sorted([
        "assign_lead",
        "create_lead",
        "delete_lead",
        "edit_lead",
        "import_leads",
        "view_leads",
        "view_unassigned_leads",
      ]),
    );
  });

  it("groups every ordinary Tickets permission together, assign_unassigned_ticket and reassign_ticket included", () => {
    expect(namesIn(PERMISSION_GROUP.TICKETS)).toEqual(
      sorted([
        "assign_unassigned_ticket",
        "create_ticket",
        "delete_ticket",
        "edit_ticket",
        "reassign_ticket",
        "view_ticket",
      ]),
    );
  });

  it("keeps the special categories separate and complete", () => {
    expect(namesIn(PERMISSION_GROUP.PUBLIC_LEAD_FORMS)).toEqual(
      sorted(["manage_public_lead_forms", "publish_public_lead_forms", "view_public_lead_forms"]),
    );
    expect(namesIn(PERMISSION_GROUP.SUPPORT_TICKETS)).toEqual(
      sorted([
        "assign_support_ticket",
        "change_support_ticket_status",
        "comment_support_ticket",
        "create_internal_notes",
        "create_support_ticket",
        "delete_support_ticket",
        "edit_support_ticket",
        "manage_support_tickets",
        "silence_ticket_notifications",
        "view_all_support_tickets",
        "view_internal_notes",
        "view_support_tickets",
      ]),
    );
    expect(namesIn(PERMISSION_GROUP.CONFIGURATION)).toEqual(
      expect.arrayContaining(["manage_ticket_config", "configure_ticket_types", "configure_ticket_priorities"]),
    );
  });

  it("leaves no Leads or Tickets permission in the fallback", () => {
    for (const permission of groups[FALLBACK_PERMISSION_GROUP] ?? []) {
      expect(permission.name, permission.name).not.toMatch(/(^|_)(leads?|tickets?)(_|$)/);
    }
  });

  it("the fallback keeps genuinely unclassified permissions, so it is a real fallback", () => {
    const fallback = namesIn(FALLBACK_PERMISSION_GROUP);
    expect(fallback).toEqual(
      expect.arrayContaining(["view_dashboard", "manage_inventory", "refund_payments", "manage_branch_notification_reviewer"]),
    );
    expect(fallback.length).toBeGreaterThan(0);
  });

  it("reports per-group counts that add up to the whole catalog", () => {
    const counts = Object.fromEntries(Object.entries(groups).map(([group, perms]) => [group, perms.length]));
    expect(counts[PERMISSION_GROUP.LEADS]).toBe(7);
    expect(counts[PERMISSION_GROUP.TICKETS]).toBe(6);
    expect(counts[PERMISSION_GROUP.SUPPORT_TICKETS]).toBe(12);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(REAL_PERMISSION_NAMES.length);
  });
});

describe("groupPermissions — search", () => {
  const perms = asPerms(REAL_PERMISSION_NAMES);

  it("finds a permission by a substring of its name, case-insensitively, in its own group", () => {
    const found = groupPermissions(perms, "UNASSIGNED");

    expect(found[PERMISSION_GROUP.LEADS].map((p) => p.name)).toEqual(["view_unassigned_leads"]);
    expect(found[PERMISSION_GROUP.TICKETS].map((p) => p.name)).toEqual(["assign_unassigned_ticket"]);
    expect(Object.keys(found).sort()).toEqual([PERMISSION_GROUP.LEADS, PERMISSION_GROUP.TICKETS].sort());
  });

  it("a search that matches nothing yields no groups, and an empty term keeps everything", () => {
    expect(groupPermissions(perms, "zzz_no_such_permission")).toEqual({});
    expect(Object.values(groupPermissions(perms, "")).flat()).toHaveLength(perms.length);
  });

  it("filters before grouping, so counts reflect only the matches", () => {
    const found = groupPermissions(perms, "assign_lead");
    expect(found[PERMISSION_GROUP.LEADS]).toHaveLength(1);
    expect(Object.values(found).flat()).toHaveLength(1);
  });

  it("preserves the input order inside each group and does not mutate the input", () => {
    const input = asPerms(["view_leads", "assign_lead", "create_lead"]);
    const snapshot = JSON.stringify(input);

    const found = groupPermissions(input);

    expect(found[PERMISSION_GROUP.LEADS].map((p) => p.name)).toEqual(["view_leads", "assign_lead", "create_lead"]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
