import { resolveLine, authCheck } from "@/lib/xtream";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const line = resolveLine(req);
  if (!line) {
    return Response.json(
      { auth: false, error: "no_line", message: "No IPTV line configured. Add env P_HOST/P_USER/P_PASS or connect a line in the app." },
      { status: 200 }
    );
  }
  try {
    const info = await authCheck(line);
    return Response.json({ ...info, host: line.host });
  } catch (e) {
    return Response.json(
      { auth: false, error: e instanceof Error ? e.message : "provider_error" },
      { status: 200 }
    );
  }
}
