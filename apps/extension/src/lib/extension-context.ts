/** Safely call the runtime API from content scripts that may outlive a reload. */
export function safeSendRuntimeMessage<T = unknown>(message: unknown): Promise<T> {
  try {
    return Promise.resolve(chrome.runtime.sendMessage(message) as T);
  } catch {
    return Promise.reject(new Error('Extension context unavailable'));
  }
}
