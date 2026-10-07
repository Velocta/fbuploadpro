'use client';

import React, { useState } from 'react';
import type { CaptionTemplateResponse } from '@fbuploadpro/contracts';

export interface CaptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: CaptionTemplateResponse[];
  onCreateTemplate: (template: {
    title: string;
    content: string;
    tags: string[];
  }) => Promise<void> | void;
  onUpdateTemplate: (
    templateId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ) => Promise<void> | void;
  onDeleteTemplate: (templateId: string) => Promise<void> | void;
}

export function CaptionModal({
  isOpen,
  onClose,
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}: CaptionModalProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTagsInput('');
    setIsEditing(true);
  };

  const handleStartEdit = (t: CaptionTemplateResponse) => {
    setEditingId(t.id);
    setTitle(t.title);
    setContent(t.content);
    setTagsInput(t.tags.join(', '));
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    try {
      setIsSubmitting(true);
      if (editingId) {
        await onUpdateTemplate(editingId, {
          title: title.trim(),
          content: content.trim(),
          tags,
        });
      } else {
        await onCreateTemplate({
          title: title.trim(),
          content: content.trim(),
          tags,
        });
      }
      setIsEditing(false);
      setEditingId(null);
    } catch (_err) {
      // Handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (t: CaptionTemplateResponse) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(t.content);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 2000);
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
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📝</span>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
              Caption Templates Vault
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '1.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content Area */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {isEditing ? (
            /* Create / Edit Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>
                  Template Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Summer Promo Hook"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>
                  Caption Content
                </label>
                <textarea
                  placeholder="Draft caption body with hashtags and CTAs..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={5000}
                  rows={5}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. reel, promo, discount"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '0.8125rem',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          ) : (
            /* Templates List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {templates.length} saved templates
                </span>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                  }}
                >
                  + New Template
                </button>
              </div>

              {templates.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '0.5rem',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>No caption templates saved</p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Create reusable hooks and calls to action to speed up your content publishing.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a' }}>
                          {t.title}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            onClick={() => handleCopy(t)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                            }}
                          >
                            {copiedId === t.id ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(t)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTemplate(t.id)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border: '1px solid #fecaca',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.8125rem',
                          color: '#475569',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '60px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.content}
                      </p>

                      {t.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {t.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: '0.6875rem',
                                padding: '0.125rem 0.375rem',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                borderRadius: '0.25rem',
                              }}
                            >
                              {`#${tag}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
