# Security model

The webpage is untrusted. The content script sends only a generated task UUID, the canonical HTTPS watch URL, its 11-character video ID, and `video` or `audio`. The helper validates the message schema, exact `www.youtube.com` host, exact `/watch` path, HTTPS scheme, matching ID, trusted configuration enums, and managed paths.

The helper launches processes with `spawn(executable, argv, { shell: false })`. It never uses `exec`, `shell: true`, interpolated commands, raw browser-provided arguments, browser-provided paths, cookies, credentials, or a listening server. `--no-playlist` is always present. The macOS directory picker runs one fixed AppleScript expression through `/usr/bin/osascript`; no webpage-controlled text enters the script.

At most two tasks run concurrently. Duplicate task IDs are rejected. Cancellation sends `SIGTERM` and escalates to `SIGKILL`; helper termination stops children. Output filenames use `%(title)s [%(id)s].%(ext)s` beneath the helper-owned normalized base directory.

Production resolves only managed runtime paths. Deno and yt-dlp release downloads are restricted to official GitHub projects and verified against published SHA-256 checksums. FFmpeg/FFprobe artifacts are pinned dependencies protected by the package-manager integrity lock. yt-dlp update transport and provider are injectable for tests.

The project intentionally excludes DRM bypass, authentication/cookie extraction, arbitrary websites, paid/protected content, and arbitrary commands.

