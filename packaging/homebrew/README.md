# Homebrew tap

`brew install FrontTribe/tap/grain` resolves to the GitHub repo
**`FrontTribe/homebrew-tap`**, formula `grain`. Set it up once, then update it on
each release.

## 1. Create the tap repo (once)

```bash
gh repo create FrontTribe/homebrew-tap --public -d "Homebrew tap for grain"
```

## 2. Fill the formula for a release

After you've published a release (`git tag v0.1.0 && git push origin v0.1.0` →
the [release workflow](../../.github/workflows/release.yml) builds the binaries),
compute the checksums and write them into [`grain.rb`](./grain.rb):

```bash
./packaging/homebrew/update-formula.sh v0.1.0
```

## 3. Publish it to the tap

```bash
git clone https://github.com/FrontTribe/homebrew-tap
mkdir -p homebrew-tap/Formula
cp packaging/homebrew/grain.rb homebrew-tap/Formula/grain.rb
cd homebrew-tap
git add Formula/grain.rb
git commit -m "grain 0.1.0"
git push
```

## Install

```bash
brew install FrontTribe/tap/grain
```

To update on a new release, re-run steps 2–3 with the new tag, and users get it
with `brew upgrade grain`.

## Automated publishing (recommended)

The [release workflow](../../.github/workflows/release.yml) already has a `tap`
job that regenerates the formula and pushes it to `FrontTribe/homebrew-tap` on
every `v*` tag — **steps 2–3 above become automatic.** To enable it:

1. Create the tap repo (step 1 above), once.
2. Create a Personal Access Token with **`contents: write`** on
   `FrontTribe/homebrew-tap` and add it to **grain's** repo as an Actions secret
   named **`HOMEBREW_TAP_TOKEN`**
   (`gh secret set HOMEBREW_TAP_TOKEN -R FrontTribe/grain`).

That's it. Each `git tag v0.1.0 && git push origin v0.1.0` builds the binaries,
attaches them to the release, computes the checksums, and commits an updated
`Formula/grain.rb` to the tap. Without the secret, the job logs a warning and
skips (the release still succeeds) — so steps 2–3 stay available as the manual
fallback.
