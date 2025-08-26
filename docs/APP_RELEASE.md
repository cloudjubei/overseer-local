# App Release Guide (macOS, Windows, Linux)

This document explains, from the ground up, how to package and release this Electron application for macOS (DMG), Windows (NSIS), and Linux (AppImage) using electron-builder. It covers required credentials/certificates, environment variable configuration, and the scripts/commands to run locally and in CI.

If you have not yet configured signing credentials, also see: docs/BUILD_SIGNING.md.


## Overview
- Build tool: electron-builder
- Outputs:
  - macOS: .dmg + supporting files (latest-mac.yml, blockmap, zip)
  - Windows: .exe (NSIS) + supporting files (latest.yml, blockmap)
  - Linux: .AppImage + supporting files (latest-linux.yml)
- Resources in this repo:
  - build/icons/
    - icon.icns (macOS)
    - icon.ico (Windows)
    - icon.png (Linux, typically 512x512)
  - build/entitlements.mac.plist (macOS hardened runtime entitlements)
  - build/entitlements.mac.inherit.plist (macOS helper entitlements)
- electron-builder config: Typically defined under the "build" key in package.json. If your project uses electron-builder.config.* or electron-builder.yml, follow those instead.


## Prerequisites
- Node.js LTS and npm (or yarn/pnpm).
- Platform-specific requirements:
  - macOS builds/signing/notarization require running on macOS (Apple notarization requires macOS).
  - Windows signing is easiest on Windows (EV token/PIV often requires Windows). NSIS can be cross-built on macOS/Linux with Wine, but native Windows is recommended for reliable signing.
  - Linux AppImage can be built on Linux; cross-building from macOS/Windows may require extra tooling.


## Versioning
- Set your application version in package.json ("version"). For releases, tag using semantic versioning where possible.
- Example: npm version patch (or minor/major) to bump and create a git tag.


## Credentials and Certificates

### macOS (Code Signing and Notarization)
You need an Apple Developer Program account and a Developer ID Application certificate to distribute outside the Mac App Store.

Steps:
1) Enroll in Apple Developer Program (paid account).
2) Create a "Developer ID Application" certificate in Apple Developer Certificates portal and install it in your macOS Keychain.
3) Export the certificate + private key from Keychain as a .p12 file (set a strong password).
4) Base64-encode the .p12 so it can be stored in an environment variable (CSC_LINK):
   - macOS/Linux:
     - base64 -w0 cert.p12 > cert.p12.base64 (Linux)
     - base64 cert.p12 | tr -d '\n' > cert.p12.base64 (macOS)
   - Windows PowerShell:
     - [Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.p12")) > cert.p12.base64
5) Create an Apple app-specific password (if using Apple ID + password) OR set up an App Store Connect API key (preferred and more secure).

Environment variables (one of the two notarization methods):
- Certificate for codesign:
  - CSC_LINK=base64:<contents-of-cert.p12.base64>
  - CSC_KEY_PASSWORD=<p12-password>
- Notarization (method A: Apple ID + app-specific password):
  - APPLE_ID=<your-apple-id-email>
  - APPLE_APP_SPECIFIC_PASSWORD=<app-specific-password>
  - APPLE_TEAM_ID=<your-team-id> (recommended)
- Notarization (method B: API key):
  - APPLE_API_KEY_ID=<Key ID>
  - APPLE_API_ISSUER=<Issuer ID>
  - APPLE_API_KEY=<base64 of the .p8 content or absolute file path to .p8>

Notes:
- Hardened runtime must be enabled and entitlements configured. This repo provides:
  - build/entitlements.mac.plist
  - build/entitlements.mac.inherit.plist
- electron-builder will handle codesign + notarization if the above environment variables are set.


### Windows (Authenticode Code Signing)
For Windows, obtain a code signing certificate from a trusted CA.
- An OV (standard) certificate can be a .pfx/.p12 file.
- An EV certificate often comes on a hardware token (USB key). Using EV in CI requires specialized setup; many teams sign on a Windows runner/host.

Environment variables:
- If using .pfx/.p12 in CI:
  - WIN_CSC_LINK=base64:<contents-of-cert.p12.base64>
  - WIN_CSC_KEY_PASSWORD=<p12-password>
- Alternatively, the cross-platform variables CSC_LINK/CSC_KEY_PASSWORD also work on Windows when building on that platform.

Notes:
- Without a certificate, Windows builds will be unsigned. They can run but SmartScreen may warn users. Signing is strongly recommended for production.


### Linux (Optional GPG Signing for AppImage)
Linux AppImage does not require code signing; you can optionally sign artifacts with GPG.
- electron-builder supports GPG signing for AppImage if configured; this is optional and not required for distribution.


## Environment Variables Summary
Set as needed in your shell, .env, or CI secrets.
- Common signing:
  - CSC_LINK, CSC_KEY_PASSWORD
- macOS notarization:
  - APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
  - OR: APPLE_API_KEY_ID, APPLE_API_ISSUER, APPLE_API_KEY
- Windows-specific (optional alternative to CSC_*):
  - WIN_CSC_LINK, WIN_CSC_KEY_PASSWORD
- Publishing (GitHub Releases):
  - GH_TOKEN (a GitHub personal access token with repo scope)
- Misc helpful:
  - DEBUG=electron-builder (verbose logs)
  - CSC_IDENTITY_AUTO_DISCOVERY=false (to prevent auto-picking wrong identity locally)

Store sensitive values in your CI as encrypted secrets.


## Icons and Metadata
- Replace placeholder icons under build/icons/ with your real app icons:
  - macOS: build/icons/icon.icns
  - Windows: build/icons/icon.ico
  - Linux: build/icons/icon.png (512x512 recommended)
- Ensure your electron-builder config references these icons (default naming is already conventional).


## Local Build: Step-by-step
1) Install dependencies:
   - npm ci (or npm install)
2) Build the app (renderer, preload, main) with electron-vite:
   - npm run build
3) Prepare environment variables for signing/notarization as above (optional locally if only testing unsigned builds).
4) Package per platform:
   - macOS: npm run dist:mac (or npx electron-builder --mac)
   - Windows: npm run dist:win (or npx electron-builder --win)
   - Linux: npm run dist:linux (or npx electron-builder --linux)
   - All (on their respective OS or with cross-building prerequisites): npm run dist:all (or npx electron-builder -mwl)

Notes:
- If your package.json does not yet define dist:mac/dist:win/dist:linux scripts, you can use the npx commands shown above. Common script definitions are:
  - "dist:mac": "electron-builder --mac"
  - "dist:win": "electron-builder --win"
  - "dist:linux": "electron-builder --linux"
  - "dist:all": "electron-builder -mwl"
- Output artifacts are written to the dist/ directory (e.g., dist/mac/*.dmg, dist/win-unpacked and dist/*.exe, dist/*.AppImage).


## CI: GitHub Actions Example (Build and Release)
The recommended approach is to build on each native OS via a matrix job and publish to GitHub Releases using electron-builder.

1) Create GitHub Secrets in your repository settings:
   - GH_TOKEN
   - macOS signing/notarization:
     - CSC_LINK, CSC_KEY_PASSWORD
     - APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID (or API key variables instead)
   - Windows signing:
     - WIN_CSC_LINK, WIN_CSC_KEY_PASSWORD (or use CSC_LINK/CSC_KEY_PASSWORD if you prefer)

2) Example workflow (.github/workflows/release.yml):

   name: Build and Release
   on:
     push:
       tags:
         - 'v*'

   jobs:
     build:
       strategy:
         matrix:
           os: [macos-latest, windows-latest, ubuntu-latest]
       runs-on: ${{ matrix.os }}
       steps:
         - name: Checkout
           uses: actions/checkout@v4

         - name: Setup Node
           uses: actions/setup-node@v4
           with:
             node-version: '20'

         - name: Install dependencies
           run: npm ci

         - name: Build sources
           run: npm run build

         - name: Package and publish
           env:
             GH_TOKEN: ${{ secrets.GH_TOKEN }}
             # macOS cert + notarization (only used on macOS runners)
             CSC_LINK: ${{ secrets.CSC_LINK }}
             CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
             APPLE_ID: ${{ secrets.APPLE_ID }}
             APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
             APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
             # Windows cert (only used on Windows runners)
             WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
             WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
           run: |
             # electron-builder will infer platform from the host OS
             npx electron-builder --publish always

Notes:
- The workflow triggers on git tags that start with v (e.g., v1.2.3). Adjust the trigger as needed.
- electron-builder will create or update a GitHub Release and upload artifacts when GH_TOKEN is present and --publish is set.
- On macOS, notarization requires a macOS runner and valid Apple credentials.


## Configuring electron-builder
Most projects keep the electron-builder configuration under the "build" key in package.json. Common fields include:
- appId: Reverse-DNS identifier, e.g., com.example.myapp
- productName: Human-friendly app name
- directories: e.g., { buildResources: "build" }
- files: Which built files to include (e.g., dist/**)
- mac: category, target (dmg), hardenedRuntime, entitlements, entitlementsInherit, icon
- win: target (nsis), icon
- linux: target (AppImage), icon, category
- publish: Provider configuration (e.g., { provider: "github" })

If your configuration is in electron-builder.yml or electron-builder.config.js, confirm paths to icons and entitlements match:
- mac.entitlements: build/entitlements.mac.plist
- mac.entitlementsInherit: build/entitlements.mac.inherit.plist
- mac.hardenedRuntime: true
- mac.gatekeeperAssess: false (usually fine), sign/notarize handled by env vars


## Troubleshooting
- macOS notarization failed:
  - Verify APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD or API key values.
  - Confirm APPLE_TEAM_ID matches your Developer Team.
  - Ensure hardenedRuntime is enabled and entitlements files exist.
  - Retry with DEBUG=electron-builder for more logs.
- "No identity found" on macOS:
  - Ensure CSC_LINK/CSC_KEY_PASSWORD are set correctly, and the base64 content is intact (no newlines/whitespace issues).
- Windows signing issues:
  - Ensure WIN_CSC_LINK (or CSC_LINK) and WIN_CSC_KEY_PASSWORD match your .pfx/.p12.
  - EV tokens may require vendor software/USB key and running on Windows.
- Linux AppImage won't run on some systems:
  - Some distributions require FUSE; users can extract with: ./Your.AppImage --appimage-extract


## Outputs and Distribution
- Artifacts are written to dist/ by electron-builder, including:
  - macOS: .dmg, zip, latest-mac.yml, .blockmap
  - Windows: .exe (NSIS installer), latest.yml, .blockmap
  - Linux: .AppImage, latest-linux.yml
- If publish is configured, these files will be uploaded to your release provider (e.g., GitHub Releases) automatically in CI.


## Quick Recipes
- Unsigned local test build (current platform):
  - npm run build && npx electron-builder --publish never
- macOS signed + notarized build locally:
  - Export cert to .p12, set CSC_LINK/CSC_KEY_PASSWORD, APPLE_* env vars
  - npm run build && npx electron-builder --mac --publish never
- Full CI publish on tag push:
  - Push a tag like v1.2.3; GitHub Actions runs the matrix, signs, notarizes, and publishes artifacts.


## See Also
- docs/BUILD_SIGNING.md for deeper signing and credential management details
- electron-builder docs: https://www.electron.build/
