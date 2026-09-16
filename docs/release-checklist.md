# macOS release checklist

Use this checklist for every public ClipFlux helper release.

## Pre-release

- [ ] Confirm `LOCAL_DOWNLOADER_EXTENSION_ID` is the published Chrome Web Store extension ID.
- [ ] Confirm Apple Silicon and Intel packages are built on their matching architectures.
- [ ] Confirm `Developer ID Application` and `Developer ID Installer` certificates are valid in Keychain Access.
- [ ] Confirm the `LocalDownloader` notarytool Keychain profile is valid.
- [ ] Review dependency and runtime version changes.
- [ ] Run lint, type checking, and the complete test suite.
- [ ] Document the previous signed package URL as the rollback artifact.

## Release

- [ ] Run `pnpm release:macos` for each supported architecture.
- [ ] Confirm every bundled executable has a hardened-runtime Developer ID signature.
- [ ] Confirm the installer has a Developer ID Installer signature.
- [ ] Confirm Apple notarization succeeds and the ticket is stapled.
- [ ] Confirm Gatekeeper accepts the package with `spctl`.
- [ ] Install on a clean macOS user account and verify Chrome native messaging.
- [ ] Download one video and one audio file, then open both from the extension queue.

## Publish

- [ ] Upload the stapled packages to the HTTPS release location.
- [ ] Build the extension with `WXT_INSTALLER_URL` set to the release URL.
- [ ] Verify **Install Downloader** downloads the signed package.
- [ ] Publish the matching extension version to the Chrome Web Store.
- [ ] Monitor failed native connections and download errors after release.

## Rollback triggers

- Gatekeeper rejects the package on a clean Mac.
- The installed native host cannot connect to the published extension ID.
- Runtime health checks fail after a clean installation.
- Video or audio downloads consistently fail compared with the previous release.
