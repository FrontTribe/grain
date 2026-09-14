import Link from "next/link";
import { login, signInWithGithub, requestPasswordReset } from "@/app/auth/actions";
import { AuthShell, Divider, GitHubMark, Label, Notice, fieldCls, primaryBtn, secondaryBtn } from "@/components/AuthShell";

export const metadata = { title: "Sign in to grain" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;

  return (
    <AuthShell>
      <h1 className="font-display text-[28px] font-bold tracking-tight">Sign in</h1>
      <p className="mb-6 mt-1.5 text-[14.5px] text-muted">Back to your workspace.</p>

      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="ok">{message}</Notice>}

      <form action={signInWithGithub}>
        {next && <input type="hidden" name="next" value={next} />}
        <button type="submit" className={primaryBtn}>
          <GitHubMark /> Continue with GitHub
        </button>
      </form>

      <Divider />

      <form action={login}>
        {next && <input type="hidden" name="next" value={next} />}
        <Label htmlFor="email">Email</Label>
        <input id="email" name="email" required autoComplete="email" className={`${fieldCls} mb-4`} type="email" placeholder="you@company.com" />

        <Label
          htmlFor="password"
          right={
            <button type="submit" formAction={requestPasswordReset} formNoValidate className="text-[12.5px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
              Forgot password?
            </button>
          }
        >
          Password
        </Label>
        <input id="password" name="password" required autoComplete="current-password" className={`${fieldCls} mb-4`} type="password" placeholder="Your password" />

        <button type="submit" className={secondaryBtn}>Sign in with email</button>
      </form>

      <p className="mt-7 text-center text-[13.5px] text-muted">
        New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">Create a workspace</Link>
      </p>
    </AuthShell>
  );
}
