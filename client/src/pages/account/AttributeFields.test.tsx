/**
 * @vitest-environment jsdom
 */
import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AttributeFields, type AttributeFieldModel, type AttributeWrite } from "./AttributeFields";

function Harness({ fields }: { fields: AttributeFieldModel[] }) {
  const [, setWrites] = useState<AttributeWrite[]>([]);
  return <AttributeFields fields={fields} idPrefix="t" onChange={setWrites} />;
}

const fields: AttributeFieldModel[] = [
  { attr_id: 1, label: "Phone", form_type: "phone", value: "555" },
  { attr_id: 2, label: "Site", form_type: "url", value: "https://example.com" },
  { attr_id: 3, label: "Listed", form_type: "tag", value: "1" },
  {
    attr_id: 4,
    label: "Home gym",
    form_type: "affiliate_select",
    value: "8",
    options: [{ id: 8, name: "MetFix Jax" }],
  },
];

afterEach(() => cleanup());

describe("AttributeFields", () => {
  it("picks the control from form_type", async () => {
    render(<Harness fields={fields} />);
    await waitFor(() => expect(screen.getByLabelText("Phone").getAttribute("type")).toBe("tel"));
    expect(screen.getByLabelText("Site").getAttribute("type")).toBe("url");
    expect((screen.getByLabelText("Listed") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Home gym") as HTMLSelectElement).value).toBe("8");
    expect(screen.getByRole("option", { name: "MetFix Jax" })).toBeTruthy();
  });
});
