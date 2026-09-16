# ClipFlux macOS packaging

The helper is compiled with `bun build --compile`, so the end user does not install Bun. Runtime components are stored outside the signed helper at `~/Library/Application Support/LocalDownloader/runtime`, allowing yt-dlp updates without modifying a signed binary.

For a release build:

1. Pin and audit dependency versions and the lockfile.
2. Build the extension and standalone helper.
3. Download and verify runtime assets for the package architecture (produce separate Apple Silicon and Intel packages).
4. Package those runtime assets as immutable bootstrap copies; the helper provisions its per-user mutable runtime directory on first use.
5. Generate the native host manifest with the published extension ID.
6. Run `pnpm package:macos` to sign every executable and build a Developer ID Installer-signed package.
7. Run `pnpm notarize:macos` to submit the package to Apple's notarization service and staple the ticket.
8. Publish over HTTPS and configure `WXT_INSTALLER_URL` in the extension build.

`pnpm release:macos` performs the quality checks and steps 2–7 in sequence. It uses Developer ID identities from Keychain Access and a `notarytool` Keychain profile named `LocalDownloader` by default, so no signing password is stored in this repository. The package installs immutable bootstrap runtime files under `/Library/LocalDownloader`; the helper copies them to the current user's Application Support directory on first use.

Runtime binaries must not be written inside a signed application bundle after installation. The path service isolates mutable runtime and configuration locations so future Windows/Linux implementations can substitute platform services.
