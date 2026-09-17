import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CopyButton from "../CopyButton";

/**
 * `@testing-library/user-event` installs its own `navigator.clipboard` stub inside
 * `userEvent.setup()` (to support `user.paste()`), which would silently overwrite an override
 * applied beforehand -- so the mock is (re)installed AFTER `setup()`, not in a `beforeEach`.
 */
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("CopyButton", () => {
  it("copies the exact value passed, never a derived or reconstructed one", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(<CopyButton value="https://example.com/f/uuid-1" label="Copiar URL" />);
    await user.click(screen.getByRole("button", { name: /Copiar URL/i }));

    expect(writeText).toHaveBeenCalledWith("https://example.com/f/uuid-1");
    expect(await screen.findByText("Copiado")).toBeTruthy();
  });

  it("shows a failure state, never a crash, when the clipboard API rejects", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));

    render(<CopyButton value="x" label="Copiar" />);
    await user.click(screen.getByRole("button", { name: "Copiar" }));

    expect(await screen.findByText(/No se pudo copiar/i)).toBeTruthy();
  });
});
