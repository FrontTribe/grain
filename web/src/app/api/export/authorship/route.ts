import { NextResponse } from "next/server";
import { buildAuthorshipBOM } from "@/lib/export";
import { planSubscribed } from "@/lib/plan";

export const runtime = "nodejs";

// Authenticated JSON download of the active org's signed Authorship Bill of
// Materials. A Team feature: Free workspaces see the report in the app but
// can't export the signed document.
export async function GET() {
  if (!(await planSubscribed())) {
    return NextResponse.json(
      { error: "The signed authorship export is part of the Team plan.", upgrade: "/app/settings?tab=billing" },
      { status: 402 },
    );
  }
  const bom = await buildAuthorshipBOM(new Date().toISOString());
  const date = bom.generated_at.slice(0, 10);
  return new NextResponse(JSON.stringify(bom, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="grain-authorship-bom-${bom.workspace.slug}-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
