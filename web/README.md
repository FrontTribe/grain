# grain Cloud

The hosted side of grain ([getgrain.dev](https://getgrain.dev)): a Next.js app
that runs the same engine as the CLI over GitHub repositories and keeps
watching. Scans on push through a GitHub App, review evidence from the pull
request API, Risk, Outcomes, Security and Dependencies per repository,
email alerts, and a signed Authorship Bill of Materials anyone can verify.

The engine pieces that must agree with the Go CLI live in `src/lib/`
(`risk.ts`, `security.ts`, `deps.ts`, `signing.ts`, `bom.ts`); see the
repository's [CONTRIBUTING.md](../CONTRIBUTING.md) for what has to stay
byte-identical.

## Run it locally

```bash
npm install
npm run dev
```

Environment (`.env.local`): Supabase (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), the GitHub App
(`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`), Stripe
(`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`), Resend
(`RESEND_API_KEY`, `RESEND_FROM`) and `GRAIN_SIGNING_KEY`, the Ed25519 seed
the Cloud signs authorship reports with. Everything except Supabase is
optional for local work: alerts stay inert without Resend, billing without
Stripe, push scans without the App.

`npm run lint` and `npm run build` must pass before a change ships; the
landing page's own numbers come from `scripts/self-scan.mjs`, which reads
`grain.json` from a scan of this repository.
