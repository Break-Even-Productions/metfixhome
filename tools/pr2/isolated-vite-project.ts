/**
 * Isolated Vite project tree for in-suite builds.
 * Copies config + sources into mkdtemp and symlinks package entries so
 * `node_modules/.vite-temp` lands under the temp tree (not the repo) —
 * same spirit as #10 / V12 porcelain isolation.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type IsolatedViteProject = {
  root: string;
  configFile: string;
  clientRoot: string;
  cleanup: () => void;
};

export function makeIsolatedViteProject(
  repoRoot: string,
  prefix = "iso-vite-",
): IsolatedViteProject {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  for (const name of [
    "vite.config.ts",
    "package.json",
    "tsconfig.json",
    "wrangler.jsonc",
    "components.json",
  ]) {
    const src = path.join(repoRoot, name);
    if (existsSync(src)) {
      cpSync(src, path.join(root, name));
    }
  }
  for (const name of ["client", "shared", "vite", "attached_assets"]) {
    const src = path.join(repoRoot, name);
    if (!existsSync(src)) continue;
    cpSync(src, path.join(root, name), { recursive: true });
  }
  // Ensure envDir resolution has a package boundary even if package.json copy failed.
  if (!existsSync(path.join(root, "package.json"))) {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "iso-vite-temp", private: true, type: "module" }),
    );
  }

  const nm = path.join(root, "node_modules");
  mkdirSync(nm, { recursive: true });
  const repoNm = path.join(repoRoot, "node_modules");
  if (existsSync(repoNm)) {
    for (const entry of readdirSync(repoNm, { withFileTypes: true })) {
      if (entry.name.startsWith(".vite")) continue;
      symlinkSync(path.join(repoNm, entry.name), path.join(nm, entry.name));
    }
  }

  return {
    root,
    configFile: path.join(root, "vite.config.ts"),
    clientRoot: path.join(root, "client"),
    cleanup: () => {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
