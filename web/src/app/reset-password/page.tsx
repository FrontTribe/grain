import { Mark } from "@/components/Mark";
import { updatePassword } from "@/app/auth/actions";

const inputCls = "h-[46px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14.5px] outline-none focus:border-brand";

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground p-6 text-ink">
      <form action={updatePassword} className="w-[400px]">
        <div className="mb-7 flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-tight">
          <Mark size={26} /> grain
        </div>
        <h1 className="font-display text-[28px] font-bold">Choose a new password</h1>
        <p className="mb-6 mt-2 text-[14.5px] text-muted">
          You followed a recovery link. Set a new password to finish signing in.
        </p>

        {error && <div className="mb-4 rounded-lg border border-ai/40 bg-ai-soft px-3.5 py-2.5 text-[13px] text-ai">{error}</div>}

        <label className="mb-1.5 block text-[13px] font-medium">New password</label>
        <input name="password" required minLength={8} type="password" placeholder="At least 8 characters" className={inputCls} />

        <button
          type="submit"
          className="mt-5 flex h-[46px] w-full items-center justify-center rounded-[10px] bg-brand text-[14.5px] font-semibold text-white transition hover:-translate-y-px"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
