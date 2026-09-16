import { readFileSync } from 'node:fs';
import { defineConfig } from 'wxt';

const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
const extensionKey = process.env['WXT_EXTENSION_KEY'];

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ClipFlux',
    description: 'Download public YouTube videos and audio with a local companion.',
    version: rootPackage.version,
    ...(extensionKey === undefined ? {} : { key: extensionKey }),
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    permissions: ['storage', 'nativeMessaging'],
    host_permissions: ['https://www.youtube.com/*'],
    action: {
      default_title: 'ClipFlux',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
  },
});
