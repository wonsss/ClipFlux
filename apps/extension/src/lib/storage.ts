import { DEFAULT_EXTENSION_SETTINGS, ExtensionSettingsSchema, type ExtensionSettings } from '@local-downloader/protocol';

const KEY = 'extensionSettings';

export async function getExtensionSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(KEY);
  const parsed = ExtensionSettingsSchema.safeParse(stored[KEY]);
  return parsed.success ? parsed.data : structuredClone(DEFAULT_EXTENSION_SETTINGS);
}

export async function saveExtensionSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: ExtensionSettingsSchema.parse(settings) });
}
