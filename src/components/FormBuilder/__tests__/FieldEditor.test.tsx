import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FieldEditor from "../FieldEditor";
import type { PublicLeadFormField } from "../../../types";

const FIELDS = (): PublicLeadFormField[] => [
  { field_key: "name", label: "Nombre", help_text: null, placeholder: "Tu nombre", position: 1, visible: true, required: true },
  { field_key: "phone", label: "Teléfono", help_text: null, placeholder: null, position: 2, visible: true, required: true },
  { field_key: "email", label: "Correo", help_text: null, placeholder: null, position: 3, visible: true, required: false },
  { field_key: "last_name", label: "Apellido", help_text: null, placeholder: null, position: 4, visible: true, required: false },
  { field_key: "message", label: "Mensaje", help_text: null, placeholder: null, position: 5, visible: true, required: false },
  { field_key: "consent", label: "Consentimiento", help_text: null, placeholder: null, position: 6, visible: true, required: true },
];

describe("FieldEditor — system fields (name/consent) locked", () => {
  it("renders name/consent visibility and required checkboxes as disabled, always checked", () => {
    render(<FieldEditor fields={FIELDS()} onChange={vi.fn()} />);
    const nameRow = screen.getByTestId("field-row-name");
    const checkboxes = nameRow.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      expect((cb as HTMLInputElement).disabled).toBe(true);
      expect((cb as HTMLInputElement).checked).toBe(true);
    });
  });

  it("a non-system field's visibility/required checkboxes are interactive and toggle local state", async () => {
    const onChange = vi.fn();
    render(<FieldEditor fields={FIELDS()} onChange={onChange} />);
    const emailRow = screen.getByTestId("field-row-email");
    const requiredCheckbox = Array.from(emailRow.querySelectorAll('input[type="checkbox"]'))[1] as HTMLInputElement;
    expect(requiredCheckbox.disabled).toBe(false);

    const user = userEvent.setup();
    await user.click(requiredCheckbox);

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ field_key: "email", required: true })]),
    );
  });
});

describe("FieldEditor — reordering", () => {
  it("moving a field up swaps its position with the previous one, deterministically", async () => {
    const onChange = vi.fn();
    render(<FieldEditor fields={FIELDS()} onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText(/Mover Correo electrónico hacia arriba/i));

    const next = onChange.mock.calls[0][0] as PublicLeadFormField[];
    const email = next.find((f) => f.field_key === "email")!;
    const phone = next.find((f) => f.field_key === "phone")!;
    expect(email.position).toBe(2);
    expect(phone.position).toBe(3);
  });

  it("the first field's 'move up' button is disabled; the last field's 'move down' is disabled", () => {
    render(<FieldEditor fields={FIELDS()} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Mover Nombre hacia arriba/i)).toBeDisabled();
    expect(screen.getByLabelText(/Mover Consentimiento hacia abajo/i)).toBeDisabled();
  });
});

describe("FieldEditor — backend contact-method and per-field errors", () => {
  it("shows the contact-method error banner when passed, without inferring it locally", () => {
    render(
      <FieldEditor
        fields={FIELDS()}
        onChange={vi.fn()}
        contactMethodError="Debe haber al menos un método de contacto visible y obligatorio."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/método de contacto/i);
  });

  it("renders a 422 field-level error next to its own field, not as a generic banner", () => {
    render(
      <FieldEditor
        fields={FIELDS()}
        onChange={vi.fn()}
        fieldErrors={{ "schema.2.label": "La etiqueta contiene caracteres no permitidos." }}
      />,
    );
    expect(screen.getByText(/caracteres no permitidos/i)).toBeTruthy();
  });
});

describe("FieldEditor — disabled state (no manage permission / submitting)", () => {
  it("disables every interactive control when disabled=true", () => {
    render(<FieldEditor fields={FIELDS()} onChange={vi.fn()} disabled />);
    document.querySelectorAll('input[type="checkbox"], input[type="text"], button').forEach((el) => {
      expect((el as HTMLButtonElement | HTMLInputElement).disabled).toBe(true);
    });
  });
});
