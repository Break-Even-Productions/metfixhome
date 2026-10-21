import { mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * Gate / PR2 QA test config (committed for CK-P1 / mutation runner).
 * Same include rules as root `npm test`; harness modules are not `*.test.ts`.
 */
export default mergeConfig(viteConfig, {
  test: {
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "../shared/**/*.test.ts",
      "../worker/**/*.test.ts",
    ],
    exclude: ["../worker/**/*.workers.test.ts", "**/node_modules/**"],
  },
});
