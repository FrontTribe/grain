#!/usr/bin/env bash
# One-time Stripe setup for grain billing. Requires an authenticated Stripe CLI
# (run `stripe login` first). Creates the Team product + a $20/mo price and prints
# the price id to put in STRIPE_PRICE_ID.
set -euo pipefail

echo "Creating product 'Grain Team'…"
PROD=$(stripe products create \
  --name "Grain Team" \
  --description "Team workspace — org dashboard, policy, unlimited repos." \
  | grep -o 'prod_[A-Za-z0-9]*' | head -1)
echo "  product: $PROD"

echo "Creating \$20/month recurring price…"
PRICE=$(stripe prices create \
  --product "$PROD" \
  --unit-amount 2000 \
  --currency usd \
  -d "recurring[interval]=month" \
  | grep -o 'price_[A-Za-z0-9]*' | head -1)
echo "  price:   $PRICE"

echo
echo "Done. Add to web/.env.local (and Vercel env):"
echo "  STRIPE_PRICE_ID=$PRICE"
