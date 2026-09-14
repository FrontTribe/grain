# Email — invites + attention notifications

Two features share one email layer (`src/lib/email.ts`), inert until a provider
key is set, so everything already deployed degrades gracefully:

- **Invites (#7)** — creating an invite emails the recipient a branded accept
  link. Until email is configured, the invite dialog just shows the copyable
  link (today's behavior), so nothing breaks.
- **Attention notifications (#6)** — after a Cloud scan, if a repo is over the
  org's AI policy threshold, workspace admins get an email. Until configured,
  it's a no-op.

## Activate (Resend)

1. Create an account at resend.com and add/verify a sending domain
   (e.g. `getgrain.dev`) so mail comes from `notifications@getgrain.dev`.
2. Grab an API key.
3. Vercel env (Production):

```
RESEND_API_KEY = re_xxxxxxxx
RESEND_FROM    = grain <notifications@getgrain.dev>   # optional; this is the default
```

I can add these via CLI once you paste the key, or you can set them in the
dashboard. No code change needed — the moment the key is present, invites email
and attention alerts fire.

## Notes

- Both sends are best-effort and wrapped: an email failure never blocks creating
  an invite or completing a scan.
- Attention emails go to members with role `admin` or `owner`, linking straight
  to the repo's provenance breakdown.
- Swapping providers (SES, Postmark) is a one-function change in `email.ts`.
