import React, { forwardRef, useState } from 'react';
import { Input, type InputProps } from '@/components/ui';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export type PasswordInputProps = Omit<InputProps, 'isPassword' | 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ onKeyDown, onKeyUp, onBlur, helperText, ...props }, ref) {
    const [isCapsLockOn, setIsCapsLockOn] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
      onKeyDown?.(e);
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
      onKeyUp?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsCapsLockOn(false);
      onBlur?.(e);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Input
          ref={ref}
          isPassword={true}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={handleBlur}
          helperText={helperText}
          {...props}
        />
        {isCapsLockOn && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
              marginTop: '4px',
              fontSize: '0.75rem',
              color: PALETTE.primary,
              fontWeight: TYPOGRAPHY.weights.medium,
            }}
            role="status"
            aria-live="polite"
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: RADII.full,
                backgroundColor: PALETTE.primary,
                boxShadow: `0 0 4px ${PALETTE.primary}`,
                display: 'inline-block',
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <span>Caps Lock is on</span>
          </div>
        )}
      </div>
    );
  }
);
