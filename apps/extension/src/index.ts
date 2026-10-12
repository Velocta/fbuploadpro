/**
 * @file index.ts
 * @description Browser companion extension shell placeholder for FBUploadPro (Manifest V3).
 */

export interface ExtensionShellConfig {
  name: string;
  version: string;
  manifestVersion: number;
  permissions: string[];
}

export const EXTENSION_SHELL_CONFIG: ExtensionShellConfig = {
  name: 'FBUploadPro Companion',
  version: '0.1.0',
  manifestVersion: 3,
  permissions: ['activeTab', 'storage'],
};
