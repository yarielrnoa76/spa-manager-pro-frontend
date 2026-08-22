import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimezoneSelect } from "../TimezoneSelect";

describe("TimezoneSelect — not a free-text input", () => {
  it("does not commit an arbitrary typed value -- onChange only fires when an option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TimezoneSelect label="Zona horaria" value="America/New_York" onChange={onChange} required />);

    const field = screen.getByRole("combobox", { name: /Zona horaria/i });
    await user.click(field);
    await user.type(field, "not a real timezone at all");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders as a combobox with a listbox, not a plain <select>", () => {
    render(<TimezoneSelect label="Zona horaria" value="America/New_York" onChange={vi.fn()} required />);

    expect(screen.getByRole("combobox", { name: /Zona horaria/i })).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(); // closed by default
  });
});

describe("TimezoneSelect — current value display", () => {
  it("displays the current timezone value", () => {
    render(<TimezoneSelect label="Zona horaria" value="America/New_York" onChange={vi.fn()} required />);

    expect(screen.getByDisplayValue("America/New_York")).toBeInTheDocument();
  });
});

describe("TimezoneSelect — search", () => {
  it("contains America/New_York among its options", async () => {
    const user = userEvent.setup();
    render(<TimezoneSelect label="Zona horaria" value="" onChange={vi.fn()} required />);

    await user.click(screen.getByRole("combobox", { name: /Zona horaria/i }));
    await user.type(screen.getByRole("combobox", { name: /Zona horaria/i }), "America/New_York");

    expect(await screen.findByRole("option", { name: /America\/New_York/ })).toBeInTheDocument();
  });

  it("searching 'New York' finds America/New_York", async () => {
    const user = userEvent.setup();
    render(<TimezoneSelect label="Zona horaria" value="" onChange={vi.fn()} required />);

    await user.click(screen.getByRole("combobox", { name: /Zona horaria/i }));
    await user.type(screen.getByRole("combobox", { name: /Zona horaria/i }), "New York");

    expect(await screen.findByRole("option", { name: /America\/New_York/ })).toBeInTheDocument();
  });

  it("searching 'Puerto Rico' finds America/Puerto_Rico", async () => {
    const user = userEvent.setup();
    render(<TimezoneSelect label="Zona horaria" value="" onChange={vi.fn()} required />);

    await user.click(screen.getByRole("combobox", { name: /Zona horaria/i }));
    await user.type(screen.getByRole("combobox", { name: /Zona horaria/i }), "Puerto Rico");

    expect(await screen.findByRole("option", { name: /America\/Puerto_Rico/ })).toBeInTheDocument();
  });

  it("searching 'Los Angeles' finds America/Los_Angeles", async () => {
    const user = userEvent.setup();
    render(<TimezoneSelect label="Zona horaria" value="" onChange={vi.fn()} required />);

    await user.click(screen.getByRole("combobox", { name: /Zona horaria/i }));
    await user.type(screen.getByRole("combobox", { name: /Zona horaria/i }), "Los Angeles");

    expect(await screen.findByRole("option", { name: /America\/Los_Angeles/ })).toBeInTheDocument();
  });
});

describe("TimezoneSelect — selecting an option", () => {
  it("selecting America/New_York updates the form state via onChange with the exact IANA id", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimezoneSelect label="Zona horaria" value="" onChange={onChange} required />);

    await user.click(screen.getByRole("combobox", { name: /Zona horaria/i }));
    await user.type(screen.getByRole("combobox", { name: /Zona horaria/i }), "New York");
    // The option row's interactive element is the inner <button> (role="option" describes the
    // enclosing <li>) -- click that directly, matching what a real cursor would land on.
    await user.click(await screen.findByRole("button", { name: /America\/New_York/ }));

    expect(onChange).toHaveBeenCalledWith("America/New_York");
  });
});

describe("TimezoneSelect — mount does not mutate the value", () => {
  it("never calls onChange just from rendering/mounting", () => {
    const onChange = vi.fn();
    render(<TimezoneSelect label="Zona horaria" value="America/New_York" onChange={onChange} required />);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("TimezoneSelect — legacy/unknown value safety", () => {
  it("preserves and displays an unknown/legacy timezone value instead of silently dropping it", () => {
    render(<TimezoneSelect label="Zona horaria" value="America/Notarealcity" onChange={vi.fn()} required />);

    expect(screen.getByDisplayValue("America/Notarealcity")).toBeInTheDocument();
  });

  it("offers the unknown legacy value as the first selectable option", async () => {
    const user = userEvent.setup();
    render(<TimezoneSelect label="Zona horaria" value="America/Notarealcity" onChange={vi.fn()} required />);

    await user.click(screen.getByRole("combobox", { name: /Zona horaria/i }));

    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveTextContent("America/Notarealcity");
  });
});
