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

## Automating (optional)

The release workflow can push the formula to the tap automatically. Add a
Personal Access Token with `contents:write` on `homebrew-tap` as a repo secret
(e.g. `HOMEBREW_TAP_TOKEN`), then extend `.github/workflows/release.yml` with a
final job that runs `update-formula.sh "$GITHUB_REF_NAME"` and pushes `grain.rb`
to the tap using that token. Until then, steps 2–3 are a 30-second manual step
per release.
