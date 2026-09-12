import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import NotificationBell from "../NotificationBell";
import { api } from "../../services/api";

/**
 * Manual Ingestion K6 UX closure, Correction 3: the bell must visually identify BOTH
 * notification families with an explicit text label (color/icon alone is never sufficient), and
 * must keep navigating to the backend's own `url` and marking-as-read exactly as before.
 */

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: {
      listNotifications: vi.fn(),
      markNotificationAsRead: vi.fn(),
      markAllNotificationsAsRead: vi.fn(),
    },
  };
});

const NOTIF = (overrides: Record<string, unknown>) => ({
  id: 1,
  user_id: "1",
  type: "support_ticket_created",
  title: "Título",
  body: "Cuerpo",
  url: "/support-tickets/5",
  read_at: undefined,
  created_at: "2026-09-12T10:00:00Z",
  ...overrides,
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
};

const renderBell = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <LocationProbe />
      <NotificationBell />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.markNotificationAsRead).mockResolvedValue(undefined as never);
  vi.mocked(api.markAllNotificationsAsRead).mockResolvedValue(undefined as never);
});

// Before opening, the bell's own toggle is the only button in the tree.
const openBell = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button"));
};

describe("NotificationBell — family identification (Correction 3)", () => {
  it("shows the 'Soporte técnico' label for support_ticket_created/assigned/status_changed/commented", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [
        NOTIF({ id: 1, type: "support_ticket_created" }),
        NOTIF({ id: 2, type: "support_ticket_assigned" }),
        NOTIF({ id: 3, type: "support_ticket_status_changed" }),
        NOTIF({ id: 4, type: "support_ticket_commented" }),
      ],
      unread_count: 4,
    });
    const user = userEvent.setup();
    renderBell();
    await openBell(user);

    expect(await screen.findAllByText("Soporte técnico")).toHaveLength(4);
    expect(screen.queryByText("Ticket / Task")).toBeNull();
  });

  it("shows the 'Ticket / Task' label for ticket_assigned and lead_ticket_needs_review", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [
        NOTIF({ id: 1, type: "ticket_assigned", url: "/tickets/9" }),
        NOTIF({ id: 2, type: "lead_ticket_needs_review", url: "/tickets/10" }),
      ],
      unread_count: 2,
    });
    const user = userEvent.setup();
    renderBell();
    await openBell(user);

    expect(await screen.findAllByText("Ticket / Task")).toHaveLength(2);
    expect(screen.queryByText("Soporte técnico")).toBeNull();
  });

  it("never shows a family label for a general notification", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 1, type: "tenant_context_switched", url: undefined })],
      unread_count: 1,
    });
    const user = userEvent.setup();
    renderBell();
    await openBell(user);

    await screen.findByText("Título");
    expect(screen.queryByText("Soporte técnico")).toBeNull();
    expect(screen.queryByText("Ticket / Task")).toBeNull();
  });
});

describe("NotificationBell — click behavior is preserved", () => {
  it("clicking an unread notification marks it read and navigates to its own url", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 7, type: "ticket_assigned", url: "/tickets/9", read_at: undefined })],
      unread_count: 1,
    });
    const user = userEvent.setup();
    renderBell();
    await openBell(user);

    await user.click(await screen.findByText("Título"));

    await waitFor(() => expect(api.markNotificationAsRead).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.getByTestId("location-probe").textContent).toBe("/tickets/9"));
  });

  it("clicking a support-ticket notification navigates to its own /support-tickets/{id} url", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 8, type: "support_ticket_created", url: "/support-tickets/5" })],
      unread_count: 1,
    });
    const user = userEvent.setup();
    renderBell();
    await openBell(user);

    await user.click(await screen.findByText("Título"));

    await waitFor(() => expect(screen.getByTestId("location-probe").textContent).toBe("/support-tickets/5"));
  });

  it('"Marcar todas como leídas" still calls the bulk endpoint', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 1 })],
      unread_count: 1,
    });
    const user = userEvent.setup();
    renderBell();
    await openBell(user);

    await user.click(await screen.findByText("Marcar todas como leídas"));
    await waitFor(() => expect(api.markAllNotificationsAsRead).toHaveBeenCalledTimes(1));
  });
});
