import React from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface PasswordStrengthMeterProps {
  password: string;
}

export interface PasswordCriteria {
  label: string;
  met: boolean;
}

export function evaluatePasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Strong';
  color: string;
  criteria: PasswordCriteria[];
} {
  const criteria: PasswordCriteria[] = [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      label: 'Uppercase and lowercase letters',
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    {
      label: 'At least one number (0-9)',
      met: /\d/.test(password),
    },
    {
      label: 'At least one symbol (!@#$%^&*)',
      met: /[^a-zA-Z0-9]/.test(password),
    },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  if (!password || password.length === 0) {
    return {
      score: 0,
      label: 'Weak',
      color: 'var(--border-subtle, #272b38)',
      criteria,
    };
  }

  if (metCount <= 2 || password.length < 8) {
    return {
      score: 1,
      label: 'Weak',
      color: PALETTE.accent3, // Rose / Danger
      criteria,
    };
  }

  if (metCount === 3) {
    return {
      score: 3,
      label: 'Fair',
      color: PALETTE.primary, // Brand Gold
      criteria,
    };
  }

  return {
    score: 4,
    label: 'Strong',
    color: PALETTE.accent4, // Emerald / Success
    criteria,
  };
}

export function PasswordStrengthMeter({ password }: Readonly<PasswordStrengthMeterProps>) {
  if (!password) {
    return null;
  }

  const { score, label, color, criteria } = evaluatePasswordStrength(password);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
        marginTop: SPACING.xs,
        fontFamily: TYPOGRAPHY.fontFamily,
      }}
      aria-live="polite"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2px',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim, #6b7280)',
            fontWeight: TYPOGRAPHY.weights.medium,
          }}
        >
          Password strength
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color,
          }}
        >
          {label}
        </span>
      </div>

      {/* 4 Segmented Strength Indicator Bars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          height: '4px',
        }}
      >
        {[1, 2, 3, 4].map((step) => {
          const isFilled = score >= step;
          return (
            <div
              key={step}
              style={{
                height: '100%',
                borderRadius: RADII.xs,
                backgroundColor: isFilled ? color : 'var(--border-subtle, #272b38)',
                transition: 'background-color 200ms ease',
              }}
            />
          );
        })}
      </div>

      {/* Real-time Criteria Feedback */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          marginTop: SPACING.xs,
        }}
      >
        {criteria.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
              fontSize: '0.75rem',
              color: item.met ? 'var(--text-primary, #ffffff)' : 'var(--text-dim, #6b7280)',
              transition: 'color 150ms ease',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: RADII.full,
                backgroundColor: item.met ? PALETTE.accent4 : 'var(--border-subtle, #4b5563)',
                boxShadow: item.met ? `0 0 4px ${PALETTE.accent4}` : 'none',
                display: 'inline-block',
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
