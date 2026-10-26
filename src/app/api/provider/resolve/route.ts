import { NextRequest, NextResponse } from "next/server";
import {
  providerConfigured,
  resolveVodByTitle,
  resolveSeriesByTitle,
  resolveStream,
} from "@/lib/provider";

export const dynamic = "force-dynamic";

/**
 * Resolves a real playback URL for the built-in PrimePlayer.
 * - ?title=&year=  → best provider match for a curated title
 * - ?kind=vod|series|live&id=(&episode=) → direct provider id resolution
 * Returns { playable: true, url } or { playable: false } — never a fake stream.
 */
export async function GET(req: NextRequest) {
  if (!providerConfigured()) {
    return NextResponse.json(
      {
        playable: false,
        configured: false,
        message: "Playback line not configured on the server. Add P_HOST / P_USER / P_PASS env.",
      },
      { status: 200 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  if (id && sp.get("kind")) {
    const kind = sp.get("kind") as "vod" | "series" | "live";
    const result = await resolveStream(kind, id, sp.get("episode") || undefined);
    return NextResponse.json(
      result ? { playable: true, configured: true, ...result } : { playable: false, configured: true }
    );
  }

  const title = sp.get("title");
  if (!title) {
    return NextResponse.json({ playable: false, configured: true }, { status: 400 });
  }
  const year = Number(sp.get("year")) || undefined;

  const asSeries = await resolveSeriesByTitle(title);
  if (asSeries) {
    return NextResponse.json({ playable: true, configured: true, ...asSeries });
  }
  const asVod = await resolveVodByTitle(title, year);
  if (asVod) {
    return NextResponse.json({ playable: true, configured: true, ...asVod });
  }
  return NextResponse.json({ playable: false, configured: true });
}
