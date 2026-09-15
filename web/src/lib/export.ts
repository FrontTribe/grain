import { createHash } from "crypto";
import { getUserAndOrg, getRepos, num } from "@/lib/data";
import { canonical } from "@/lib/bom";
import { loadSigningKey, signBomDigest, type BomSignature } from "@/lib/signing";

// Engine identity mirrored from the CLI (internal/report). Bump with the engine.
const ENGINE_VERSION = "0.2.0";

export type BomRepo = {
  name: string;
  full_name: string | null;
  human: number;
  ai_assisted: number;
  unclassified: number;
  ai_by_basis: { attested: number; declared: number; inferred: number };
  human_owned_paths: string[];
  last_scan_at: string | null;
};

export type AuthorshipBOM = {
  schema: string;
  generated_at: string;
  engine: { version: string };
  workspace: { name: string; slug: string };
  scope: { repositories: number };
  summary: {
    human: number;
    ai_assisted: number;
    unclassified: number;
    ai_by_basis: { attested: number; declared: number; inferred: number };
  };
  repositories: BomRepo[];
  methodology: string;
  integrity: { algorithm: "sha256"; digest: string };
  // Present when the server has a signing key: an Ed25519 signature over the
  // digest, verifiable against /.well-known/grain-keys.json.
  signature?: BomSignature;
};

const METHODOLOGY =
  "Signals, not verdicts. Provenance is separated by how it was determined: " +
  "attested (a git-note declaration), declared (a commit trailer or bot/agent identity), " +
  "and inferred (behavioral/content signals, confidence capped at 0.70 — never treated as certain). " +
  "Percentages are of classified lines. This report reflects the last scan of each repository.";

// Build the org's Authorship Bill of Materials, timestamped and integrity-hashed.
export async function buildAuthorshipBOM(nowISO: string): Promise<AuthorshipBOM> {
  const [{ org }, repos] = await Promise.all([getUserAndOrg(), getRepos()]);

  const bomRepos: BomRepo[] = repos.map((r) => ({
    name: r.name,
    full_name: r.full_name,
    human: num(r.human),
    ai_assisted: num(r.ai),
    unclassified: num(r.unc),
    ai_by_basis: {
      attested: num(r.ai_attested),
      declared: num(r.ai_declared),
      inferred: num(r.ai_inferred),
    },
    human_owned_paths: r.human_owned ?? [],
    last_scan_at: r.last_scan_at,
  }));

  const n = Math.max(1, bomRepos.length);
  const avg = (sel: (r: BomRepo) => number) => Math.round(bomRepos.reduce((s, r) => s + sel(r), 0) / n);

  const doc: Omit<AuthorshipBOM, "integrity"> = {
    schema: "grain/authorship-bom/v1",
    generated_at: nowISO,
    engine: { version: ENGINE_VERSION },
    workspace: { name: org?.name ?? "Workspace", slug: org?.slug ?? "workspace" },
    scope: { repositories: bomRepos.length },
    summary: {
      human: avg((r) => r.human),
      ai_assisted: avg((r) => r.ai_assisted),
      unclassified: avg((r) => r.unclassified),
      ai_by_basis: {
        attested: avg((r) => r.ai_by_basis.attested),
        declared: avg((r) => r.ai_by_basis.declared),
        inferred: avg((r) => r.ai_by_basis.inferred),
      },
    },
    repositories: bomRepos,
    methodology: METHODOLOGY,
  };

  const digest = createHash("sha256").update(canonical(doc)).digest("hex");
  const key = loadSigningKey();
  return {
    ...doc,
    integrity: { algorithm: "sha256", digest },
    ...(key ? { signature: signBomDigest(key, digest, nowISO) } : {}),
  };
}
