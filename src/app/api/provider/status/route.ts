import { NextResponse } from "next/server";
import { providerConfigured, providerSummary } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!providerConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message:
          "Set P_HOST, P_USER and P_PASS in the server environment to activate the full provider library (VOD + series).",
      },
      { status: 200 }
    );
  }
  const summary = await providerSummary();
  return NextResponse.json(summary);
}
