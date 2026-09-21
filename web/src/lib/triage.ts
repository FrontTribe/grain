// Name triage for added dependencies, Cloud only: ask TypeSafe's Jev (a
// System One model that returns typed, calibrated decisions, not text) what a
// package name looks like. The registry says whether a name exists; this says
// whether it looks like a typo of a well-known package or a name an assistant
// would invent, which is the slopsquatting seed before anyone registers it.
//
// Only the package name, ecosystem and the registry answer leave the server;
// never code, paths, commit messages or repository names. Inert without
// TYPESAFE_API_KEY, and a failure leaves the dependency untriaged rather than
// failing the scan.
import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";

export type DepKind = "established" | "plausible_new" | "lookalike" | "private_or_internal";

export type DepTriage = {
  kind: DepKind;
  confidence: number; // in the chosen kind, 0..1
  lookalike: number; // P(name is a misspelling or near-variant of a well-known package)
  invented: number; // P(name reads like one an AI assistant would invent)
};

export type TriageInput = { name: string; ecosystem: string; exists: boolean; age_days: number; checked: boolean };

// A dependency is suspicious when the model is reasonably sure the name is a
// lookalike, or the name reads as invented and the registry does not vouch for
// it with age. Private scoped names are never suspicious on their own.
export function suspicious(t: DepTriage | undefined, d: { exists: boolean; age_days: number }): boolean {
  if (!t || t.kind === "private_or_internal") return false;
  if (t.kind === "lookalike" && t.confidence >= 0.5) return true;
  const young = !d.exists || d.age_days < 0 || d.age_days < 30;
  return t.invented >= 0.7 && young;
}

// One line of reason for the UI and the email, or "".
export function triageReason(t: DepTriage | undefined): string {
  if (!t) return "";
  if (t.kind === "lookalike") return `looks like a typo of a known package (${Math.round(t.lookalike * 100)}%)`;
  if (t.invented >= 0.7) return `reads like an invented name (${Math.round(t.invented * 100)}%)`;
  if (t.kind === "private_or_internal") return "looks private or scoped";
  return "";
}

const MAX_TRIAGE = 60;
const CONCURRENCY = 12;

export function triageEnabled(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export async function triageDeps(deps: TriageInput[]): Promise<Map<string, DepTriage>> {
  const out = new Map<string, DepTriage>();
  if (!triageEnabled() || deps.length === 0) return out;
  const client = new TypeSafeClient({ timeout: 8000, retry: { maxRetries: 1 } });
  const queue = deps.slice(0, MAX_TRIAGE);
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        const registry: Record<string, boolean | number> = !d.checked ? { checked: false } : d.exists ? { exists: true, age_days: d.age_days } : { exists: false };
        const { answers } = await client.systemOne({
          state: { dependency: { name: d.name, ecosystem: d.ecosystem, registry } },
          questions: {
            kind: choice("What kind of package is `dependency`, given its name, ecosystem and registry answer?", {
              established: "A well-known, widely used package under its correct name.",
              plausible_new: "A real-looking package that is simply new or niche; the name reads like a genuine project.",
              lookalike: "The name is a misspelling, transposition or near-variant of a well-known package (typosquat) or a name an AI assistant would plausibly invent.",
              private_or_internal: "A scoped or organization-specific name that would live on a private registry rather than the public one.",
            }),
            lookalike: noul("`dependency.name` is a misspelling or near-variant of a well-known package name in this ecosystem."),
            invented: noul("`dependency.name` reads like a name an AI assistant would invent for a package that does not exist."),
          },
        });
        out.set(`${d.ecosystem}/${d.name}`, {
          kind: answers.kind.choice as DepKind,
          confidence: round(answers.kind.confidence),
          lookalike: round(answers.lookalike.noul),
          invented: round(answers.invented.noul),
        });
      } catch (err) {
        console.error("[triage] skipped", d.ecosystem, d.name, (err as Error).message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;
