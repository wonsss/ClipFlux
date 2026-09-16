import { BrowserMessageSchema, type HelperMessage } from '@local-downloader/protocol';
import { getExtensionSettings } from '../lib/storage';
import { NativeClient } from '../lib/native-client';
import { DownloadQueueStore } from '../features/downloader/queue-store';
import { renderToolbarStatus, ToolbarStatus } from '../features/downloader/toolbar-status';
import { DownloadHistoryStore } from '../features/downloader/download-history';

export default defineBackground(() => {
  const native = new NativeClient();
  const queue = new DownloadQueueStore();
  const toolbar = new ToolbarStatus();
  const history = new DownloadHistoryStore();
  const refreshToolbar = (): void => { void renderToolbarStatus(toolbar.snapshot(queue.snapshot())).catch(() => undefined); };
  refreshToolbar();
  const broadcast = (event: HelperMessage): void => {
    if (event.type === 'error' && event.code === 'NATIVE_UNAVAILABLE') queue.failActive('Downloader Engine에 연결할 수 없습니다');
    queue.apply(event);
    toolbar.apply(event);
    if (event.type === 'download_completed') void history.record(event.videoId, event.kind).catch(() => undefined);
    refreshToolbar();
    void chrome.runtime.sendMessage({ type: 'native_event', event }).catch(() => undefined);
    void chrome.tabs.query({ url: 'https://www.youtube.com/*' }).then((tabs) => {
      for (const tab of tabs) if (tab.id !== undefined) void chrome.tabs.sendMessage(tab.id, { type: 'native_event', event }).catch(() => undefined);
    });
  };
  native.subscribe(broadcast);

  chrome.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
    const parsed = BrowserMessageSchema.safeParse(raw);
    if (!parsed.success) return false;
    if (parsed.data.type === 'get_extension_settings') {
      void getExtensionSettings().then(sendResponse);
      return true;
    }
    if (parsed.data.type === 'start_download') {
      native.send({ type: 'start_download', payload: queue.add(parsed.data.payload) });
      refreshToolbar();
      sendResponse({ accepted: true });
      return false;
    }
    if (parsed.data.type === 'get_download_queue') {
      sendResponse(queue.snapshot());
      return false;
    }
    if (parsed.data.type === 'get_download_history') {
      void history.snapshot().then(sendResponse);
      return true;
    }
    if (parsed.data.type === 'cancel_download') {
      native.send({ type: 'cancel_download', taskId: parsed.data.taskId });
      sendResponse({ accepted: true });
      return false;
    }
    if (parsed.data.type === 'open_download') {
      const path = queue.completedFile(parsed.data.taskId);
      if (path === undefined) {
        sendResponse({ accepted: false });
        return false;
      }
      native.send({ type: 'open_file', path });
      sendResponse({ accepted: true });
      return false;
    }
    return false;
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'popup-native') return;
    toolbar.resetCompletedCount();
    refreshToolbar();
    const unsubscribe = native.subscribe((event) => port.postMessage(event));
    port.onMessage.addListener((message: unknown) => {
      const request = message as { type?: string };
      if (request.type !== undefined) native.send(message as never);
    });
    port.onDisconnect.addListener(unsubscribe);
    native.connect();
  });
});
