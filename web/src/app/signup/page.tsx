import Link from "next/link";
import { signup, signInWithGithub } from "@/app/auth/actions";
import { AuthShell, Divider, GitHubMark, Label, Notice, fieldCls, primaryBtn, secondaryBtn } from "@/components/AuthShell";
import { FREE_LIMITS } from "@/lib/plan";

export const metadata = { title: "Create a grain workspace" };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;

  return (
    <AuthShell step={1}>
      <h1 className="font-display text-[28px] font-bold tracking-tight">Create your workspace</h1>
      <p className="mb-6 mt-1.5 text-[14.5px] text-muted">
        Free for {FREE_LIMITS.repos} repositories and {FREE_LIMITS.seats} seats. No card required.
      </p>

      {error && <Notice tone="error">{error}</Notice>}

      <form action={signInWithGithub}>
        {next && <input type="hidden" name="next" value={next} />}
        <button type="submit" className={primaryBtn}>
          <GitHubMark /> Continue with GitHub
        </button>
      </form>
      <p className="mt-2.5 text-center text-[12.5px] text-muted">Fastest: step two is already done when you land.</p>

      <Divider />

      <form action={signup}>
        {next && <input type="hidden" name="next" value={next} />}
        <Label htmlFor="name">Name</Label>
        <input id="name" name="name" autoComplete="name" className={`${fieldCls} mb-4`} placeholder="How teammates will see you" />

        <Label htmlFor="email">Email</Label>
        <input id="email" name="email" required autoComplete="email" className={`${fieldCls} mb-4`} type="email" placeholder="you@company.com" />

        <Label htmlFor="password">Password</Label>
        <input id="password" name="password" required minLength={8} autoComplete="new-password" className={`${fieldCls} mb-4`} type="password" placeholder="At least 8 characters" />

        <button type="submit" className={secondaryBtn}>Create workspace with email</button>
      </form>

      <p className="mt-7 text-center text-[13.5px] text-muted">
        Already have one? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">Sign in</Link>
      </p>
    </AuthShell>
  );
}
