import { describe, it, expect } from "vitest";
import {
  getTicketStatusLabel,
  getTicketCommentAuthorLabel,
  getTicketCommentTimestampLabel,
} from "../ticketPresentation";

/**
 * Manual Ingestion K6 UX closure, Corrections 4/5: presentation-only mapping for operative
 * Ticket/Task statuses and comment author/timestamp. The internal status values and the raw
 * `created_by`/`creator` fields are never mutated -- only what's shown on screen changes.
 */

describe("getTicketStatusLabel", () => {
  it("maps New to Nuevo", () => {
    expect(getTicketStatusLabel("New")).toBe("Nuevo");
  });

  it("maps InProgress to En tratamiento", () => {
    expect(getTicketStatusLabel("InProgress")).toBe("En tratamiento");
  });

  it("maps Completed to Completado", () => {
    expect(getTicketStatusLabel("Completed")).toBe("Completado");
  });

  it("maps Cancelled to Cancelado", () => {
    expect(getTicketStatusLabel("Cancelled")).toBe("Cancelado");
  });

  it("falls back to the raw value for an unrecognized status, never throwing", () => {
    expect(getTicketStatusLabel("SomethingElse")).toBe("SomethingElse");
  });
});

describe("getTicketCommentAuthorLabel", () => {
  it("prefers creator.name over everything else", () => {
    expect(
      getTicketCommentAuthorLabel({ creator: { id: 10, name: "Ana Pérez" }, created_by: 10 }),
    ).toBe("Ana Pérez");
  });

  it("prefers creator.name even when created_by is serialized as a string", () => {
    expect(
      getTicketCommentAuthorLabel({ creator: { id: 10, name: "Ana Pérez" }, created_by: "10" }),
    ).toBe("Ana Pérez");
  });

  it("falls back to a neutral 'unavailable' label carrying the id when creator is absent", () => {
    expect(getTicketCommentAuthorLabel({ creator: undefined, created_by: 10 })).toBe(
      "Usuario no disponible (#10)",
    );
  });

  it("falls back to the same neutral label when creator is explicitly null", () => {
    expect(getTicketCommentAuthorLabel({ creator: null, created_by: 10 })).toBe(
      "Usuario no disponible (#10)",
    );
  });

  it("falls back to the same neutral label when created_by is a string", () => {
    expect(getTicketCommentAuthorLabel({ creator: null, created_by: "10" })).toBe(
      "Usuario no disponible (#10)",
    );
  });

  it("never shows a bare numeric id -- the fallback always wraps it in context", () => {
    const label = getTicketCommentAuthorLabel({ creator: null, created_by: 10 });
    expect(label).not.toBe("10");
    expect(label).not.toBe(10 as unknown as string);
  });

  it("shows Sistema only when neither creator nor created_by exist", () => {
    expect(getTicketCommentAuthorLabel({ creator: null, created_by: null })).toBe("Sistema");
    expect(getTicketCommentAuthorLabel({ creator: undefined, created_by: undefined as never })).toBe(
      "Sistema",
    );
  });
});

describe("getTicketCommentTimestampLabel", () => {
  it("includes day, month, year, hour and minutes", () => {
    const label = getTicketCommentTimestampLabel("2026-09-12T10:49:00Z");
    expect(label).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);
  });
});
