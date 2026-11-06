/// <reference types="vite/client" />

interface WhopPixel {
  track: (event: string, props?: Record<string, unknown>) => void;
  setScope: (...accountIds: string[]) => void;
}

type Fbq = (...args: unknown[]) => void;

type Gtag = (...args: unknown[]) => void;

interface Window {
  whop?: WhopPixel;
  fbq?: Fbq;
  dataLayer?: unknown[];
  gtag?: Gtag;
}
