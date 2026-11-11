import { useEffect, useMemo, useState } from "react";
import { accountRead } from "@/lib/affiliateAccount";
import type { ProfileAddressValue, ProfileSelectOption } from "./profileAttributes";

export type AttributeFieldModel = {
  attr_id: number;
  label: string;
  description?: string;
  category?: string;
  form_type: string;
  value: string;
  address?: ProfileAddressValue | null;
  options?: ProfileSelectOption[];
};

export type AttributeWrite = {
  attr_id: number;
  form_type: string;
  value: string;
  address?: Record<string, string>;
};

type LocationOption = { id: number; name: string };

type Draft = {
  value: string;
  address: ProfileAddressValue;
};

function emptyAddress(seed?: ProfileAddressValue | null): ProfileAddressValue {
  return {
    address: seed?.address ?? "",
    address2: seed?.address2 ?? "",
    city: seed?.city ?? "",
    zip: seed?.zip ?? "",
    state: seed?.state ?? null,
    country: seed?.country ?? 1,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  WorkWith: "Work with",
  SocialMedia: "Social",
  Other: "Other",
  WorkQuestions: "Work",
  SpecialtyQuestions: "Specialty",
  PersonalQuestions: "Personal",
  MedInterestQuestions: "Medical interests",
  Credentials: "Credentials",
  Map: "Map",
};

function categoryLabel(raw: string): string {
  return CATEGORY_LABELS[raw] ?? raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function inputType(formType: string): "text" | "tel" | "url" {
  if (formType === "phone") return "tel";
  if (formType === "link" || formType === "url") return "url";
  return "text";
}

export function attributeWrites(fields: AttributeFieldModel[], drafts: Record<number, Draft>): AttributeWrite[] {
  return fields.map((field) => {
    const draft = drafts[field.attr_id];
    const formType = field.form_type || "text";
    if (formType === "address") {
      const address = draft?.address ?? emptyAddress(field.address);
      return {
        attr_id: field.attr_id,
        form_type: formType,
        value: "",
        address: {
          address: address.address,
          address2: address.address2,
          city: address.city,
          zip: address.zip,
          country: String(address.country ?? 1),
          state: address.state == null ? "" : String(address.state),
        },
      };
    }
    if (formType === "tag") {
      return {
        attr_id: field.attr_id,
        form_type: formType,
        value: draft?.value === "1" ? "1" : "0",
      };
    }
    return {
      attr_id: field.attr_id,
      form_type: formType,
      value: draft?.value ?? field.value,
    };
  });
}

export function AttributeFields(props: {
  fields: AttributeFieldModel[];
  idPrefix: string;
  onChange: (writes: AttributeWrite[]) => void;
}) {
  const { fields, idPrefix, onChange } = props;
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [statesByCountry, setStatesByCountry] = useState<Record<number, LocationOption[]>>({});

  useEffect(() => {
    const next: Record<number, Draft> = {};
    for (const field of fields) {
      next[field.attr_id] = {
        value: field.form_type === "tag" ? (field.value === "1" ? "1" : "0") : field.value,
        address: emptyAddress(field.address),
      };
    }
    setDrafts(next);
  }, [fields]);

  useEffect(() => {
    onChange(attributeWrites(fields, drafts));
  }, [fields, drafts, onChange]);

  const needsCountries = fields.some((field) => field.form_type === "address");
  useEffect(() => {
    if (!needsCountries) return;
    const ac = new AbortController();
    accountRead<{ countries: LocationOption[] }>("/api/account/locations/countries", ac.signal)
      .then((body) => setCountries(Array.isArray(body.countries) ? body.countries : []))
      .catch(() => setCountries([]));
    return () => ac.abort();
  }, [needsCountries]);

  const countryIds = useMemo(() => {
    const ids = new Set<number>();
    for (const field of fields) {
      if (field.form_type !== "address") continue;
      const id = drafts[field.attr_id]?.address.country ?? field.address?.country ?? 1;
      if (id) ids.add(id);
    }
    return [...ids];
  }, [fields, drafts]);

  useEffect(() => {
    const ac = new AbortController();
    for (const countryId of countryIds) {
      if (statesByCountry[countryId]) continue;
      accountRead<{ states: LocationOption[] }>(
        `/api/account/locations/states?country_id=${countryId}`,
        ac.signal,
      )
        .then((body) => {
          setStatesByCountry((current) => ({
            ...current,
            [countryId]: Array.isArray(body.states) ? body.states : [],
          }));
        })
        .catch(() => {
          setStatesByCountry((current) => ({ ...current, [countryId]: [] }));
        });
    }
    return () => ac.abort();
  }, [countryIds, statesByCountry]);

  const groups = useMemo(() => {
    const map = new Map<string, AttributeFieldModel[]>();
    for (const field of fields) {
      const key = field.category?.trim() || "";
      const list = map.get(key) ?? [];
      list.push(field);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [fields]);

  function patch(id: number, partial: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { value: "", address: emptyAddress() }), ...partial },
    }));
  }

  return (
    <>
      {groups.map(([category, rows]) => (
        <div key={category || "fields"} className="settings-block">
          {category ? <h3>{categoryLabel(category)}</h3> : null}
          {rows.map((field) => {
            const draft = drafts[field.attr_id];
            const formType = field.form_type || "text";
            return (
              <div key={field.attr_id}>
                {formType === "tag" ? (
                  <label className="account-inline-check">
                    <input
                      type="checkbox"
                      aria-label={field.label}
                      checked={draft?.value === "1"}
                      onChange={(e) => patch(field.attr_id, { value: e.target.checked ? "1" : "0" })}
                    />
                    {field.label}
                  </label>
                ) : formType === "affiliate_select" ? (
                  <label>
                    {field.label}
                    <select
                      aria-label={field.label}
                      value={draft?.value ?? ""}
                      onChange={(e) => patch(field.attr_id, { value: e.target.value })}
                    >
                      <option value="">Select</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt.id} value={String(opt.id)}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : formType === "address" ? (
                  <fieldset className="account-form">
                    <legend>{field.label}</legend>
                    <label>
                      Street
                      <input
                        id={`${idPrefix}-addr-${field.attr_id}`}
                        value={draft?.address.address ?? ""}
                        onChange={(e) =>
                          patch(field.attr_id, {
                            address: { ...(draft?.address ?? emptyAddress()), address: e.target.value },
                          })
                        }
                      />
                    </label>
                    <label>
                      Line 2
                      <input
                        value={draft?.address.address2 ?? ""}
                        onChange={(e) =>
                          patch(field.attr_id, {
                            address: { ...(draft?.address ?? emptyAddress()), address2: e.target.value },
                          })
                        }
                      />
                    </label>
                    <label>
                      City
                      <input
                        value={draft?.address.city ?? ""}
                        onChange={(e) =>
                          patch(field.attr_id, {
                            address: { ...(draft?.address ?? emptyAddress()), city: e.target.value },
                          })
                        }
                      />
                    </label>
                    <label>
                      Country
                      <select
                        value={String(draft?.address.country ?? 1)}
                        onChange={(e) =>
                          patch(field.attr_id, {
                            address: {
                              ...(draft?.address ?? emptyAddress()),
                              country: Number(e.target.value),
                              state: null,
                            },
                          })
                        }
                      >
                        {countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      State
                      <select
                        value={draft?.address.state == null ? "" : String(draft.address.state)}
                        onChange={(e) =>
                          patch(field.attr_id, {
                            address: {
                              ...(draft?.address ?? emptyAddress()),
                              state: e.target.value ? Number(e.target.value) : null,
                            },
                          })
                        }
                      >
                        <option value="">Select</option>
                        {(statesByCountry[draft?.address.country ?? 1] ?? []).map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      ZIP
                      <input
                        value={draft?.address.zip ?? ""}
                        onChange={(e) =>
                          patch(field.attr_id, {
                            address: { ...(draft?.address ?? emptyAddress()), zip: e.target.value },
                          })
                        }
                      />
                    </label>
                  </fieldset>
                ) : (
                  <label>
                    {field.label}
                    <input
                      type={inputType(formType)}
                      value={draft?.value ?? ""}
                      onChange={(e) => patch(field.attr_id, { value: e.target.value })}
                    />
                  </label>
                )}
                {field.description ? <p className="account-muted">{field.description}</p> : null}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
