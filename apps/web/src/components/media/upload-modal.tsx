'use client';

import React, { useState, useRef } from 'react';
import type { FolderResponse, MediaItemResponse } from '@fbuploadpro/contracts';

export interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subdomain: string;
  folders: FolderResponse[];
  currentFolderId?: string | null;
  onUploadSuccess: (mediaItem: MediaItemResponse) => void;
}

export function detectMediaType(mimeType: string): 'video' | 'image' {
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
}

export function computeAspectRatio(width: number, height: number): string {
  if (!width || !height) return 'unknown';
  const ratio = width / height;

  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16';
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(ratio - 1) < 0.05) return '1:1';
  if (Math.abs(ratio - 4 / 5) < 0.05) return '4:5';

  return `${Math.round(ratio * 100) / 100}:1`;
}

async function extractMediaMetadataAndThumbnail(
  file: File
): Promise<{ thumbnailBlob: Blob | null; duration: number | null; aspectRatio: string }> {
  if (typeof window === 'undefined') {
    return { thumbnailBlob: null, duration: null, aspectRatio: 'unknown' };
  }

  const isVideo = file.type.startsWith('video/');

  if (isVideo) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.onloadedmetadata = () => {
        const duration = video.duration || null;
        const width = video.videoWidth || 1;
        const height = video.videoHeight || 1;
        const aspectRatio = computeAspectRatio(width, height);

        video.currentTime = Math.min(1, (duration || 2) / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 480;
          let w = video.videoWidth;
          let h = video.videoHeight;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(objectUrl);
              resolve({
                thumbnailBlob: blob,
                duration: video.duration || null,
                aspectRatio: computeAspectRatio(video.videoWidth, video.videoHeight),
              });
            }, 'image/webp', 0.8);
            return;
          }
        } catch (_e) {
          // Fallback if canvas extraction fails
        }
        URL.revokeObjectURL(objectUrl);
        resolve({ thumbnailBlob: null, duration: video.duration || null, aspectRatio: 'unknown' });
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ thumbnailBlob: null, duration: null, aspectRatio: 'unknown' });
      };
    });
  } else {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      img.onload = () => {
        const aspectRatio = computeAspectRatio(img.width, img.height);
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 480;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(objectUrl);
              resolve({ thumbnailBlob: blob, duration: null, aspectRatio });
            }, 'image/webp', 0.85);
            return;
          }
        } catch (_e) {
          // Fallback
        }
        URL.revokeObjectURL(objectUrl);
        resolve({ thumbnailBlob: null, duration: null, aspectRatio });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ thumbnailBlob: null, duration: null, aspectRatio: 'unknown' });
      };
    });
  }
}

export function UploadModal({
  isOpen,
  onClose,
  subdomain,
  folders,
  currentFolderId,
  onUploadSuccess,
}: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>(currentFolderId || '');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.size > 524288000) {
        setErrorMsg('File exceeds 500 MB maximum threshold');
        return;
      }
      setSelectedFile(f);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.size > 524288000) {
        setErrorMsg('File exceeds 500 MB maximum threshold');
        return;
      }
      setSelectedFile(f);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(5);
    setErrorMsg(null);

    try {
      // 1. Generate client-side thumbnail & technical metadata
      setProgress(15);
      const { thumbnailBlob, duration, aspectRatio } =
        await extractMediaMetadataAndThumbnail(selectedFile);

      // 2. Request presigned upload URL from server
      setProgress(25);
      const urlRes = await fetch(`/api/tenant/${subdomain}/media/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          thumbnailMimeType: 'image/webp',
        }),
      });

      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to request upload authorization');
      }

      const {
        mediaId,
        mediaKey,
        mediaUploadUrl,
        thumbnailKey,
        thumbnailUploadUrl,
        publicMediaUrl,
        publicThumbnailUrl,
      } = await urlRes.json();

      // 3. Upload primary file directly to Cloudflare R2
      setProgress(40);
      const uploadRes = await fetch(mediaUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload primary media file to object storage');
      }
      setProgress(75);

      // 4. Upload thumbnail if available
      if (thumbnailBlob && thumbnailUploadUrl) {
        await fetch(thumbnailUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/webp' },
          body: thumbnailBlob,
        }).catch(() => {
          // Non-blocking thumbnail upload
        });
      }
      setProgress(90);

      // 5. Confirm upload with API
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const confirmRes = await fetch(`/api/tenant/${subdomain}/media/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          name: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          mediaType: detectMediaType(selectedFile.type),
          storageKey: mediaKey,
          url: publicMediaUrl,
          thumbnailKey: thumbnailBlob ? thumbnailKey : null,
          thumbnailUrl: thumbnailBlob ? publicThumbnailUrl : null,
          durationSeconds: duration,
          aspectRatio,
          folderId: targetFolderId || null,
          tags,
        }),
      });

      if (!confirmRes.ok) {
        const errData = await confirmRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to confirm uploaded media asset');
      }

      const confirmedItem: MediaItemResponse = await confirmRes.json();
      setProgress(100);
      onUploadSuccess(confirmedItem);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '520px',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
            Upload Media Asset
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '1.5rem',
              color: '#94a3b8',
              cursor: uploading ? 'not-allowed' : 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              fontSize: '0.875rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging ? '2px dashed #2563eb' : '2px dashed #cbd5e1',
            borderRadius: '0.75rem',
            padding: '2rem 1rem',
            textAlign: 'center',
            backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {selectedFile ? (
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, color: '#0f172a' }}>
                {selectedFile.name}
              </p>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type}
              </p>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 500, color: '#334155' }}>
                Drag &amp; drop video or image here, or browse
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                MP4, MOV, WebM, PNG, JPG, WebP up to 500 MB
              </p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#64748b',
                marginBottom: '0.25rem',
              }}
            >
              <span>Uploading directly to Cloudflare R2...</span>
              <span>{progress}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '0.5rem',
                backgroundColor: '#e2e8f0',
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: '#2563eb',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Folder & Tag Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label
              style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}
            >
              Select folder (optional)
            </label>
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">Unorganized (Root)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}
            >
              Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. reel, summer, promotion"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '0.875rem',
              color: '#475569',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: selectedFile && !uploading ? 'pointer' : 'not-allowed',
              opacity: selectedFile && !uploading ? 1 : 0.6,
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
