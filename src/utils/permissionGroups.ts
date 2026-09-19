/**
 * Groups the backend's permission catalog into the categories the Roles & Permissions screen shows.
 *
 * Pure and dependency-free so the classification can be tested on its own. Group labels are the
 * exact strings the screen already displayed (they are the accordion titles); this module only
 * decides WHICH permission belongs to WHICH label.
 *
 * ## How a name is classified
 *
 * A permission name is `<verb>_<noun phrase>` (`view_unassigned_leads` -> noun `unassigned_leads`).
 * The noun phrase is everything after the first underscore, exactly as before. It is then run
 * through these steps, and the FIRST one that matches wins:
 *
 *   1. Special categories. They are decided first so that a longer, more specific noun can never
 *      be swallowed by an ordinary domain:
 *        - Public Lead Forms  (`public_lead_form(s)...`)  -> "formularios web", never Leads
 *        - Support Tickets    (`support_ticket(s)...`, `internal_notes`, `ticket_notifications`)
 *                             -> "support_tickets", never Tickets
 *        - Ticket configuration (`ticket_config`, `ticket_types`, `ticket_priorities`)
 *                             -> "configuración", never Tickets
 *   2. Ordinary domains, Leads and Tickets. The noun must be the domain's own singular or plural,
 *      optionally preceded by ONE known qualifier (`unassigned_`, `all_`):
 *        `lead`, `leads`, `unassigned_leads`, `all_leads`  -> "leads"
 *        `ticket`, `tickets`, `unassigned_ticket`          -> "tickets"
 *   3. The remaining legacy categories, by exact noun (`users`, `sales`, `products`, ...).
 *   4. Anything else -> the ONE fallback group. It is a real fallback: a name is never placed in a
 *      group because it merely CONTAINS a domain word, so a future permission such as
 *      `view_lead_scoring` or `manage_ticket_sla` shows up under "otros permisos" until someone
 *      classifies it on purpose, instead of being silently filed under Leads or Tickets.
 *
 * Every rule matches on whole tokens (`_`-separated), never on a substring.
 */

export const FALLBACK_PERMISSION_GROUP = "otros permisos";

export const PERMISSION_GROUP = {
  CONFIGURATION: "configuración",
  PROFESSIONALS: "profesionales",
  SALES: "sales",
  LEADS: "leads",
  TICKETS: "tickets",
  SUPPORT_TICKETS: "support_tickets",
  PRODUCTS: "products",
  APPOINTMENTS: "appointments",
  REFUNDS: "refunds",
  CONVERSATIONS: "conversations",
  EXPENSES: "expenses",
  PUBLIC_LEAD_FORMS: "formularios web",
} as const;

type NounMatcher = (noun: string) => boolean;

type Rule = { group: string; matches: NounMatcher };

/** Qualifiers that may precede a domain noun without changing which domain it belongs to. */
const DOMAIN_QUALIFIERS = ["unassigned", "all"] as const;

const oneOf =
  (...nouns: string[]): NounMatcher =>
  (noun) =>
    nouns.includes(noun);

/** `stem` at a token boundary: exactly `stem`, `stems`, or `stem_...` / `stems_...`. */
const startsWithToken =
  (stem: string): NounMatcher =>
  (noun) =>
    noun === stem || noun === `${stem}s` || noun.startsWith(`${stem}_`) || noun.startsWith(`${stem}s_`);

function withoutQualifier(noun: string): string {
  for (const qualifier of DOMAIN_QUALIFIERS) {
    if (noun.startsWith(`${qualifier}_`)) return noun.slice(qualifier.length + 1);
  }
  return noun;
}

/** The domain's own singular or plural, optionally preceded by one known qualifier. */
const domainNoun =
  (stem: string): NounMatcher =>
  (noun) => {
    const bare = withoutQualifier(noun);
    return bare === stem || bare === `${stem}s`;
  };

/** Ordered: special categories first, then the ordinary Leads/Tickets domains. */
const RULES: readonly Rule[] = [
  // 1. Special categories -- always before the ordinary domains.
  { group: PERMISSION_GROUP.PUBLIC_LEAD_FORMS, matches: startsWithToken("public_lead_form") },
  {
    group: PERMISSION_GROUP.SUPPORT_TICKETS,
    matches: (noun) =>
      startsWithToken("support_ticket")(noun.startsWith("all_") ? noun.slice(4) : noun) ||
      oneOf("internal_notes", "ticket_notifications")(noun),
  },
  {
    group: PERMISSION_GROUP.CONFIGURATION,
    matches: oneOf("ticket_config", "ticket_types", "ticket_type", "ticket_priorities", "ticket_priority"),
  },

  // 2. Ordinary domains.
  { group: PERMISSION_GROUP.LEADS, matches: domainNoun("lead") },
  { group: PERMISSION_GROUP.TICKETS, matches: domainNoun("ticket") },
];

/**
 * The remaining categories, keyed by exact noun phrase. Unchanged from the previous
 * implementation apart from the Leads/Tickets/Support/ticket-configuration entries, which the rules
 * above now cover.
 */
const LEGACY_GROUPS: Readonly<Record<string, string>> = {
  // Configuración
  user: PERMISSION_GROUP.CONFIGURATION,
  users: PERMISSION_GROUP.CONFIGURATION,
  branch: PERMISSION_GROUP.CONFIGURATION,
  branches: PERMISSION_GROUP.CONFIGURATION,
  role: PERMISSION_GROUP.CONFIGURATION,
  roles: PERMISSION_GROUP.CONFIGURATION,
  settings: PERMISSION_GROUP.CONFIGURATION,
  tenant: PERMISSION_GROUP.CONFIGURATION,
  tenants: PERMISSION_GROUP.CONFIGURATION,

  // Profesionales
  professional: PERMISSION_GROUP.PROFESSIONALS,
  professionals: PERMISSION_GROUP.PROFESSIONALS,

  // Ventas
  sale: PERMISSION_GROUP.SALES,
  sales: PERMISSION_GROUP.SALES,
  sale_increase_price: PERMISSION_GROUP.SALES,
  sale_decrease_price: PERMISSION_GROUP.SALES,
  import_sales: PERMISSION_GROUP.SALES,
  increase_price: PERMISSION_GROUP.SALES,
  decrease_price: PERMISSION_GROUP.SALES,
  all_sales: PERMISSION_GROUP.SALES,
  my_sales_only: PERMISSION_GROUP.SALES,

  // Otros dominios
  product: PERMISSION_GROUP.PRODUCTS,
  products: PERMISSION_GROUP.PRODUCTS,
  appointment: PERMISSION_GROUP.APPOINTMENTS,
  appointments: PERMISSION_GROUP.APPOINTMENTS,
  refund: PERMISSION_GROUP.REFUNDS,
  refunds: PERMISSION_GROUP.REFUNDS,
  conversation: PERMISSION_GROUP.CONVERSATIONS,
  conversations: PERMISSION_GROUP.CONVERSATIONS,
  all_conversations: PERMISSION_GROUP.CONVERSATIONS,
  expense: PERMISSION_GROUP.EXPENSES,
  expenses: PERMISSION_GROUP.EXPENSES,
};

/** Everything after the first underscore; a name with no underscore has no noun phrase. */
export function permissionNoun(name: string): string {
  const parts = name.split("_");
  return parts.length > 1 ? parts.slice(1).join("_") : "general";
}

/** The group label a permission belongs to. Never throws; unknown names get the fallback. */
export function classifyPermission(name: string): string {
  const noun = permissionNoun(name);

  for (const rule of RULES) {
    if (rule.matches(noun)) return rule.group;
  }

  return LEGACY_GROUPS[noun] ?? FALLBACK_PERMISSION_GROUP;
}

/**
 * Groups permissions by label, keeping the input order inside each group. `searchTerm` filters by a
 * case-insensitive substring of the permission NAME (the screen's search box); an empty term keeps
 * everything. Each input permission lands in exactly one group.
 */
export function groupPermissions<T extends { name: string }>(
  permissions: readonly T[],
  searchTerm = "",
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  const lowerSearch = searchTerm.toLowerCase();

  for (const permission of permissions) {
    if (lowerSearch && !permission.name.toLowerCase().includes(lowerSearch)) continue;

    const group = classifyPermission(permission.name);
    (groups[group] ??= []).push(permission);
  }

  return groups;
}
