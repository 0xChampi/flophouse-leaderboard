import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const url = process.argv[2] || "http://127.0.0.1:3247";
const board = JSON.parse(await readFile(new URL("../data/leaderboard.json", import.meta.url), "utf8"));
const reports = fileURLToPath(new URL("../reports/", import.meta.url));
await mkdir(reports, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.platform === "darwin" ? { channel: "chrome" } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
const results = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  assert.equal(await page.locator("tbody tr").count(), 10);
  const h1 = await page.locator("h1").innerText();
  assert.ok(h1.includes("Your leaderboard."));
  await page.screenshot({ path: reports + "desktop.png", fullPage: true });
  results.push({ check: "initial desktop", players: board.players.length, rows: 10 });

  const search = page.getByRole("searchbox", { name: "Search players" });
  await search.fill("TheOddCall");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.locator("tbody").getByRole("button", { name: "View TheOddCall, rank 1", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.getByRole("dialog").getByRole("heading", { name: "TheOddCall", exact: true }).count(), 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await search.fill("this-player-does-not-exist");
  assert.equal(await page.locator("tbody tr").count(), 0);
  assert.equal(await page.getByText("No players found", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(await page.locator("tbody tr").count(), 10);
  results.push({ check: "search, empty state, native dialog and Escape", passed: true });

  await page.getByRole("button", { name: /^Prize positions/ }).click();
  assert.equal(await page.locator("tbody tr").count(), board.prizes.length);
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  assert.ok((await page.locator("tbody tr").first().innerText()).includes(board.players[10].name));
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), board.players.length);
  await page.getByRole("combobox", { name: "Sort standings" }).selectOption("name");
  const alphabetical = [...board.players].sort((a, b) => a.name.localeCompare(b.name));
  assert.ok((await page.locator("tbody tr").first().innerText()).includes(alphabetical[0].name));
  results.push({ check: "prize filter, pagination, all players and sorting", passed: true });

  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export displayed standings as CSV", exact: true }).click();
  const download = await downloaded;
  await download.saveAs(reports + "standings.csv");
  const csv = await readFile(reports + "standings.csv", "utf8");
  assert.equal(csv.split("\r\n").length, board.players.length + 1);
  await page.getByRole("button", { name: "Copy eligibility code flop", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "flop");
  await page.getByRole("button", { name: "Share board", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), page.url());
  results.push({ check: "CSV download, eligibility clipboard and sharing", passed: true });

  const refreshed = page.waitForResponse(response => response.url().includes("/api/leaderboard"));
  await page.getByRole("button", { name: "Refresh standings", exact: true }).click();
  const api = await (await refreshed).json();
  assert.equal(api.board.id, "20764");
  if (api.mode === "snapshot") assert.equal(api.board.capturedAt, board.capturedAt);
  results.push({ check: "refresh API", mode: api.mode, capturePreserved: api.mode === "snapshot" });

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 1040 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    const measures = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, background: getComputedStyle(document.body).backgroundColor, font: getComputedStyle(document.querySelector("h1")).fontFamily }));
    assert.ok(measures.document <= width, `Page overflow at ${width}: ${measures.document}`);
    if (width === 390) await page.screenshot({ path: reports + "mobile.png", fullPage: true });
    if (width === 1440) await page.screenshot({ path: reports + "desktop.png", fullPage: true });
    results.push({ check: "responsive layout", width, ...measures });
  }
  assert.deepEqual(errors, []);
  await writeFile(reports + "browser-checks.json", JSON.stringify({ url, checkedAt: new Date().toISOString(), results, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, results, errors }));
} finally {
  await browser.close();
}
