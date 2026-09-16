# Native Messaging

The registered host name is `com.localdownloader.helper`. Chrome starts the compiled executable and exchanges UTF-8 JSON messages framed by a four-byte little-endian unsigned body length. Messages are capped at 1 MiB; malformed length, malformed JSON, and schema-invalid input are rejected.

The host manifest contains only `name`, `description`, absolute `path`, `type: "stdio"`, and the configured `allowed_origins` Chrome extension origin. Development registration requires `LOCAL_DOWNLOADER_EXTENSION_ID`; production packaging requires the published ID. No temporary extension ID is checked in.

`stdout` is protocol-only. Diagnostics go to `stderr`. There is no HTTP listener, localhost endpoint, or shell command interface.

Requests are the allowlisted discriminated union in `packages/protocol`: health/settings operations, folder selection, start/cancel download, and yt-dlp update operations. There is deliberately no raw argument, command, executable, or output-path request.

Chrome's macOS user-level manifest directory is:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
```

The package scaffold uses Chrome's system-level directory under `/Library/Google/Chrome/NativeMessagingHosts`. Brave, Edge, and Chromium use different registration locations and are future extension points; the MVP registers Google Chrome only.

