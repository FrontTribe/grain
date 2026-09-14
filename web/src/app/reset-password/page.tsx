import { updatePassword } from "@/app/auth/actions";
import { AuthShell, Label, Notice, fieldCls, primaryBtn } from "@/components/AuthShell";

export const metadata = { title: "Choose a new password" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <h1 className="font-display text-[28px] font-bold tracking-tight">Choose a new password</h1>
      <p className="mb-6 mt-1.5 text-[14.5px] text-muted">You followed a recovery link. Set a new password to finish signing in.</p>

      {error && <Notice tone="error">{error}</Notice>}

      <form action={updatePassword}>
        <Label htmlFor="password">New password</Label>
        <input id="password" name="password" required minLength={8} autoComplete="new-password" type="password" placeholder="At least 8 characters" className={`${fieldCls} mb-5`} />
        <button type="submit" className={primaryBtn}>Update password</button>
      </form>
    </AuthShell>
  );
}
