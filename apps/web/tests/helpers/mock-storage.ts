import type {
  IStorageService,
  PresignedUploadParams,
  PresignedUploadResult,
  PutObjectParams,
  PutObjectResult,
} from '@fbuploadpro/contracts';

function trimTrailingSlashes(str: string): string {
  let end = str.length;
  while (end > 0 && str.codePointAt(end - 1) === 47) {
    end--;
  }
  return str.slice(0, end);
}

export class MockStorageProvider implements IStorageService {
  public deletedKeys: Set<string> = new Set();
  public requestedUploadKeys: Set<string> = new Set();
  public uploadedObjects: Map<string, { contentType: string; byteLength: number }> = new Map();
  public publicUrlBase: string = 'https://media.fbuploadpro.com';

  getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult> {
    const expiresIn = params.expiresInSeconds ?? 900;
    this.requestedUploadKeys.add(params.key);
    return Promise.resolve({
      uploadUrl: `https://mock-r2.fbuploadpro.com/upload/${encodeURIComponent(params.key)}?expires=${expiresIn}`,
      publicUrl: this.getPublicUrl(params.key),
      expiresInSeconds: expiresIn,
    });
  }

  putObject(params: PutObjectParams): Promise<PutObjectResult> {
    this.uploadedObjects.set(params.key, {
      contentType: params.contentType,
      byteLength: params.body.byteLength,
    });
    this.deletedKeys.delete(params.key);
    return Promise.resolve({
      key: params.key,
      publicUrl: this.getPublicUrl(params.key),
      byteLength: params.body.byteLength,
    });
  }

  deleteObject(key: string): Promise<void> {
    this.deletedKeys.add(key);
    this.requestedUploadKeys.delete(key);
    this.uploadedObjects.delete(key);
    return Promise.resolve();
  }

  getPublicUrl(key: string): string {
    const trimmedBase = trimTrailingSlashes(this.publicUrlBase);
    const trimmedKey = key.replace(/^\/+/, '');
    return `${trimmedBase}/${trimmedKey}`;
  }

  reset(): void {
    this.deletedKeys.clear();
    this.requestedUploadKeys.clear();
    this.uploadedObjects.clear();
  }
}

let activeMockStorage: MockStorageProvider | null = null;

export function getMockStorageProvider(): MockStorageProvider {
  activeMockStorage ??= new MockStorageProvider();
  return activeMockStorage;
}
