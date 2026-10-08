'use client';

import React, { useState } from 'react';
import type { PageQueueSlot } from '@fbuploadpro/contracts';

export interface SlotsManagerProps {
  pageId: string;
  pageName?: string | undefined;
  slots: PageQueueSlot[];
  onAddSlot: (slotTime: string, timezone: string) => Promise<void>;
  onToggleSlot: (slotId: string, isActive: boolean) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
];

export function SlotsManager({
  pageId: _pageId,
  pageName,
  slots,
  onAddSlot,
  onToggleSlot,
  onDeleteSlot,
}: SlotsManagerProps) {
  const [slotTime, setSlotTime] = useState('09:00');
  const [timezone, setTimezone] = useState('UTC');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!slotTime) {
      setError('Please select a valid slot time.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddSlot(slotTime, timezone);
      setSlotTime('09:00');
    } catch (err: any) {
      setError(err?.message || 'Failed to add queue slot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #dadce0',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#202124' }}>
            Recurring Publishing Slots
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#5f6368' }}>
            {pageName ? `Configured for ${pageName}` : 'Daily recurring windows for dispatching queued content'}
          </p>
        </div>
        <span
          style={{
            padding: '0.25rem 0.6rem',
            backgroundColor: '#e8f0fe',
            color: '#1a73e8',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {slots.length} Active {slots.length === 1 ? 'Slot' : 'Slots'}
        </span>
      </div>

      {/* Add Slot Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          backgroundColor: '#f8f9fa',
          padding: '1rem',
          borderRadius: '6px',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#444' }}>
            Time (24h)
          </label>
          <input
            type="time"
            value={slotTime}
            onChange={(e) => setSlotTime(e.target.value)}
            required
            style={{
              padding: '0.45rem 0.65rem',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              fontSize: '0.9rem',
              backgroundColor: '#fff',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#444' }}>
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              fontSize: '0.9rem',
              backgroundColor: '#fff',
            }}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: '1.25rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#1877f2',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Adding...' : '+ Add Slot'}
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: '0.6rem 0.9rem',
            marginBottom: '1rem',
            backgroundColor: '#fce8e6',
            color: '#c5221f',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Slots List */}
      {slots.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            border: '1px dashed #dadce0',
            borderRadius: '6px',
            color: '#5f6368',
            fontSize: '0.9rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>
            No recurring publishing slots configured for this page.
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#80868b' }}>
            Add daily time slots above to start automatically publishing queued items.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {slots.map((slot) => {
            const timeFormatted = slot.slotTime.slice(0, 5);
            return (
              <div
                key={slot.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  border: '1px solid #e8eaed',
                  borderRadius: '6px',
                  backgroundColor: slot.isActive ? '#ffffff' : '#f8f9fa',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: slot.isActive ? '#202124' : '#80868b',
                      fontFamily: 'monospace',
                    }}
                  >
                    ⏰ {timeFormatted}
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: '#5f6368',
                        display: 'block',
                      }}
                    >
                      {slot.timezone}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: slot.isActive ? '#e6f4ea' : '#f1f3f4',
                      color: slot.isActive ? '#137333' : '#5f6368',
                    }}
                  >
                    {slot.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onToggleSlot(slot.id, !slot.isActive)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      border: '1px solid #dadce0',
                      backgroundColor: '#ffffff',
                      color: '#3c4043',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {slot.isActive ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSlot(slot.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      border: '1px solid #fad2cf',
                      backgroundColor: '#fff',
                      color: '#d93025',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
