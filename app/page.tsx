import Dashboard from "@/components/dashboard";
import snapshot from "@/data/leaderboard.json";
import type { Leaderboard } from "@/lib/leaderboard";

export default function Page() {
  return <Dashboard initialBoard={snapshot as Leaderboard} />;
}
