import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tabs from "../Tabs";

describe("Tabs", () => {
  it("marks the active tab via aria-selected and calls onChange with the clicked key", async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[{ key: "a", label: "A" }, { key: "b", label: "B" }]}
        activeKey="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe("false");

    await userEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("never fires onChange for a disabled tab", async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[{ key: "a", label: "A" }, { key: "b", label: "B", disabled: true }]}
        activeKey="a"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
