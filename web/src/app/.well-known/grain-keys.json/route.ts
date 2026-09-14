import { NextResponse } from "next/server";
import { loadSigningKey } from "@/lib/signing";

export const runtime = "nodejs";

// The public keys getgrain.dev signs Authorship BOMs with, so anyone can check
// that a signed report really came from here (docs/spec/provenance-v1.md).
// Rotated keys stay listed so older reports keep verifying.
export async function GET() {
  const k = loadSigningKey();
  const keys = k ? [{ key_id: k.keyId, algorithm: "ed25519", public_key: k.id, use: "authorship-bom" }] : [];
  return NextResponse.json(
    { issuer: "getgrain.dev", spec: "grain/provenance/v1", keys },
    { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } },
  );
}
