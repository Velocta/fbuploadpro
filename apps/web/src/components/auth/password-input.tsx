import React, { forwardRef } from 'react';
import { Input, type InputProps } from '@/components/ui';

export type PasswordInputProps = Omit<InputProps, 'isPassword' | 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    return <Input ref={ref} isPassword={true} {...props} />;
  }
);
