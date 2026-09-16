const configuredInstallerUrl = import.meta.env.WXT_INSTALLER_URL;

export function hasPublicInstaller(): boolean {
  return typeof configuredInstallerUrl === 'string' && /^https:\/\//.test(configuredInstallerUrl);
}

export function publicInstallerUrl(): string | undefined {
  return hasPublicInstaller() ? configuredInstallerUrl : undefined;
}

export function installerUrl(): string {
  return chrome.runtime.getURL('/setup.html');
}
