'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Input, Button, Alert } from '@/components/ui';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';

export default function SignupPage() {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ret = params.get('returnUrl');
      if (ret) {
        setReturnUrl(ret);
      }
    }
  }, []);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleDetailsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMessage('Phone number is required.');
      return;
    }
    if (!cleanPhone.startsWith('+')) {
      setErrorMessage('Please include your country calling code starting with + (e.g. +1 555 123 4567 or +92 300 1234567).');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('A valid email address is required.');
      return;
    }
    const domain = cleanEmail.split('@')[1];
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
      setErrorMessage('Registration is currently limited to @gmail.com (or @googlemail.com) email addresses.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both password fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(sanitizeAuthErrorMessage(data.error, 'Unable to create your account at this moment. Please try again shortly.'));
        setIsSubmitting(false);
        return;
      }

      if (data.requiresOtp) {
        setStep('otp');
        setResendCooldown(60);
        setOtp('');
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setErrorMessage('Unable to create your account at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/signup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: cleanOtp,
          returnUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(sanitizeAuthErrorMessage(data.error, 'Invalid or expired verification code. Please try again.'));
        setIsSubmitting(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setErrorMessage('Unable to verify code at this moment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setErrorMessage(null);
    setSuccessNotice(null);
    setIsResending(true);

    try {
      const res = await fetch('/api/auth/signup/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(sanitizeAuthErrorMessage(data.error, 'Unable to resend code right now.'));
        if (data.cooldownSecondsRemaining) {
          setResendCooldown(data.cooldownSecondsRemaining);
        }
        setIsResending(false);
        return;
      }

      setSuccessNotice('A fresh 6-digit verification code has been dispatched to your email.');
      setResendCooldown(60);
      setIsResending(false);
    } catch {
      setErrorMessage('Failed to resend verification code. Please check your connection.');
      setIsResending(false);
    }
  };

  return (
    <AuthSplitLayout
      title={step === 'details' ? 'Create Account' : 'Verify Your Email'}
      description={
        step === 'details'
          ? 'Start scheduling and auto-publishing Facebook Reels in minutes.'
          : `We've sent a 6-digit confirmation code to ${email}. Enter the code below to activate your account.`
      }
      footer={
        step === 'details' ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-sub, #9ca3af)' }}>
            Already have an account?{' '}
            <Link
              href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
              style={{
                color: PALETTE.primary,
                textDecoration: 'none',
                fontWeight: TYPOGRAPHY.weights.semibold,
              }}
            >
              Sign in
            </Link>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setStep('details');
              setErrorMessage(null);
              setSuccessNotice(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub, #9ca3af)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Need to change your details? Return to form
          </button>
        )
      }
    >
      {errorMessage && (
        <div style={{ marginBottom: SPACING.lg }}>
          <Alert
            severity="error"
            title={step === 'details' ? "Couldn't create account" : 'Verification Failed'}
            message={sanitizeAuthErrorMessage(errorMessage)}
            onClose={() => setErrorMessage(null)}
          />
        </div>
      )}

      {successNotice && (
        <div style={{ marginBottom: SPACING.lg }}>
          <Alert
            severity="success"
            title="Code Sent"
            message={successNotice}
            onClose={() => setSuccessNotice(null)}
          />
        </div>
      )}

      {step === 'details' ? (
        <form onSubmit={handleDetailsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          <Input
            label="Full Name"
            placeholder="Jane Doe"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 555 123 4567"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
            required
            helperText="Include country code starting with + (e.g. +1... or +92...)"
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="you@gmail.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
            helperText="Only @gmail.com accounts are supported"
          />

          <div>
            <PasswordInput
              label="Password"
              placeholder="••••••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
              helperText="Minimum 8 characters"
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <PasswordInput
            label="Confirm Password"
            placeholder="••••••••••••"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: '100%', marginTop: SPACING.xs }}
          >
            Create Account
          </Button>

          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim, #6b7280)',
              lineHeight: 1.5,
              textAlign: 'center',
              marginTop: SPACING.xs,
              marginBottom: 0,
            }}
          >
            By creating an account, you agree to our{' '}
            <a
              href="/terms"
              style={{
                color: PALETTE.primary,
                textDecoration: 'none',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              style={{
                color: PALETTE.primary,
                textDecoration: 'none',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              Privacy Policy
            </a>
            .
          </p>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
          <div>
            <Input
              label="6-Digit Verification Code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="••••••"
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isSubmitting}
              required
              helperText="Check your spam folder if you do not see the email in your inbox."
              style={{
                textAlign: 'center',
                letterSpacing: '0.4em',
                fontSize: '1.25rem',
                fontWeight: TYPOGRAPHY.weights.bold,
              }}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: '100%' }}
          >
            Verify & Activate Account
          </Button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: SPACING.xs,
            }}
          >
            {resendCooldown > 0 ? (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim, #6b7280)' }}>
                Resend code in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isResending}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: PALETTE.primary,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {isResending ? 'Sending...' : 'Resend verification code'}
              </button>
            )}
          </div>
        </form>
      )}
    </AuthSplitLayout>
  );
}
