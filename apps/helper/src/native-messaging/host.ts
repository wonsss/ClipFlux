import type { HelperMessage } from '@local-downloader/protocol';
import { ExtensionMessageSchema } from '@local-downloader/protocol';
import type { ConfigStore } from '../config/config-store';
import type { DownloadRunner } from '../downloader/download-runner';
import { chooseDirectory } from '../macos/directory-picker';
import { openDownloadedFile } from '../macos/open-file';
import type { RuntimeManager } from '../runtime/runtime-manager';
import type { YtDlpUpdater } from '../updater/ytdlp-updater';

export type HostDependencies = {
  config: ConfigStore;
  runtime: RuntimeManager;
  runner: DownloadRunner;
  updater: YtDlpUpdater;
};

export async function handleNativeMessage(
  input: unknown,
  dependencies: HostDependencies,
  send: (message: HelperMessage) => void,
): Promise<void> {
  const parsed = ExtensionMessageSchema.safeParse(input);
  if (!parsed.success) {
    send({ type: 'error', code: 'INVALID_MESSAGE', message: 'The native message is invalid' });
    return;
  }
  const message = parsed.data;
  try {
    switch (message.type) {
      case 'health_check':
        send({ type: 'health_result', status: await dependencies.runtime.status() });
        return;
      case 'get_settings':
        send({ type: 'settings_result', settings: await dependencies.config.load() });
        return;
      case 'update_settings':
        send({ type: 'settings_result', settings: await dependencies.config.save(message.settings) });
        return;
      case 'choose_download_directory': {
        const directory = await chooseDirectory();
        const settings = await dependencies.config.load();
        if (directory !== null) settings.output.baseDirectory = directory;
        send({ type: 'settings_result', settings: directory === null ? settings : await dependencies.config.save(settings) });
        return;
      }
      case 'start_download':
        try {
          await dependencies.runner.start(message.payload, await dependencies.config.load(), send);
        } catch (error) {
          send({ type: 'download_failed', taskId: message.payload.taskId, reason: error instanceof Error ? error.message : 'Unable to queue download' });
        }
        return;
      case 'cancel_download':
        if (!dependencies.runner.cancel(message.taskId)) throw new Error('Download task was not found');
        return;
      case 'open_file':
        await openDownloadedFile(message.path);
        return;
      case 'check_for_updates': {
        const status = await dependencies.runtime.status();
        const info = await dependencies.updater.check(status.ytDlp.version);
        send({ type: 'update_status', ...info });
        return;
      }
      case 'update_ytdlp': {
        const latestVersion = await dependencies.updater.update();
        send({ type: 'update_status', latestVersion, currentVersion: latestVersion, updateAvailable: false, updated: true });
        return;
      }
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Unexpected helper error';
    process.stderr.write(`[helper] ${message.type}: ${messageText}\n`);
    send({ type: 'error', code: 'REQUEST_FAILED', message: messageText, requestType: message.type });
  }
}
