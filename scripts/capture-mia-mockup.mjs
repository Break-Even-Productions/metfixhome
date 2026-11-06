import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const out =
  "/cursor/stores/bc-2beac79b-9400-4a59-9c4f-471d3f80a3a8/media/dashboard-redesign";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
for (const [hash, name] of [
  ["#dashboard", "mockup_dashboard_overview"],
  ["#dashboard/benchmarks", "mockup_dashboard_benchmarks"],
  ["#dashboard/meals", "mockup_dashboard_meals"],
  ["#dashboard/profile", "mockup_dashboard_profile"],
]) {
  await page.goto(`https://mia-metfix.break-even-productions.workers.dev/${hash}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("saved", name);
}
await browser.close();
