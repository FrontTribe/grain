import { NextResponse } from "next/server";
import { buildAuthorshipBOM } from "@/lib/export";

export const runtime = "nodejs";

// Authenticated JSON download of the active org's Authorship Bill of Materials.
export async function GET() {
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
