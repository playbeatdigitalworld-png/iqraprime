import { NextRequest, NextResponse } from "next/server";
import { providerConfigured, browseProvider, searchProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!providerConfigured()) {
    return NextResponse.json({ configured: false, items: [] }, { status: 200 });
  }
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  if (q) return NextResponse.json({ configured: true, ...(await searchProvider(q)) });

  const kind = sp.get("kind") === "series" ? "series" : "vod";
  const categoryId = sp.get("cat") || undefined;
  const page = Math.max(1, Number(sp.get("page") || 1));
  const data = await browseProvider(kind, categoryId, page, 60);
  return NextResponse.json({ configured: true, kind, categoryId: categoryId ?? null, ...data });
}
