import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import Notifications from "../Notifications";
import { api } from "../../services/api";

/**
 * Manual Ingestion K6 UX closure, Correction 3: the full notifications page must identify both
 * families with an explicit text label (never color/icon alone), and mark-as-read / navigation
 * must keep working exactly as before.
 */

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: {
      listNotifications: vi.fn(),
      markNotificationAsRead: vi.fn(),
      markAllNotificationsAsRead: vi.fn(),
      deleteNotification: vi.fn(),
      deleteAllNotifications: vi.fn(),
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <LocationProbe />
      <Notifications />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.markNotificationAsRead).mockResolvedValue(undefined as never);
});

describe("Notifications page — family identification (Correction 3)", () => {
  it("shows 'Soporte técnico' for support_ticket_* notifications", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [
        NOTIF({ id: 1, type: "support_ticket_created" }),
        NOTIF({ id: 2, type: "support_ticket_assigned" }),
        NOTIF({ id: 3, type: "support_ticket_status_changed" }),
        NOTIF({ id: 4, type: "support_ticket_commented" }),
      ],
      pagination: { current_page: 1, last_page: 1, total: 4 },
    });
    renderPage();

    expect(await screen.findAllByText("Soporte técnico")).toHaveLength(4);
    expect(screen.queryByText("Ticket / Task")).toBeNull();
  });

  it("shows 'Ticket / Task' for ticket_assigned and lead_ticket_needs_review, including the one that used to fall through to the generic icon", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [
        NOTIF({ id: 1, type: "ticket_assigned", url: "/tickets/9" }),
        NOTIF({ id: 2, type: "lead_ticket_needs_review", url: "/tickets/10" }),
      ],
      pagination: { current_page: 1, last_page: 1, total: 2 },
    });
    renderPage();

    expect(await screen.findAllByText("Ticket / Task")).toHaveLength(2);
  });

  it("never labels a general notification as either family", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 1, type: "tenant_context_switched", url: undefined })],
      pagination: { current_page: 1, last_page: 1, total: 1 },
    });
    renderPage();

    await screen.findByText("Título");
    expect(screen.queryByText("Soporte técnico")).toBeNull();
    expect(screen.queryByText("Ticket / Task")).toBeNull();
  });
});

describe("Notifications page — click and mark-as-read behavior is preserved", () => {
  it("clicking a Ticket/Task notification marks it read and navigates to /tickets/{id}", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 7, type: "ticket_assigned", url: "/tickets/9" })],
      pagination: { current_page: 1, last_page: 1, total: 1 },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("Título"));

    await waitFor(() => expect(api.markNotificationAsRead).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.getByTestId("location-probe").textContent).toBe("/tickets/9"));
  });

  it("clicking a Soporte técnico notification navigates to /support-tickets/{id}, never /tickets/{id}", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 8, type: "support_ticket_created", url: "/support-tickets/5" })],
      pagination: { current_page: 1, last_page: 1, total: 1 },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("Título"));

    await waitFor(() => expect(screen.getByTestId("location-probe").textContent).toBe("/support-tickets/5"));
  });

  it("the explicit mark-as-read button still calls the endpoint", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue({
      notifications: [NOTIF({ id: 3, read_at: undefined })],
      pagination: { current_page: 1, last_page: 1, total: 1 },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTitle("Marcar como leída"));
    await waitFor(() => expect(api.markNotificationAsRead).toHaveBeenCalledWith(3));
  });
});
