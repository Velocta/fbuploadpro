/**
 * @file index.ts
 * @description Desktop application shell configuration & window geometry (Tauri v2).
 */

import {
  type DesktopShellConfig,
  isDesktopApp,
  isMacDesktop,
  openExternalUrl,
  sendDesktopWindowAction,
} from '@fbuploadpro/contracts';

export {
  isDesktopApp,
  isMacDesktop,
  openExternalUrl,
  sendDesktopWindowAction,
  type DesktopShellConfig,
};

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

export const DESKTOP_TITLEBAR_HEIGHT = 36;
