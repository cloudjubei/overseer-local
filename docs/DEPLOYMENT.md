# Deployment plan

How we ship signed `overseer-local` installers to end users. This is the umbrella plan; the credentials/per-platform mechanics live in [BUILD_SIGNING.md](./BUILD_SIGNING.md) and [APP_RELEASE.md](./APP_RELEASE.md) — this file describes the **pipeline**, not the signing knobs.

Status as of 2026-05: nothing is hosted yet, no certificates are obtained, no CI workflow is committed. This document captures the target architecture so the pieces can be filled in in any order without re-deriving the plan.

---

## Goals

- **Hands-off builds.** A push to a designated branch (or a tagged commit) triggers builds on all three platforms in parallel, signs + notarizes them, and uploads to durable cloud storage. No engineer runs `npm run build:mac` by hand for a release.
- **One artifact bucket, one URL scheme.** Every release version lands under a predictable S3 path so a download page (and future auto-updater) can resolve `<version>/<platform>/<file>` without bespoke logic.
- **Auto-update-ready.** Artifacts include the `latest-*.yml` manifests that `electron-updater` consumes. We won't wire the updater on day one, but we won't have to re-architect when we do.
- **Reproducible.** Same git SHA + same secrets → same artifacts. No local cert handling, no human-managed `dist/` uploads.

---

## Trigger model

Two options, decide before implementing:

**Option A — tag push (recommended).** Pushing a SemVer tag like `v1.0.0` to `origin` triggers `.github/workflows/release.yml`. Only tags produce releases; `main` and feature branches only run typecheck/test/build via a separate `ci.yml`. Pros: explicit, hard to release by accident, version comes from the tag. Cons: requires `npm version` + `git push --tags` discipline.

**Option B — `release` branch push.** Pushing to a long-lived `release` branch triggers the workflow. Version comes from `package.json`. Pros: one-step (`git push origin release`). Cons: easier to release accidentally; requires version-bump commits.

We default to **Option A**. The trigger snippet:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:  # also allow manual runs from the Actions tab
```

`workflow_dispatch` stays as an escape hatch for re-running a failed release without re-tagging.

---

## Build matrix

GitHub-hosted runners, one per OS. macOS notarization requires a macOS runner; cross-building from Linux to mac is unsupported.

| Job | Runner          | Targets                      | Output                                                              |
|-----|-----------------|------------------------------|---------------------------------------------------------------------|
| mac | `macos-14`      | `dmg`, `zip`                 | `*.dmg`, `*.zip`, `*.blockmap`, `latest-mac.yml`                    |
| win | `windows-2022`  | `nsis`                       | `*-setup.exe`, `*.blockmap`, `latest.yml`                           |
| lin | `ubuntu-22.04`  | `AppImage`, `deb`, `snap`    | `*.AppImage`, `*.deb`, `*.snap`, `latest-linux.yml`                 |

**macOS arch.** Build a universal binary (`--arch universal`) so one DMG covers Apple Silicon + Intel, or ship two separate arch builds (`arm64`, `x64`). Default: **universal** — fewer artifacts, simpler download page. Revisit if app size becomes a concern (universal ~doubles the binary).

**Concurrency.** All three jobs run in parallel. Total wall time is dominated by macOS notarization (~3–8 min); end-to-end target is ≤15 min.

---

## Signing and notarization

Per-platform credentials live in GitHub Actions repo secrets. Full setup is in [BUILD_SIGNING.md](./BUILD_SIGNING.md); this is the minimum checklist:

- **macOS** — `CSC_LINK` (base64-encoded `.p12`), `CSC_KEY_PASSWORD`, then either (`APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`) **or** (`APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`). Prefer the API-key path — Apple is deprecating ID/password notarization.
- **Windows** — `WIN_CSC_LINK` (base64-encoded `.pfx`), `WIN_CSC_KEY_PASSWORD`. Standard OV cert is sufficient; EV certs require a hardware token and are not CI-friendly.
- **Linux** — no signing required.

[electron-builder.yml](../electron-builder.yml) needs the unsigned/notarize-disabled placeholders flipped to live values:

```yaml
mac:
  identity: null            # → leave null; electron-builder picks up CSC_LINK
  hardenedRuntime: true     # → add (currently missing)
  gatekeeperAssess: false   # → add
  notarize: true            # currently false
```

---

## Artifact storage

A single S3 bucket per channel. Recommended layout:

```
s3://overseer-releases/
  stable/
    1.0.0/
      mac/
        overseer-1.0.0-universal.dmg
        overseer-1.0.0-universal-mac.zip
        overseer-1.0.0-universal.dmg.blockmap
        latest-mac.yml
      win/
        overseer-1.0.0-setup.exe
        overseer-1.0.0-setup.exe.blockmap
        latest.yml
      linux/
        overseer-1.0.0.AppImage
        overseer-1.0.0.deb
        overseer-1.0.0.snap
        latest-linux.yml
    latest/                 # symlink-style alias: copy of newest 1.x.y
      mac/...
      win/...
      linux/...
  beta/                     # (future) prerelease channel; same layout
```

The `latest/` aliases let the download page link to stable URLs (`/stable/latest/mac/overseer.dmg`) that don't change per release. The CI job copies (`s3 sync --delete`) the just-uploaded `<version>/` into `latest/` after a successful build.

**Bucket policy.** Public-read on `stable/` so installer downloads don't need signing. Block all writes except via the CI-only IAM role. Block listing.

**CDN.** Front the bucket with CloudFront when we add a real download page — solves egress cost, gives us HTTPS on a custom domain, caches the large DMGs. Until then S3 direct URLs work fine.

---

## How upload happens

electron-builder has built-in S3 publishing — no separate `aws s3 cp` step needed. Add to [electron-builder.yml](../electron-builder.yml):

```yaml
publish:
  - provider: s3
    bucket: overseer-releases
    region: <region>
    path: stable/${version}
    acl: null              # rely on bucket policy, not per-object ACLs
```

The workflow runs `electron-builder --publish always` and electron-builder uploads the artifacts + the `latest-*.yml` manifests itself.

The `latest/` alias copy is a separate `aws s3 sync` step that runs after all three matrix jobs succeed (use a `needs:` dependency on a final job).

**Auth.** Don't bake long-lived AWS keys into secrets. Use GitHub Actions' OIDC trust to assume an IAM role:

```yaml
permissions:
  id-token: write
  contents: read

- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::<account>:role/overseer-releases-ci
    aws-region: <region>
```

This keeps the AWS side fully revocable from IAM without rotating GitHub secrets.

---

## Auto-updates (deferred but designed for)

`electron-updater` reads `latest-mac.yml` / `latest.yml` / `latest-linux.yml` from a feed URL and self-updates running apps. Once the bucket exists, wiring it is:

1. Add `electron-updater` to dependencies.
2. In the main process: `autoUpdater.setFeedURL({ provider: 's3', bucket: 'overseer-releases', path: 'stable/latest', region: '…' })`.
3. Call `autoUpdater.checkForUpdatesAndNotify()` after the main window mounts.

Not in scope until we have at least one real user installation to update. The S3 layout above is already update-compatible — no migration needed when we turn it on.

---

## Versioning

SemVer, single source of truth in [package.json](../package.json) `version`. Release flow:

1. `npm version patch|minor|major` on `main` — bumps version, creates tag, commits.
2. `git push && git push --tags`.
3. The tag push triggers `release.yml`.
4. The same SHA is what shows up in `latest-*.yml` `releaseDate` metadata.

Prerelease tags (`v1.0.0-beta.1`) route to the `beta/` channel via a small condition in the workflow.

---

## What's blocked / decisions outstanding

These need real-world decisions before the pipeline can ship:

- **AWS account ownership.** Whose account hosts `overseer-releases`? Anthropic-shared or personal-for-now? Affects IAM trust setup.
- **Bucket region.** US (cheapest egress for US users) vs EU (closer to current user base)?
- **Custom download domain.** `download.overseer.dev`? `releases.thefactory.dev`? Determines CloudFront cert.
- **Apple Developer Program enrollment.** Without the Developer ID Application cert, mac builds will continue to be unsigned. Personal vs organization enrollment matters for the cert's "Common Name" embedded in every build.
- **Windows code-signing cert.** OV from DigiCert/Sectigo/Certum ($200–400/yr); needs an organization name + business verification.
- **Linux distribution model.** Direct AppImage download is fine for a 1.0. Snap store / Flathub require their own publishing flows that are out of scope.

---

## Concrete next steps (in order, when unblocked)

1. **Get the Apple Developer ID + Windows OV cert.** Everything else can be stubbed; these have lead times.
2. **Provision the S3 bucket + IAM role + OIDC trust** under the chosen AWS account.
3. **Land `.github/workflows/release.yml`** with the matrix, signing env wiring, and `--publish always`. Verify against a `v0.0.1-test` tag to a private/staging bucket.
4. **Add the `publish` block to [electron-builder.yml](../electron-builder.yml)** and flip the mac signing toggles (`hardenedRuntime`, `notarize`).
5. **Cut `v1.0.0`** once a clean end-to-end run produces signed artifacts in the bucket.
6. **(Later) Add `electron-updater`** and the feed URL once we have users to update.

---

## Non-goals

- Self-hosted release infra (Nexus, Artifactory, internal HTTP server). S3 + CloudFront is the target; no bespoke server.
- Auto-publishing to Homebrew cask / winget / Linux distro repos. Future, not blocking 1.0.
- Mac App Store / Microsoft Store distribution. Direct-download only; store distribution would require sandboxing work (mac) and a separate appx pipeline (win).
- Multi-channel routing inside the app (dev → staging → prod backend selection). The installer is single-channel; backend URL is user-configurable at runtime.
