# Scoop bucket (Windows)

`scoop install grain` on Windows works once the manifest lives in a Scoop bucket
repo — **`FrontTribe/scoop-bucket`**, at `bucket/grain.json`. Set it up once, then
update it on each release (or let the release workflow do it — see below).

## 1. Create the bucket repo (once)

```bash
gh repo create FrontTribe/scoop-bucket --public -d "Scoop bucket for grain"
```

## 2. Regenerate the manifest for a release

After a release is published, compute the Windows checksums and write them into
[`grain.json`](./grain.json):

```bash
./packaging/scoop/update-manifest.sh v0.1.0
```

## 3. Publish it to the bucket

```bash
git clone https://github.com/FrontTribe/scoop-bucket
mkdir -p scoop-bucket/bucket
cp packaging/scoop/grain.json scoop-bucket/bucket/grain.json
cd scoop-bucket
git add bucket/grain.json
git commit -m "grain 0.1.0"
git push
```

## Install (on Windows)

```powershell
scoop bucket add fronttribe https://github.com/FrontTribe/scoop-bucket
scoop install grain
```

`scoop update grain` picks up new releases (the manifest carries `checkver` +
`autoupdate` for the bucket's own update tooling).

## Automated publishing

The [release workflow](../../.github/workflows/release.yml) has a `scoop` job
that regenerates the manifest and pushes it to the bucket on every `v*` tag.
Enable it by creating a PAT with **`contents: write`** on
`FrontTribe/scoop-bucket` and adding it to **grain's** repo as an Actions secret
named **`SCOOP_BUCKET_TOKEN`**
(`gh secret set SCOOP_BUCKET_TOKEN -R FrontTribe/grain`). Without it the job logs
a warning and skips (the release still succeeds), leaving steps 2–3 as the manual
fallback.

> The manifest downloads the bare `grain-windows-<arch>.exe` and renames it to
> `grain.exe` via `pre_install`, so the shim is just `grain`.
