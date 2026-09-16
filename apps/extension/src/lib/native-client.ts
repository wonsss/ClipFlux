import { HelperMessageSchema, type ExtensionMessage, type HelperMessage } from '@local-downloader/protocol';
import { NATIVE_HOST_NAME } from '@local-downloader/shared';

export type NativeEventListener = (event: HelperMessage) => void;

export class NativeClient {
  private port: chrome.runtime.Port | null = null;
  private readonly listeners = new Set<NativeEventListener>();

  public connect(): void {
    if (this.port !== null) return;
    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      this.port.onMessage.addListener((value: unknown) => {
        const parsed = HelperMessageSchema.safeParse(value);
        if (parsed.success) for (const listener of this.listeners) listener(parsed.data);
      });
      this.port.onDisconnect.addListener(() => {
        const detail = chrome.runtime.lastError?.message ?? 'Native helper disconnected';
        this.port = null;
        const event: HelperMessage = { type: 'error', code: 'NATIVE_UNAVAILABLE', message: detail };
        for (const listener of this.listeners) listener(event);
      });
    } catch (error) {
      const event: HelperMessage = { type: 'error', code: 'NATIVE_UNAVAILABLE', message: error instanceof Error ? error.message : 'Native helper unavailable' };
      for (const listener of this.listeners) listener(event);
    }
  }

  public send(message: ExtensionMessage): void {
    this.connect();
    if (this.port === null) throw new Error('Native helper unavailable');
    this.port.postMessage(message);
  }

  public subscribe(listener: NativeEventListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
