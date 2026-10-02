import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("validation");
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--use-angle=swiftshader", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 980 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", msg => { if (msg.type() === "error" && !msg.location().url.endsWith("/favicon.ico"))
  errors.push(`${msg.text()} @ ${msg.location().url}`); });
page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
try {
  await page.goto("http://127.0.0.1:5175/", { waitUntil: "networkidle" });
  await page.locator('[data-action="carry"]').click();
  await page.locator('[data-mode="workbench"]').click();
  await page.getByText("24 × 14 地格", { exact: false }).waitFor();
  await page.screenshot({ path: path.join(root, "workbench-briefing.png") });
  await page.locator('[data-action="start"]:enabled').waitFor({ timeout: 20000 });
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(root, "workbench-battle.png") });
  const result = { title: await page.title(), errors, modeVisible: await page.getByText("地图工坊验证 · 遗迹双路", { exact: false }).count(),
    canvas: await page.locator("#scene canvas").count() };
  await fs.writeFile(path.join(root, "workbench-ui.json"), JSON.stringify(result, null, 2));
  if (errors.length) throw Error(errors.join("\n"));
  console.log("WORKBENCH_GAME_UI_PASS", JSON.stringify(result));
} finally { await browser.close(); }
