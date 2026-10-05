export const RACE_ID = "20764";
export const SOURCE_URL = `https://gamba.com/promotions/exclusive-leaderboards/${RACE_ID}`;

export type Player = {
  id: string;
  name: string;
  rank: number;
  wagered: number;
  vip: string;
  avatar: string | null;
};

export type Prize = { rank: number; percentage: number; amount: number };
export type Contribution = { min: number; max: number; percentage: number };
export type Leaderboard = {
  id: string;
  name: string;
  sourceUrl: string;
  capturedAt: string;
  startsAtSource: string;
  endsAtSource: string;
  endsAt: string | null;
  currency: string;
  prizePool: number;
  host: string;
  eligibility: string;
  players: Player[];
  prizes: Prize[];
  contributions: Contribution[];
};
export type LeaderboardResponse = {
  board: Leaderboard;
  mode: "source" | "snapshot";
  message: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid source object");
  return value as Record<string, unknown>;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${label}`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 160) throw new Error(`Invalid ${label}`);
  return value.trim();
}

function rank(value: unknown): number {
  const n = finite(value, "rank");
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid rank");
  return n;
}

function sourceDate(value: unknown): string {
  const s = text(value, "date");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) throw new Error("Unexpected source date");
  const [date, time] = s.split(" ");
  const parsed = new Date(`${date}T${time}Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== `${date}T${time}`) throw new Error("Invalid date");
  // This validates the calendar value; it does not assign a source timezone.
  return s;
}

export function normalizeRace(payload: unknown, capturedAt: string, verifiedEnd: string | null = null): Leaderboard {
  const root = record(payload);
  const data = record(root.data);
  const race = record(data.getRaceById);
  if (String(race.id) !== RACE_ID) throw new Error("Unexpected race ID");
  if (!Array.isArray(race.competitors) || race.competitors.length === 0) throw new Error("Missing players");
  const players: Player[] = race.competitors.map(value => {
    const p = record(value);
    let avatar: string | null = null;
    if (typeof p.avatar === "string") {
      try {
        const u = new URL(p.avatar);
        if (u.protocol === "https:" && u.hostname === "imagedelivery.net") avatar = u.href;
      } catch { /* Untrusted image URLs use initials. */ }
    }
    return { id: text(p.id, "player ID"), name: text(p.display_name, "player name"), rank: rank(p.position), wagered: finite(p.total_wagered, "wager"), vip: text(p.vip_level_name, "VIP tier"), avatar };
  }).sort((a, b) => a.rank - b.rank);
  if (new Set(players.map(p => p.id)).size !== players.length || new Set(players.map(p => p.rank)).size !== players.length) throw new Error("Duplicate players or positions");
  if (!Array.isArray(race.prize_distribution) || !race.prize_distribution.length) throw new Error("Missing prizes");
  const prizes = race.prize_distribution.map(value => {
    const p = record(value);
    return { rank: rank(p.position), percentage: finite(p.percentage, "prize percentage"), amount: finite(p.amount, "prize amount") };
  }).sort((a, b) => a.rank - b.rank);
  const prizePool = finite(race.prize_pool, "prize pool");
  if (new Set(prizes.map(p => p.rank)).size !== prizes.length || Math.abs(prizes.reduce((a, p) => a + p.percentage, 0) - 100) > 0.01 || Math.abs(prizes.reduce((a, p) => a + p.amount, 0) - prizePool) > 0.05) throw new Error("Incoherent prize distribution");
  if (!Array.isArray(race.rtp_contribution) || !race.rtp_contribution.length) throw new Error("Missing contribution rules");
  const contributions = race.rtp_contribution.map(value => {
    const c = record(value);
    if (!Array.isArray(c.range) || c.range.length !== 2) throw new Error("Invalid contribution range");
    const min = finite(c.range[0], "range start"), max = finite(c.range[1], "range end"), percentage = finite(c.contribution, "contribution");
    if (max < min || max > 100 || percentage > 100) throw new Error("Invalid contribution range");
    return { min, max, percentage };
  });
  const sponsor = record(race.sponsor), currency = record(race.currency);
  if (!Array.isArray(race.eligibility) || !race.eligibility.length) throw new Error("Missing eligibility");
  if (!Number.isFinite(new Date(capturedAt).getTime())) throw new Error("Invalid capture timestamp");
  const startsAtSource = sourceDate(race.start_date), endsAtSource = sourceDate(race.end_date);
  if (endsAtSource <= startsAtSource) throw new Error("Invalid season interval");
  if (verifiedEnd && !Number.isFinite(new Date(verifiedEnd).getTime())) throw new Error("Invalid verified deadline");
  const endsAt = verifiedEnd && new Date(verifiedEnd).toISOString().slice(0, 19) === endsAtSource.replace(" ", "T") ? verifiedEnd : null;
  return { id: RACE_ID, name: text(race.race_name, "race name"), sourceUrl: SOURCE_URL, capturedAt, startsAtSource, endsAtSource, endsAt, currency: text(currency.code, "currency"), prizePool, host: text(sponsor.display_name, "host"), eligibility: text(record(race.eligibility[0]).code, "eligibility"), players, prizes, contributions };
}

export function prizeFor(board: Leaderboard, rank: number): number {
  return board.prizes.find(p => p.rank === rank)?.amount ?? 0;
}

export const amount = (value: number, digits = 2) => new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export function calendarDate(source: string): string {
  const [year, month, day] = source.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function standingsCsv(board: Leaderboard, players: Player[]): string {
  const cell = (value: string | number) => {
    let s = String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows: (string | number)[][] = [["Rank", "Player", "VIP tier", `Qualifying wager (${board.currency})`, `Projected prize (${board.currency})`, "Captured at (UTC)"]];
  players.forEach(p => rows.push([p.rank, p.name, p.vip, p.wagered.toFixed(2), prizeFor(board, p.rank).toFixed(2), board.capturedAt]));
  return rows.map(row => row.map(cell).join(",")).join("\r\n");
}
