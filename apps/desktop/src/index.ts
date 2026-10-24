/**
 * @file index.ts
 * @description Desktop application shell configuration & window geometry (Tauri v2).
 */

import { type DesktopShellConfig } from '@fbuploadpro/contracts';

export {
  isDesktopApp,
  isMacDesktop,
  openExternalUrl,
  sendDesktopWindowAction,
  type DesktopShellConfig,
} from '@fbuploadpro/contracts';

export const DESKTOP_SHELL_CONFIG: DesktopShellConfig = {
  appName: 'FBUploadPro Desktop',
  version: '0.1.0',
  userAgent: 'FBUploadProDesktop/0.1.0',
  frameless: true,
  defaultWidth: 1240,
  defaultHeight: 740,
  minWidth: 960,
  minHeight: 580,
};

export * from './bridge.js';

export const DESKTOP_TITLEBAR_HEIGHT = 36;
