# Stripe — prelazak na LIVE mod

**Status danas:** produkcija radi na **test/sandbox** modu (account `Front Tribe Sandbox`,
`acct_1SEbqh3WH643MTFL`). Aplikacija je već 100% spremna za live — **kod se ne mijenja**,
mijenjaju se samo 3 Vercel env varijable. Ovaj dokument je recept.

Zašto ništa u kodu: `getStripe()` čita `STRIPE_SECRET_KEY` iz env-a, cijena dolazi iz
`STRIPE_PRICE_ID`, webhook potpis iz `STRIPE_WEBHOOK_SECRET`. Test i live event imaju
isti oblik — webhook (`src/app/api/stripe/webhook/route.ts`) ih obrađuje identično.

---

## Korak 0 — TI: aktiviraj Stripe account (jednokratno, ne mogu ja)

Sandbox ne može naplaćivati pravi novac. Treba pravi, aktiviran account.

1. https://dashboard.stripe.com → prijava na **pravi** Front Tribe account (ne sandbox),
   ili ga kreiraj.
2. **Activate payments** → poslovni podaci (naziv, OIB), **bankovni račun (IBAN)**,
   verifikacija identiteta vlasnika.
3. Čekaj Stripeovu potvrdu (obično minute–par dana).
4. Kad je aktivan, gore desno prebaci **Test mode → OFF** (live).

Ovo su tvoji zakonski/financijski podaci — ja ih ne smijem unositi.

---

## Korak 1 — TI: prebaci Stripe CLI na live account

```bash
stripe login   # prijavi se na pravi (aktivirani) account, ne sandbox
```

Provjera da si na pravom accountu i da postoji live ključ:

```bash
stripe config --list
```

Trebaš vidjeti `live_mode_api_key = 'sk_live_...'` i točan `display_name`.

---

## Korak 2 — JA: kreiram live product + price (ili ti, komande su tu)

> Live product/price se NE prenosi iz test moda — kreira se iznova.

```bash
stripe products create \
  --name "Grain Team" \
  --description "Team plan — unlimited repos, org dashboard & policy" \
  --live

# uzmi prod_... iz outputa, pa:
stripe prices create \
  --product prod_XXX \
  --unit-amount 2900 \
  --currency usd \
  --recurring.interval month \
  --live
```

Zapiši `price_...` (live) → to je novi **`STRIPE_PRICE_ID`**.

---

## Korak 3 — JA: kreiram live webhook endpoint

```bash
stripe webhook_endpoints create \
  --url "https://getgrain.dev/api/stripe/webhook" \
  --enabled-events checkout.session.completed \
  --enabled-events customer.subscription.created \
  --enabled-events customer.subscription.updated \
  --enabled-events customer.subscription.deleted \
  --live
```

Iz outputa uzmi **`secret` (`whsec_...`)** → to je novi **`STRIPE_WEBHOOK_SECRET`**.

---

## Korak 4 — Vercel env (live vrijednosti)

**`STRIPE_SECRET_KEY` (`sk_live_...`) upiši TI sam** u Vercel dashboard
(Settings → Environment Variables → Production, override) — to je najosjetljiviji ključ.
Ostala dva mogu ja preko CLI-a:

```bash
# ukloni stare (sandbox) pa dodaj live:
vercel env rm STRIPE_PRICE_ID production --yes
vercel env rm STRIPE_WEBHOOK_SECRET production --yes

printf 'price_XXXX_live' | vercel env add STRIPE_PRICE_ID production
printf 'whsec_XXXX_live' | vercel env add STRIPE_WEBHOOK_SECRET production
```

Provjera da su sve 4 na mjestu:

```bash
vercel env ls production
```

---

## Korak 5 — Redeploy

```bash
vercel --prod
```

(ili `git commit --allow-empty -m "chore: switch Stripe to live" && git push`)

---

## Korak 6 — Verifikacija na getgrain.dev

- [ ] Settings → Billing → **Upgrade to Team** vodi na `checkout.stripe.com` (bez test bannera)
- [ ] Checkout kkarticom (prava, mali iznos ili tvoja) → vrati na app kao `active`
- [ ] Stripe Dashboard (live) → Payments pokazuje naplatu
- [ ] `orgs.subscription_status = 'active'`, `current_period_end` popunjen
- [ ] Webhook u Stripe Dashboardu (live) pokazuje 200 na `checkout.session.completed`
- [ ] **Manage subscription** otvara Billing Portal

---

## Rollback (ako nešto zapne)

Vrati 3 env varijable na sandbox vrijednosti i redeploy:

- `STRIPE_SECRET_KEY` = `sk_test_...`
- `STRIPE_PRICE_ID` = `price_1UAuWK3WH643MTFLVY9tjtyE` (test)
- `STRIPE_WEBHOOK_SECRET` = live whsec s Vercela **ne vrijedi lokalno** — za lokalni test
  koristi `stripe listen` secret.

---

## Podjela posla — sažetak

| Korak | Tko | Zašto |
|---|---|---|
| 0 Aktivacija accounta (banka, identitet) | **Ti** | financijski/identifikacijski podaci |
| 1 `stripe login` na live | **Ti** | tvoj login |
| 2 Product + price | Ja (ili ti) | CLI, nakon što si na live accountu |
| 3 Webhook endpoint | Ja (ili ti) | CLI |
| 4 `STRIPE_SECRET_KEY` u Vercel | **Ti** | najosjetljiviji ključ |
| 4 `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` u Vercel | Ja | CLI |
| 5 Redeploy | Ja | CLI |
| 6 Verifikacija | Ja | mogu provjeriti sve osim naplate pravom karticom |

Kad odradiš korake 0–1 i javiš, ja odradim 2, 3, 4(dio), 5 i verifikaciju u jednom potezu.
