import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeRace, standingsCsv } from "../lib/leaderboard.ts";
import { readStandings, savedBoard } from "../lib/source.ts";

const capture = JSON.parse(readFileSync(new URL("./fixtures/gamba-20764.json", import.meta.url), "utf8"));
const timestamp = "2026-10-05T04:56:20.806Z";
const clone = () => structuredClone(capture);

test("maps the actual Flophouse standings and coherent prizes without inventing a timezone", () => {
  const board = normalizeRace(capture, timestamp);
  assert.equal(board.id, "20764");
  assert.equal(board.host, "Travszzz");
  assert.equal(board.eligibility, "flop");
  assert.equal(board.players[0].name, "TheOddCall");
  assert.equal(board.players.length, 39);
  assert.equal(board.prizes.length, 10);
  assert.equal(board.endsAt, null);
  assert.equal(board.endsAtSource, "2026-10-14 23:59:59");
  assert.ok(Math.abs(board.prizes.reduce((sum, p) => sum + p.amount, 0) - board.prizePool) < 0.01);
});

test("rejects another race, duplicate competitors, invalid money and impossible dates", () => {
  const other = clone(); other.data.getRaceById.id = "1";
  assert.throws(() => normalizeRace(other, timestamp), /race ID/);
  const duplicate = clone(); duplicate.data.getRaceById.competitors[1].id = duplicate.data.getRaceById.competitors[0].id;
  assert.throws(() => normalizeRace(duplicate, timestamp), /Duplicate/);
  const invalid = clone(); invalid.data.getRaceById.competitors[0].total_wagered = Infinity;
  assert.throws(() => normalizeRace(invalid, timestamp), /wager/);
  const date = clone(); date.data.getRaceById.end_date = "2026-02-30 23:59:59";
  assert.throws(() => normalizeRace(date, timestamp), /date/);
  const prizes = clone(); prizes.data.getRaceById.prize_distribution[0].amount = 0;
  assert.throws(() => normalizeRace(prizes, timestamp), /distribution/);
});

test("source denial, timeout and malformed responses keep the original capture timestamp", async () => {
  const rejected = (async () => new Response("Forbidden", { status: 403 })) as typeof fetch;
  const timedOut = (async () => { throw new DOMException("Timeout", "TimeoutError"); }) as typeof fetch;
  const malformed = (async () => Response.json({ data: {} })) as typeof fetch;
  for (const fetcher of [rejected, timedOut, malformed]) {
    const result = await readStandings(fetcher);
    assert.equal(result.mode, "snapshot");
    assert.equal(result.board.capturedAt, savedBoard.capturedAt);
    assert.equal(result.board.players[0].name, savedBoard.players[0].name);
  }
});

test("valid successful refresh is labelled as a source response", async () => {
  const result = await readStandings((async () => Response.json(capture)) as typeof fetch);
  assert.equal(result.mode, "source");
  assert.equal(result.board.id, "20764");
  assert.ok(Number.isFinite(Date.parse(result.board.capturedAt)));
});

test("a changed source deadline does not inherit an older verified countdown", () => {
  const changed = clone(); changed.data.getRaceById.end_date = "2026-10-15 23:59:59";
  const board = normalizeRace(changed, timestamp, "2026-10-14T23:59:59Z");
  assert.equal(board.endsAt, null);
});

test("CSV escapes quoted names and neutralizes spreadsheet formula injection", () => {
  const board = normalizeRace(capture, timestamp);
  const csv = standingsCsv(board, [{ ...board.players[0], name: '=HYPERLINK("https://example.com")' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.ok(csv.includes("Qualifying wager (USDT)"));
  assert.ok(csv.includes(timestamp));
});
