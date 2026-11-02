/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SANITY_PROJECT_ID?: string;
  readonly VITE_SANITY_DATASET?: string;
  readonly VITE_SANITY_API_VERSION?: string;
  /** FU-1: KEY removal with Map.tsx; URL removed in PR E (S6). */
  readonly VITE_FRONTEND_FORGE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
