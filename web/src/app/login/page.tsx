import Link from "next/link";
import { Mark } from "@/components/Mark";
import { Fingerprint } from "@/components/Fingerprint";
import { login, signInWithGithub } from "@/app/auth/actions";

const gitIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.2 6h5.6a2 2 0 0 1 2 2v.6" />
  </svg>
);
const inputCls = "h-[46px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14.5px] outline-none focus:border-brand";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;

  return (
    <div className="flex min-h-screen bg-ground text-ink">
      <div className="hidden w-[520px] flex-none flex-col bg-[#1A1712] p-[52px] text-[#C9C2B3] lg:flex">
        <div className="flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-tight text-[#F1ECE0]">
          <Mark size={26} /> grain
        </div>
        <div className="mt-auto">
          <div className="font-display text-4xl font-extrabold leading-[1.05] tracking-tighter text-[#F1ECE0]">
            See the <span className="text-[#57C6A8]">human</span> and the <span className="text-[#E28A50]">AI</span> grain in your code.
          </div>
          <div className="mt-4 max-w-[34ch] text-[15px] text-[#8F8778]">Provenance across every repo — signals, not verdicts.</div>
          <div className="mt-8 overflow-hidden rounded-xl border border-[#2c2820]">
            <Fingerprint height={60} bars={64} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-10">
        <form action={login} className="w-[400px]">
          {next && <input type="hidden" name="next" value={next} />}
          <h2 className="font-display text-[28px] font-bold">Sign in to Grain</h2>
          <p className="mb-6 mt-2 text-[14.5px] text-muted">Welcome back. Pick up where your repos left off.</p>

          {error && <div className="mb-4 rounded-lg border border-ai/40 bg-ai-soft px-3.5 py-2.5 text-[13px] text-ai">{error}</div>}
          {message && <div className="mb-4 rounded-lg border border-human/40 bg-human-soft px-3.5 py-2.5 text-[13px] text-human">{message}</div>}

          <label className="mb-1.5 block text-[13px] font-medium">Work email</label>
          <input name="email" required className={`${inputCls} mb-4`} type="email" placeholder="demo@grain.dev" defaultValue="demo@grain.dev" />

          <div className="mb-1.5 flex justify-between">
            <label className="text-[13px] font-medium">Password</label>
            <a href="#" className="text-[12.5px] text-brand">Forgot?</a>
          </div>
          <input name="password" required className={`${inputCls} mb-1.5`} type="password" placeholder="••••••••••••" defaultValue="demo1234" />

          <button type="submit" className="mt-1.5 flex h-[46px] w-full items-center justify-center rounded-[10px] bg-brand text-[14.5px] font-semibold text-white transition hover:-translate-y-px">
            Sign in
          </button>

          <div className="my-5 flex items-center gap-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            or
          </div>

          <button type="submit" formAction={signInWithGithub} formNoValidate className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-[10px] bg-ink text-[14.5px] font-semibold text-ground">
            {gitIcon} Continue with GitHub
          </button>

          <div className="mt-6 text-center text-[13.5px] text-muted">
            New to Grain? <Link href="/signup" className="text-brand">Create an account</Link>
          </div>
          <div className="mt-3 text-center font-mono text-[11px] text-faint">demo: demo@grain.dev / demo1234</div>
        </form>
      </div>
    </div>
  );
}
