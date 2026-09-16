import { ConfigStore } from './config/config-store';
import { DownloadRunner } from './downloader/download-runner';
import { encodeNativeMessage, NativeMessageDecoder } from './native-messaging/framing';
import { handleNativeMessage } from './native-messaging/host';
import { createRuntimePaths } from './runtime/paths';
import { RuntimeManager } from './runtime/runtime-manager';
import { YtDlpUpdater } from './updater/ytdlp-updater';

const paths = createRuntimePaths();
const config = new ConfigStore(paths.configFile);
const runtime = new RuntimeManager(paths);
const runner = new DownloadRunner(runtime);
const updater = new YtDlpUpdater(paths.ytDlp);
const decoder = new NativeMessageDecoder();

function send(message: unknown): void {
  process.stdout.write(encodeNativeMessage(message));
}

process.stdin.on('data', (chunk: Buffer) => {
  try {
    for (const message of decoder.push(chunk)) void handleNativeMessage(message, { config, runtime, runner, updater }, send);
  } catch (error) {
    process.stderr.write(`[helper] framing error: ${error instanceof Error ? error.message : 'unknown'}\n`);
    process.exitCode = 1;
    process.stdin.pause();
  }
});
process.stdin.on('end', () => { runner.stopAll(); });

void config.load().then(async (settings) => {
  if (!settings.updates.automaticYtDlp) return;
  const status = await runtime.status();
  const update = await updater.check(status.ytDlp.version);
  if (update.updateAvailable) await updater.update();
}).catch((error: unknown) => {
  process.stderr.write(`[helper] automatic yt-dlp update skipped: ${error instanceof Error ? error.message : 'unknown'}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    runner.stopAll();
    process.exit(0);
  });
}
