import { chromium } from "@playwright/test";
import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizeRace, SOURCE_URL } from "../lib/leaderboard.ts";

const boardPath = fileURLToPath(new URL("../data/leaderboard.json", import.meta.url));
const rawPath = fileURLToPath(new URL("../data/source-capture.json", import.meta.url));
const previous = JSON.parse(await readFile(boardPath, "utf8"));
const browser = await chromium.launch({ headless: true, ...(process.platform === "darwin" ? { channel: "chrome" } : {}) });
try {
  const page = await browser.newPage();
  const captured = page.waitForResponse(response => response.url().includes("operationName=getRaceById") && response.status() === 200, { timeout: 45000 });
  await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  const response = await captured;
  const raw = await response.json();
  const end = raw?.data?.getRaceById?.end_date === previous.endsAtSource ? previous.endsAt : null;
  const board = normalizeRace(raw, new Date().toISOString(), end);
  for (const [path, data] of [[rawPath, raw], [boardPath, board]]) {
    await writeFile(path + ".tmp", JSON.stringify(data, null, 2) + "\n");
    await rename(path + ".tmp", path);
  }
  console.log(`Verified ${board.players.length} players in race ${board.id}; captured ${board.capturedAt}.`);
  console.log("Review the data diff, commit it, and redeploy to publish this capture.");
} catch (error) {
  console.error("Source capture failed; previous standings were retained.");
  console.error(error instanceof Error ? error.message : "Unknown source error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
