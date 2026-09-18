import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Help from "../Help";

/**
 * Form Builder B3 Help Center entry ("Formularios Web"). Covers: nav entry presence and
 * position, correct title/description on selection, presence of every required section,
 * accordion open/close behavior, accuracy of the publish/activate/pause and delivery copy,
 * the anti-bot copy never implying a per-tenant widget, absence of internal/operational
 * details, keyboard operability (same native-button pattern as the rest of the Help Center),
 * and non-regression of pre-existing entries.
 */
describe("Help — Formularios Web", () => {
  const openFormulariosWeb = async () => {
    const user = userEvent.setup();
    render(<Help />);
    await user.click(screen.getByRole("button", { name: /Formularios Web/ }));
    return user;
  };

  it("lists Formularios Web in the sidebar navigation, between Contactos / Leads and Live Chat", () => {
    render(<Help />);
    const nav = screen.getByRole("navigation");
    const labels = within(nav)
      .getAllByRole("button")
      .map((btn) => btn.textContent ?? "");

    const leadsIndex = labels.findIndex((l) => l.includes("Contactos / Leads"));
    const formsIndex = labels.findIndex((l) => l.includes("Formularios Web"));
    const chatIndex = labels.findIndex((l) => l.includes("Live Chat"));

    expect(leadsIndex).toBeGreaterThanOrEqual(0);
    expect(formsIndex).toBe(leadsIndex + 1);
    expect(chatIndex).toBe(formsIndex + 1);
  });

  it("shows the correct title and description when selected", async () => {
    await openFormulariosWeb();
    expect(screen.getByRole("heading", { name: "Formularios Web" })).toBeTruthy();
    expect(screen.getByText("Formularios de captación pública y su ciclo de vida")).toBeTruthy();
  });

  it("renders every required section as a collapsible header", async () => {
    await openFormulariosWeb();
    const expectedSections = [
      "Qué es Formularios Web",
      "Acceso y Permisos",
      "Listado de Formularios",
      "Creación de un Formulario",
      "Pestaña General",
      "Pestaña Campos",
      "Consentimiento y Privacidad",
      "Pestaña Preview",
      "Borradores y Versiones",
      "Publicar, Activar y Pausar",
      "Estados de Disponibilidad",
      "Protección Anti-bots",
      "Entrega al Cliente",
      "Integración mediante iframe",
      "Experiencia del Visitante",
      "Qué sucede con el Lead enviado",
      "Solución de Problemas",
      "Buenas Prácticas",
      "Flujo Recomendado Completo",
    ];

    for (const title of expectedSections) {
      expect(screen.getByRole("button", { name: new RegExp(title) })).toBeTruthy();
    }
  });

  it("opens and closes an accordion section on click, and only the default section starts open", async () => {
    const user = await openFormulariosWeb();

    expect(screen.queryByText(/dominios autorizados a enviar el formulario/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Pestaña General/ }));
    expect(screen.getByText(/dominios autorizados a enviar el formulario/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Pestaña General/ }));
    expect(screen.queryByText(/dominios autorizados a enviar el formulario/i)).toBeNull();
  });

  it("keeps the default-open intro section visible without any click", async () => {
    await openFormulariosWeb();
    expect(
      screen.getByText(/cada envío válido de un formulario público se convierte automáticamente en un nuevo Lead/i),
    ).toBeTruthy();
  });

  it("states that publishing and activating are separate actions, and that pausing preserves configuration and history", async () => {
    const user = await openFormulariosWeb();
    await user.click(screen.getByRole("button", { name: /Publicar, Activar y Pausar/ }));

    expect(screen.getByText(/publicar y activar son acciones distintas/i)).toBeTruthy();
    expect(
      screen.getByText(/convierte el borrador actual en la nueva versión pública del formulario — pero no lo activa por sí sola/i),
    ).toBeTruthy();
    expect(screen.getByText(/habilita la captación pública con la última versión publicada/i)).toBeTruthy();
    expect(
      screen.getByText(/un formulario pausado conserva intactos su configuración, sus campos, su marca y todo su historial/i),
    ).toBeTruthy();
  });

  it("explains Hosted URL and the iframe embed, and ties them to a published + active form", async () => {
    const user = await openFormulariosWeb();
    await user.click(screen.getByRole("button", { name: /Entrega al Cliente/ }));

    expect(
      screen.getByText(/la dirección pública donde el formulario vive como página completa, alojada por SPA Manager Pro/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/fragmento de código listo para pegar en el sitio del cliente, que incrusta el formulario/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/aparecen únicamente cuando el formulario tiene una versión publicada y está activo/i),
    ).toBeTruthy();
  });

  it("never claims each tenant must create or configure its own Turnstile/Cloudflare widget", async () => {
    const user = await openFormulariosWeb();
    await user.click(screen.getByRole("button", { name: /Protección Anti-bots/ }));

    const panel = screen.getByText(/esta protección la configura y administra la plataforma de forma centralizada/i);
    expect(panel).toBeTruthy();
    expect(
      screen.getByText(/usted no necesita crear ni configurar su propio widget de verificación/i),
    ).toBeTruthy();

    const fullText = document.body.textContent ?? "";
    expect(fullText).not.toMatch(/debe crear (su|un) (propio )?widget/i);
    expect(fullText).not.toMatch(/cada tenant debe configurar/i);
  });

  it("never exposes internal variable names, secrets, endpoints, or server-operational instructions", async () => {
    await openFormulariosWeb();
    const fullText = document.body.textContent ?? "";

    const forbidden = [
      /VITE_[A-Z_]+/,
      /TURNSTILE_SECRET/i,
      /\.env\b/,
      /X-API-KEY/i,
      /page_url/,
      /9aecba2/,
      /php artisan/i,
      /\bssh\b/i,
      /\bcurl\b/i,
      /config\(['"]/,
    ];

    for (const pattern of forbidden) {
      expect(fullText).not.toMatch(pattern);
    }
  });

  it("is keyboard-operable using the same native-button pattern as the rest of the Help Center", async () => {
    const user = userEvent.setup();
    render(<Help />);

    const navButton = screen.getByRole("button", { name: /Formularios Web/ });
    navButton.focus();
    expect(document.activeElement).toBe(navButton);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Formularios Web" })).toBeTruthy();

    const sectionButton = screen.getByRole("button", { name: /Pestaña Campos/ });
    sectionButton.focus();
    expect(document.activeElement).toBe(sectionButton);
    await user.keyboard("{Enter}");
    expect(screen.getByText(/el formulario cuenta con 6 campos disponibles/i)).toBeTruthy();
  });

  it("does not break pre-existing Help Center entries", async () => {
    const user = userEvent.setup();
    render(<Help />);

    await user.click(screen.getByRole("button", { name: /Panel de Control/ }));
    expect(screen.getByRole("heading", { name: "Panel de Control" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Contactos \/ Leads/ }));
    expect(screen.getByRole("heading", { name: "Leads / Contactos" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Live Chat/ }));
    expect(screen.getByRole("heading", { name: "Live Chat" })).toBeTruthy();
  });
});
