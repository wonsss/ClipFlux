import { findSingleIdentity, requireExtensionId, run } from './lib';

const applicationIdentity = process.env['LOCAL_DOWNLOADER_APPLICATION_IDENTITY']
  ?? await findSingleIdentity('Developer ID Application');
const installerIdentity = process.env['LOCAL_DOWNLOADER_INSTALLER_IDENTITY']
  ?? await findSingleIdentity('Developer ID Installer');
const profile = process.env['LOCAL_DOWNLOADER_NOTARY_PROFILE'] ?? 'LocalDownloader';
const extensionId = requireExtensionId();

await run('/usr/bin/xcrun', ['notarytool', 'history', '--keychain-profile', profile]);
console.log(`Application identity: ${applicationIdentity}`);
console.log(`Installer identity: ${installerIdentity}`);
console.log(`Notary profile: ${profile}`);
console.log(`Chrome extension ID: ${extensionId}`);
