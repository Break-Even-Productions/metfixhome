import { type ChildProcess, spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const XML_CT = /^(application|text)\/xml(; ?charset=utf-8)?$/i;
const HEAD_IGNORE = ["date", "cf-ray"];
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

let base = "";
let persistDir = "";

let child: ChildProcess | undefined;
let logs = "";

function headersObject(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (HEAD_IGNORE.includes(name)) return;
    out[name] = out[name] === undefined ? value : `${out[name]}, ${value}`;
  });
  return out;
}

function parseXml(xml: string): Document {
  const window = new JSDOM("").window;
  return new window.DOMParser().parseFromString(xml, "application/xml");
}

function call(pathname: string, method: "GET" | "HEAD" = "GET"): Promise<Response> {
  return fetch(`${base}${pathname}`, {
    method,
    redirect: "manual",
    headers: { "Accept-Encoding": "identity" },
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("no tcp port")));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function killGroup(proc: ChildProcess | undefined) {
  if (!proc?.pid) return;
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill("SIGTERM");
  }
}

async function ready(): Promise<void> {
  const deadline = Date.now() + 90_000;
  let last = "";
  while (Date.now() < deadline) {
    if (child?.exitCode != null) {
      throw new Error(`wrangler exited ${child.exitCode}\n${logs}`);
    }
    try {
      const res = await call("/sitemap.xml");
      if (res.status === 200) {
        await res.arrayBuffer();
        return;
      }
      last = `status ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`wrangler dev --local was not ready (${last})\n${logs}`);
}

beforeAll(async () => {
  const port = await freePort();
  const inspectorPort = await freePort();
  persistDir = mkdtempSync(path.join(tmpdir(), "metfix-sitemap-index-"));
  base = `http://127.0.0.1:${port}`;
  const wranglerArgs = [
    "dev",
    "--local",
    "--port",
    String(port),
    "--ip",
    "127.0.0.1",
    "--inspector-port",
    String(inspectorPort),
    "--persist-to",
    persistDir,
    "--log-level",
    "info",
    "--config",
    "wrangler.jsonc",
  ];
  expect(wranglerArgs).toContain("--local");
  expect(wranglerArgs).not.toContain("--remote");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  process.stdout.write(`sitemap-index preview HEAD ${sha}\n`);
  const wranglerBin = path.join(repoRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  const env = { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_ACCOUNT_ID;
  child = spawn(process.execPath, [wranglerBin, ...wranglerArgs], {
    cwd: repoRoot,
    detached: true,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  await ready();
}, 120_000);

afterAll(() => {
  killGroup(child);
  if (persistDir) rmSync(persistDir, { recursive: true, force: true });
});

it("T13 GET status and type", async () => {
  for (const pathname of ["/sitemap.xml", "/sitemap-pages.xml"]) {
    const res = await call(pathname);
    expect(res.status, pathname).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct, pathname).toMatch(XML_CT);
    await res.arrayBuffer();
  }
  const daily = await call("/sitemap-daily-fix.xml");
  const dailyCt = daily.headers.get("content-type") ?? "";
  expect(dailyCt).not.toMatch(/^text\/html/i);
  if (daily.status === 503) {
    expect(daily.headers.get("cache-control") ?? "").toContain("no-store");
  } else {
    expect(daily.status).toBe(200);
    expect(dailyCt).toMatch(XML_CT);
    const body = await daily.text();
    const doc = parseXml(body);
    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
  }
});

it("T14 GET /sitemap.xml body is the built file", async () => {
  const res = await call("/sitemap.xml");
  const body = await res.text();
  expect(body).toBe(readFileSync(path.join(repoRoot, "dist", "public", "sitemap.xml"), "utf8"));
  const doc = parseXml(body);
  expect(doc.documentElement.localName).toBe("sitemapindex");
  expect(doc.documentElement.namespaceURI).toBe(NS);
});

it("T15 HEAD equals GET", async () => {
  expect(HEAD_IGNORE).toEqual(["date", "cf-ray"]);
  const paths = ["/sitemap.xml", "/sitemap-pages.xml", "/sitemap-daily-fix.xml"];
  for (const pathname of paths) {
    const get = await call(pathname, "GET");
    const head = await call(pathname, "HEAD");
    const getCt = get.headers.get("content-type") ?? "";
    expect(getCt, pathname).not.toMatch(/^text\/html/i);
    if (pathname === "/sitemap-daily-fix.xml" && get.status === 503) {
      expect(head.status, pathname).toBe(503);
      expect(get.headers.get("cache-control") ?? "").toContain("no-store");
    } else {
      expect(head.status, pathname).toBe(200);
      expect(getCt, pathname).toMatch(XML_CT);
    }
    expect(await head.text(), pathname).toBe("");
    const getHeaders = headersObject(get);
    const headHeaders = headersObject(head);
    if (headHeaders["content-length"] !== undefined) {
      expect(headHeaders["content-length"], pathname).toBe(getHeaders["content-length"]);
    }
    delete getHeaders["content-length"];
    delete headHeaders["content-length"];
    expect(headHeaders, pathname).toEqual(getHeaders);
    expect(headHeaders.etag, pathname).toBe(getHeaders.etag);
    if (pathname !== "/sitemap-daily-fix.xml" || get.status === 200) {
      expect(getHeaders.etag, pathname).toBeTruthy();
    }
  }
});

it("T16 /sitemap_index.xml is a 301", async () => {
  for (const method of ["GET", "HEAD"] as const) {
    const reqUrl = `${base}/sitemap_index.xml`;
    const res = await call("/sitemap_index.xml", method);
    expect(res.status, method).toBe(301);
    const loc = res.headers.get("Location");
    expect(loc, method).not.toBeNull();
    expect(new URL(loc!, reqUrl).href).toBe(new URL("/sitemap.xml", reqUrl).href);
    await res.arrayBuffer();
  }
});

it("T17 responses are not SPA HTML", async () => {
  for (const pathname of ["/sitemap.xml", "/sitemap-pages.xml", "/sitemap-daily-fix.xml", "/sitemap_index.xml"]) {
    const res = await call(pathname);
    const ct = res.headers.get("content-type") ?? "";
    const body = await res.text();
    expect(ct, pathname).not.toMatch(/^text\/html/i);
    expect(body.trimStart().toLowerCase().startsWith("<!doctype html"), pathname).toBe(false);
  }
});

it("T18 following the redirect returns the index", async () => {
  const reqUrl = `${base}/sitemap_index.xml`;
  const first = await call("/sitemap_index.xml");
  const loc = first.headers.get("Location");
  expect(loc).not.toBeNull();
  const second = await fetch(new URL(loc!, reqUrl), {
    redirect: "manual",
    headers: { "Accept-Encoding": "identity" },
  });
  expect(second.status).toBe(200);
  expect(second.headers.get("content-type") ?? "").toMatch(XML_CT);
  const body = await second.text();
  expect(body).toBe(readFileSync(path.join(repoRoot, "dist", "public", "sitemap.xml"), "utf8"));
  const doc = parseXml(body);
  expect(doc.getElementsByTagName("parsererror").length).toBe(0);
  expect(doc.documentElement.localName).toBe("sitemapindex");
});

it("T22 /_redirects does not disclose the rule", async () => {
  const res = await call("/_redirects");
  const body = await res.text();
  expect(body).not.toContain("/sitemap_index.xml /sitemap.xml 301");
  for (const line of body.split(/\r?\n/)) {
    expect(line.includes("/sitemap_index.xml") && /\b301\b/.test(line)).toBe(false);
  }
});
