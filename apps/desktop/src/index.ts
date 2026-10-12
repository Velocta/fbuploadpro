/**
 * @file index.ts
 * @description Desktop application shell placeholder for FBUploadPro (Tauri v2).
 */

export interface DesktopShellConfig {
  appName: string;
  version: string;
  enableFolderWatcher: boolean;
}

export const DESKTOP_SHELL_CONFIG: DesktopShellConfig = {
  appName: 'FBUploadPro Desktop',
  version: '0.1.0',
  enableFolderWatcher: true,
};
