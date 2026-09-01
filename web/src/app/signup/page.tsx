import Link from "next/link";
import { Mark } from "@/components/Mark";

const check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 size-[18px] flex-none text-[#57C6A8]">
    <path d="M5 12l4 4 10-10" />
  </svg>
);
const gitIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.2 6h5.6a2 2 0 0 1 2 2v.6" />
  </svg>
);
const inputCls = "h-[46px] w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14.5px] outline-none focus:border-brand";

export default function SignUp() {
  return (
    <div className="flex min-h-screen bg-ground text-ink">
      <div className="hidden w-[520px] flex-none flex-col bg-[#1A1712] p-[52px] text-[#C9C2B3] lg:flex">
        <div className="flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-tight text-[#F1ECE0]">
          <Mark size={26} /> grain
        </div>
        <div className="mt-auto">
          <div className="font-display text-[34px] font-extrabold leading-tight tracking-tight text-[#F1ECE0]">
            Start seeing your codebase&apos;s grain.
          </div>
          <ul className="mt-6 flex flex-col gap-3">
            {[
              "Connect a repo, get a provenance report in minutes.",
              "Free for the CLI & badge — always, MIT.",
              "Your code never leaves your machine.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[14px]">{check} {t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-10">
        <div className="w-[400px]">
          <h2 className="font-display text-[28px] font-bold">Create your account</h2>
          <p className="mb-6 mt-2 text-[14.5px] text-muted">Team plan — free while in early access.</p>

          <label className="mb-1.5 block text-[13px] font-medium">Full name</label>
          <input className={`${inputCls} mb-4`} placeholder="Maya Green" />
          <label className="mb-1.5 block text-[13px] font-medium">Work email</label>
          <input className={`${inputCls} mb-4`} type="email" placeholder="maya@acme.com" />
          <label className="mb-1.5 block text-[13px] font-medium">Password</label>
          <input className={`${inputCls} mb-1`} type="password" placeholder="••••••••••••" />
          <div className="mb-2 text-[11.5px] text-faint">At least 12 characters.</div>

          <Link href="/connect" className="mt-1 flex h-[46px] w-full items-center justify-center rounded-[10px] bg-brand text-[14.5px] font-semibold text-white transition hover:-translate-y-px">
            Create account
          </Link>

          <div className="my-4.5 my-[18px] flex items-center gap-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            or
          </div>

          <Link href="/connect" className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-[10px] bg-ink text-[14.5px] font-semibold text-ground">
            {gitIcon} Sign up with GitHub
          </Link>

          <div className="mt-4 text-center text-[11.5px] text-faint">By creating an account you agree to the Terms and Privacy Policy.</div>
          <div className="mt-3 text-center text-[13.5px] text-muted">
            Already have an account? <Link href="/login" className="text-brand">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
