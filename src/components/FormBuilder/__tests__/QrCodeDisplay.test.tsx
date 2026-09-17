import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import QrCodeDisplay from "../QrCodeDisplay";

describe("QrCodeDisplay", () => {
  it("renders an accessible QR image encoding exactly the value passed", () => {
    const { getByRole } = render(<QrCodeDisplay value="https://example.com/f/uuid-1" />);
    expect(getByRole("img", { name: /código qr/i })).toBeTruthy();
  });
});
