import { readStandings } from "@/lib/source";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await readStandings();
  return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff" } });
}
