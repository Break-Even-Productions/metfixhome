import { BSI_REF_RE, MFX_BSI_REF_KEY } from "../../../shared/account/courseReferrals";

export type BsiRefStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Capture valid ?bsi_ref= into injected web storage; strip from URL via history.replaceState. */
export function captureBsiRef(
  search: string,
  storage: BsiRefStorage,
  historyReplace?: (url: string) => void,
): string | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const raw = params.get("bsi_ref");
  if (raw == null) return readBsiRef(storage);

  if (!BSI_REF_RE.test(raw)) {
    // Invalid — do not store; still strip from URL.
    params.delete("bsi_ref");
    const next = params.toString();
    const path =
      typeof window !== "undefined"
        ? `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`
        : next
          ? `?${next}`
          : "";
    historyReplace?.(path);
    return readBsiRef(storage);
  }

  storage.setItem(MFX_BSI_REF_KEY, raw);
  params.delete("bsi_ref");
  const next = params.toString();
  if (typeof window !== "undefined") {
    const path = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    (historyReplace ?? ((u) => window.history.replaceState({}, "", u)))(path);
  } else {
    historyReplace?.(next ? `?${next}` : "");
  }
  return raw;
}

/** Read stored slug; drop tampered values. */
export function readBsiRef(storage: BsiRefStorage): string | null {
  const raw = storage.getItem(MFX_BSI_REF_KEY);
  if (raw == null) return null;
  if (!BSI_REF_RE.test(raw)) {
    storage.removeItem(MFX_BSI_REF_KEY);
    return null;
  }
  return raw;
}

/** Browser helper — reads mfx_bsi_ref from session storage when available. */
export function readStoredBsiRef(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return readBsiRef(sessionStorage);
}
