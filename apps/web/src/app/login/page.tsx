'use client';

/**
 * Login — the form standard's reference implementation (spec 137 §3.8,
 * PR-A6). react-hook-form + zod resolver on the shared/ui Form
 * primitives: `onTouched` validation, inline errors under each field,
 * the FormErrorSummary on submit failure (focus moves to it, entries
 * link to their fields, wording matches the inline messages), input
 * never cleared by a failed submit, submit through the typed API
 * client (§3.1).
 *
 * Session-expired contract (§3.1): A1a's global 401 handler redirects
 * here with `?next=<path>&reason=session-expired`. This page renders
 * the plain-language session-expired notice for that reason, and the
 * post-login navigation honours `next` (or the legacy `returnUrl`) —
 * sanitized, so only safe in-app paths are ever followed.
 *
 * Behaviour preserved from the hand-rolled form it replaces: the
 * Gmail-only email rule and its wording, the OTP-pending redirect, the
 * suspended-account redirect, server 400 field errors mapped inline,
 * the reset-success / signed-out / password-changed banners, the email
 * prefill parameter, and the password field's show/hide toggle +
 * Caps Lock warning. Approved copy is unchanged — A6 was a
 * behaviour/standard conversion, not a redesign. Spec 136 (PR-136A)
 * later re-skinned this page's presentation residue (the footer
 * prompt/link) and the split layout/showcase chrome onto tokens;
 * the form logic, schema, and copy remain A6's, untouched.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { LoginShowcasePanel } from '@/components/auth/login-showcase-panel';
import {
  Form,
  FormControl,
  FormDescription,
  FormErrorSummary,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormErrorSummaryEntry,
} from '@/components/shared/ui/form';
import { Input } from '@/components/shared/ui/input';
import { Button } from '@/components/shared/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/ui/alert';
import { sanitizeAuthErrorMessage } from '@/lib/auth-errors';
import { sanitizeAuthRedirectUrl } from '@/lib/auth-redirect';
import { completeAuthRedirect } from '@/lib/auth-broadcast';
import { api, isApiError } from '@/lib/api';
import { LoginSuccessResponseSchema, type LoginErrorBody } from '@/lib/api/schemas/auth';
import { reportError } from '@/lib/report-error';
import { loginFormSchema, type LoginFormValues } from './login-form-schema';

/** Spec §3.1's exact notice copy. */
export const SESSION_EXPIRED_NOTICE =
  'Your session expired — sign in again to pick up where you left off';

export interface LoginPageProps {
  initialResetSuccess?: boolean | undefined;
}

type LoginFieldName = 'email' | 'password';

const FIELD_IDS: Record<LoginFieldName, string> = {
  email: 'login-email',
  password: 'login-password',
};

/**
 * Password control on the shared/ui Input: show/hide toggle + the Caps
 * Lock warning the login form has always carried. Forwards the RHF
 * field props (value / onChange / onBlur / ref) and FormControl's ARIA
 * wiring to the input.
 */
const PasswordControl = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  function PasswordControl({ onKeyDown, onKeyUp, onBlur, disabled, ...props }, ref) {
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);

    return (
      <div className="flex w-full flex-col">
        <div className="relative">
          <Input
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            className="pr-10"
            disabled={disabled}
            onKeyDown={(e) => {
              setCapsLockOn(e.getModifierState('CapsLock'));
              onKeyDown?.(e);
            }}
            onKeyUp={(e) => {
              setCapsLockOn(e.getModifierState('CapsLock'));
              onKeyUp?.(e);
            }}
            onBlur={(e) => {
              setCapsLockOn(false);
              onBlur?.(e);
            }}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            disabled={disabled}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" aria-hidden />
            ) : (
              <EyeIcon className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {capsLockOn && (
          <div role="status" aria-live="polite" className="mt-1 text-metadata font-medium text-brand-gold">
            Caps Lock is on
          </div>
        )}
      </div>
    );
  }
);

export default function LoginPage({ initialResetSuccess = false }: LoginPageProps = {}) {
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);
  const [isResetSuccess, setIsResetSuccess] = useState(initialResetSuccess);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onTouched',
    shouldFocusError: false,
    defaultValues: { email: '', password: '' },
  });
  const { formState } = form;
  const isSubmitting = formState.isSubmitting;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // §3.1's handler sends `next`; older flows send `returnUrl`. Both
    // are sanitized — only safe in-app paths survive (no open redirect).
    const rawReturn = params.get('next') ?? params.get('returnUrl');
    if (rawReturn) {
      setReturnUrl(sanitizeAuthRedirectUrl(rawReturn));
    }
    const emailParam = params.get('email');
    if (emailParam) {
      form.setValue('email', emailParam);
    }
    if (params.get('reset') === 'success') {
      setIsResetSuccess(true);
    }
    if (params.get('logout') === 'success') {
      setInfoBanner('You have been signed out successfully.');
    }
    if (params.get('reason') === 'password_changed') {
      setInfoBanner(
        'Your session was terminated because your password was recently updated. Please sign in again.'
      );
    }
    if (params.get('reason') === 'session-expired') {
      setSessionExpired(true);
    }
    // Mount-only: the query string is the page's entry state.
  }, []);

  const handleServerFieldErrors = (body: LoginErrorBody): boolean => {
    if (!body.details) return false;
    let mapped = false;
    for (const name of Object.keys(FIELD_IDS) as LoginFieldName[]) {
      const messages = body.details[name];
      if (Array.isArray(messages) && messages.length > 0 && typeof messages[0] === 'string') {
        form.setError(name, { type: 'server', message: messages[0] });
        mapped = true;
      }
    }
    return mapped;
  };

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitAttempted(true);
    setServerError(null);
    try {
      const data = await api.post(
        '/api/auth/login',
        {
          email: values.email.trim(),
          password: values.password,
          ...(returnUrl ? { returnUrl } : {}),
        },
        { schema: LoginSuccessResponseSchema }
      );
      completeAuthRedirect(data.redirectUrl, data.user);
    } catch (error) {
      if (!isApiError(error)) {
        reportError(error, { source: 'login-submit' });
        setServerError("Couldn't sign you in. Please check your connection and try again.");
        return;
      }
      const body = (error.cause ?? null) as LoginErrorBody | null;

      if (body?.requiresOtp) {
        const targetEmail = body.email || values.email.trim();
        window.location.href = `/signup?step=otp&email=${encodeURIComponent(targetEmail)}&notice=pending_verification`;
        return;
      }
      if (error.status === 403 && body?.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }
      if (error.status === 400 && body && handleServerFieldErrors(body)) {
        return;
      }
      if (error.kind === 'network') {
        setServerError("Couldn't sign you in. Please check your connection and try again.");
        return;
      }
      if (error.kind === 'parse' || (error.status !== undefined && error.status >= 500)) {
        reportError(error, { source: 'login-submit', kind: error.kind, status: error.status });
      }
      // A 401 from the login endpoint itself is bad credentials, not a
      // session expiry (the client maps every 401 to session-expired;
      // the login route is excluded from the redirect, and the server's
      // own message is the one the form has always shown).
      setServerError(
        sanitizeAuthErrorMessage(body?.error, 'Invalid email or password. Please try again.')
      );
    }
  };

  const summaryErrors: FormErrorSummaryEntry[] = [
    ...(Object.keys(FIELD_IDS) as LoginFieldName[]).flatMap((name) => {
      const message = formState.errors[name]?.message;
      return message ? [{ fieldId: FIELD_IDS[name], message: String(message) }] : [];
    }),
    ...(serverError ? [{ message: serverError }] : []),
  ];

  return (
    <AuthSplitLayout
      title="Sign In"
      description="Welcome back! Sign in to keep your content flowing across every platform."
      showcase={<LoginShowcasePanel />}
      footer={
        <span className="text-metadata text-ink-sub">
          Don&apos;t have an account?{' '}
          <Link
            href={returnUrl ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}` : '/signup'}
            className="font-semibold text-primary no-underline"
          >
            Create one
          </Link>
        </span>
      }
    >
      <Form {...form}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit, () => setSubmitAttempted(true))}
        >
          {sessionExpired && (
            <Alert variant="warning">
              <div className="flex flex-col gap-1">
                <AlertDescription>{SESSION_EXPIRED_NOTICE}</AlertDescription>
              </div>
            </Alert>
          )}
          {isResetSuccess && (
            <Alert variant="success">
              <div className="flex flex-col gap-1">
                <AlertTitle>Password Updated</AlertTitle>
                <AlertDescription>
                  Your password has been successfully reset. Please sign in with your new credentials.
                </AlertDescription>
              </div>
            </Alert>
          )}
          {infoBanner && (
            <Alert>
              <div className="flex flex-col gap-1">
                <AlertDescription>{infoBanner}</AlertDescription>
              </div>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem id={FIELD_IDS.email}>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@gmail.com"
                    autoComplete="username"
                    required
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormDescription>Only @gmail.com accounts are supported</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem id={FIELD_IDS.password}>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-body font-medium text-link hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordControl
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {submitAttempted && <FormErrorSummary errors={summaryErrors} />}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
            Sign In
          </Button>
        </form>
      </Form>
    </AuthSplitLayout>
  );
}
