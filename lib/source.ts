import snapshot from "../data/leaderboard.json" with { type: "json" };
import { normalizeRace, type Leaderboard, type LeaderboardResponse } from "./leaderboard.ts";

export const savedBoard = snapshot as Leaderboard;
export const SOURCE_API = "https://gamba.com/_api/@?" + new URLSearchParams({
  operationName: "getRaceById",
  variables: JSON.stringify({ raceId: 20764 }),
  extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: "fce626ac48edaaf1714f52415711e5dae485413957763c994722e034350e8e29" } }),
}).toString();

export async function readStandings(fetcher: typeof fetch = fetch): Promise<LeaderboardResponse> {
  try {
    const response = await fetcher(SOURCE_API, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4500), cache: "no-store" });
    if (!response.ok) throw new Error("Source unavailable");
    const board = normalizeRace(await response.json(), new Date().toISOString(), savedBoard.endsAt);
    return { board, mode: "source", message: "Standings refreshed from Gamba." };
  } catch {
    return { board: savedBoard, mode: "snapshot", message: "Showing the verified source capture. Check Gamba for the latest standings." };
  }
}
