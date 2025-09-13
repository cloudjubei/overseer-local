# Code signing and notarization (electron-builder)

This project uses electron-builder for cross-platform packaging. To ship production builds on macOS and Windows, you must configure code signing and (on macOS) notarization. This document explains the required environment variables and how to set them locally and in CI.

Key points:

- Use environment variables so secrets never go into the repo.
- electron-builder reads standard variables for cross-platform signing.
- macOS requires notarization for distribution outside the Mac App Store.

## Environment variables (summary)

Cross-platform (used for both macOS and Windows by default):

- CSC_LINK: Link to or contents of your code signing certificate. Supported forms:
  - file://absolute/path/to/cert.p12
  - https://.../cert.p12 (requires auth if private)
  - base64:... (recommended in CI; a base64-encoded .p12/.pfx)
- CSC_KEY_PASSWORD: Password for the certificate referenced by CSC_LINK
- CSC_NAME (optional): Code signing identity name to use if auto-discovery fails

Windows-specific overrides (optional):

- WIN_CSC_LINK: Same usage as CSC_LINK, but only for Windows
- WIN_CSC_KEY_PASSWORD: Same usage as CSC_KEY_PASSWORD, but only for Windows

macOS notarization (Notarytool):

- APPLE_ID: Apple ID email used for notarization
- APPLE_APP_SPECIFIC_PASSWORD: An App-specific password created for the Apple ID (not your Apple ID password)
- APPLE_TEAM_ID: Your Apple Developer Team ID (e.g., ABCDE12345)
- ASC_PROVIDER (optional): If you belong to multiple teams, provider short name

Alternative macOS notarization via API key (instead of Apple ID/password):

- APPLE_API_KEY: Path to the .p8 file or base64:... contents
- APPLE_API_KEY_ID: The key ID (e.g., 1A2BC3D4EF)
- APPLE_API_ISSUER: The issuer ID (UUID)

Other helpful toggles:

- CSC_IDENTITY_AUTO_DISCOVERY=false: Disable auto-discovery of signing identities (useful on Linux CI when only signing Windows builds via WIN_CSC_LINK)

## How this repo is configured

The electron-builder configuration lives under the "build" key in package.json. For macOS, hardened runtime and entitlements are already set. We also include notarization placeholders so you can provide credentials via environment variables at build time.

Relevant package.json excerpt:

- mac.hardenedRuntime: true
- mac.entitlements: build/entitlements.mac.plist
- mac.entitlementsInherit: build/entitlements.mac.inherit.plist
- mac.notarize: uses APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID

Note: You don't commit any certificates or Apple credentials. Provide them via environment variables when running the build.

## Preparing certificates

Windows or macOS Developer ID certificate in a .p12/.pfx file:

1. Export or obtain your code signing certificate as a password-protected .p12 (macOS) or .pfx (Windows) file.
2. Base64-encode it for CI:

   macOS/Linux:
   base64 -w0 path/to/cert.p12 > cert.p12.b64

   Windows PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\\to\\cert.pfx")) > cert.pfx.b64

3. Store the base64 content in the secret named CSC_LINK as a value that starts with base64:, e.g.:

   base64:PASTE_BASE64_CERT_CONTENTS_HERE

4. Store the certificate password in CSC_KEY_PASSWORD (and optionally WIN_CSC_KEY_PASSWORD for Windows-only override).

## Local development builds

For local unsigned builds (common during development), do nothing; electron-builder will produce unsigned artifacts (or you can build via Forge dev tools). To sign locally, export credentials before running a build:

macOS example:

- export CSC_LINK="file:///Users/me/certs/DeveloperID.p12"
- export CSC_KEY_PASSWORD="your_password"
- export APPLE_ID="me@example.com"
- export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
- export APPLE_TEAM_ID="ABCDE12345"
- npx electron-builder -mwl

Windows example (PowerShell):

- $env:WIN_CSC_LINK = "file://C:/certs/CodeSignCert.pfx"
- $env:WIN_CSC_KEY_PASSWORD = "your_password"
- npx electron-builder -w

## CI example (GitHub Actions)

The following workflow builds and signs on all three platforms. Configure the listed secrets in your repository settings.

name: Release
on:
workflow_dispatch:

jobs:
build:
runs-on: ${{ matrix.os }}
strategy:
matrix:
os: [macos-latest, windows-latest, ubuntu-latest]
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with:
node-version: 20
cache: npm - run: npm ci - name: Build installers
env: # Cross-platform signing (used by macOS and Windows unless WIN\_\* is set)
CSC_LINK: ${{ secrets.CSC_LINK }} # set to base64:... or file://... or https://...
CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}

          # macOS notarization (Notarytool)
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # ASC_PROVIDER: ${{ secrets.ASC_PROVIDER }} # optional

          # Windows-specific override (optional)
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}

          # Linux note: AppImage is not code-signed by default
          CSC_IDENTITY_AUTO_DISCOVERY: false
        run: |
          npx electron-builder -mwl
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ${{ runner.os }}-artifacts
          path: dist/**

Notes:

- Set secrets under Repository Settings -> Secrets and variables -> Actions.
- If you prefer Apple API Key notarization, provide APPLE_API_KEY (file path or base64:...), APPLE_API_KEY_ID, and APPLE_API_ISSUER instead of APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD.

## Troubleshooting

- No identity found: Set CSC_IDENTITY_AUTO_DISCOVERY=false and/or provide CSC_NAME to target a specific identity.
- macOS notarization failures: Double-check APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID (or API key settings). Ensure the app is signed with a Developer ID Application certificate and hardened runtime is enabled.
- Windows signing errors: Verify the .pfx/.p12 password and that the certificate has the Code Signing EKU.
- Building on Linux for macOS: Not supported (you must sign macOS apps on macOS). Use a macOS runner.
