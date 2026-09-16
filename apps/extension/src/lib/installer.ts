export function installerUrl(): string {
  return import.meta.env.WXT_INSTALLER_URL ?? chrome.runtime.getURL('/setup.html');
}
