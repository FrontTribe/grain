import Link from "next/link";
import { Mark } from "@/components/Mark";
import { createClient } from "@/utils/supabase/server";
import { acceptInvite } from "@/app/app/settings/members/actions";

type Info = { email: string; role: string; org_name: string; inviter: string | null } | null;

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: info }, { data: userData }] = await Promise.all([
    supabase.rpc("invite_info", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const invite = info as Info;
  const user = userData.user;
  const next = `/invite/${token}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground p-10 text-ink">
      <div className="w-[440px]">
        <div className="mb-6 flex items-center gap-2.5 font-display text-[20px] font-extrabold tracking-tight">
          <Mark size={26} /> grain
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-[0_18px_46px_rgba(32,29,25,0.08)]">
          {!invite ? (
            <>
              <h2 className="font-display text-[22px] font-bold">Invite not found</h2>
              <p className="mt-2 text-[14px] text-muted">This invite link is invalid or has already been used.</p>
              <Link href="/" className="mt-5 inline-flex text-[13.5px] text-brand">← Back to grain</Link>
            </>
          ) : (
            <>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">You&apos;re invited</div>
              <h2 className="font-display text-[24px] font-bold leading-tight">
                Join <span className="text-brand">{invite.org_name}</span>
              </h2>
              <p className="mt-2 text-[14px] text-muted">
                {invite.inviter ? `${invite.inviter} invited ` : "Invited "}
                <span className="font-medium text-ink">{invite.email}</span> as {invite.role}.
              </p>

              {error && <div className="mt-4 rounded-[10px] border border-ai/40 bg-ai-soft px-3.5 py-2.5 text-[13px] text-ai">{error}</div>}

              {user ? (
                <>
                  <form action={acceptInvite} className="mt-6">
                    <input type="hidden" name="token" value={token} />
                    <button type="submit" className="flex h-[46px] w-full items-center justify-center rounded-[10px] bg-brand text-[14.5px] font-semibold text-white">
                      Accept &amp; join {invite.org_name}
                    </button>
                  </form>
                  <p className="mt-3 text-center text-[12px] text-faint">
                    Signed in as {user.email}. This invite is for {invite.email}.
                  </p>
                </>
              ) : (
                <div className="mt-6 flex flex-col gap-2.5">
                  <Link href={`/login?next=${encodeURIComponent(next)}`} className="flex h-[46px] items-center justify-center rounded-[10px] bg-brand text-[14.5px] font-semibold text-white">
                    Sign in to accept
                  </Link>
                  <Link href={`/signup?next=${encodeURIComponent(next)}`} className="flex h-[46px] items-center justify-center rounded-[10px] border border-line bg-surface text-[14.5px] font-semibold text-ink">
                    Create an account
                  </Link>
                  <p className="text-center text-[12px] text-faint">Use {invite.email} to accept this invite.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
