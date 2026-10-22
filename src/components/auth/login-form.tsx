'use client';

import { AuthCard } from '@/components/auth/auth-card';
import { BottomLink } from '@/components/auth/bottom-link';
import { DividerWithText } from '@/components/auth/divider-with-text';
import { FormError } from '@/components/shared/form-error';
import { FormSuccess } from '@/components/shared/form-success';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { LocaleLink } from '@/i18n/navigation';
import { safeAuthCallback, withAuthCallbackUrl } from '@/lib/auth-callback-url';
import { authClient } from '@/lib/auth-client';
import { getUrlWithLocaleInCallbackUrl } from '@/lib/urls/urls';
import { cn } from '@/lib/utils';
import { DEFAULT_LOGIN_REDIRECT, Routes } from '@/routes';
import { zodResolver } from '@hookform/resolvers/zod';
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { SocialLoginButton } from './social-login-button';

export interface LoginFormProps {
  className?: string;
  callbackUrl?: string;
  embedded?: boolean;
  intent?: 'login' | 'register';
}

type AuthClientErrorContext = {
  error?: {
    status?: number | string;
    message?: string;
    statusText?: string;
  } | null;
};

function formatAuthClientError(
  ctx: AuthClientErrorContext,
  fallbackMessage: string
): string {
  const status = ctx.error?.status;
  const message =
    ctx.error?.message || ctx.error?.statusText || fallbackMessage;

  return status ? `${status}: ${message}` : message;
}

export const LoginForm = ({
  className,
  callbackUrl: propCallbackUrl,
  embedded = false,
  intent = 'login',
}: LoginFormProps) => {
  const t = useTranslations('AuthPage.login');
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const paramCallbackUrl = searchParams.get('callbackUrl');
  // Use prop callback URL or param callback URL if provided, otherwise use the default login redirect
  const locale = useLocale();
  const defaultCallbackUrl = getUrlWithLocaleInCallbackUrl(
    DEFAULT_LOGIN_REDIRECT,
    locale
  );
  const callbackUrl = safeAuthCallback(
    propCallbackUrl || paramCallbackUrl || defaultCallbackUrl,
    typeof window === 'undefined' ? undefined : window.location.origin
  );

  const [error, setError] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email-code' | 'password'>(
    'email-code'
  );
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | undefined>('');
  const [otpSuccess, setOtpSuccess] = useState<string | undefined>('');
  const [isOtpPending, setIsOtpPending] = useState(false);
  const otpPendingRef = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  const updateEmail = (email: string): void => {
    setOtpEmail(email);
    try {
      sessionStorage.setItem('flowchartai:auth-email', email);
    } catch {}
  };
  useEffect(() => {
    try {
      const email = sessionStorage.getItem('flowchartai:auth-email');
      if (email) {
        setOtpEmail(email);
        form.setValue('email', email);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(
      () => setCooldown((seconds) => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const LoginSchema = z.object({
    email: z.string().email({
      message: t('emailRequired'),
    }),
    password: z.string().min(1, {
      message: t('passwordRequired'),
    }),
  });

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const EmailCodeSchema = z.object({
    email: z.string().email({
      message: t('emailRequired'),
    }),
  });

  const OtpCodeSchema = z.string().regex(/^\d{6}$/, {
    message: t('codeRequired'),
  });

  const redirectAfterSignIn = (): void => {
    window.location.assign(callbackUrl);
  };

  const onSubmit = async (
    values: z.infer<typeof LoginSchema>
  ): Promise<void> => {
    if (otpPendingRef.current) return;
    otpPendingRef.current = true;
    setIsPending(true);
    setError('');
    setSuccess('');
    updateEmail(values.email);
    try {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        callbackURL: callbackUrl,
      });
      if (result.error)
        setError(formatAuthClientError(result, t('signInFailed')));
    } catch {
      setError(t('signInFailed'));
    } finally {
      otpPendingRef.current = false;
      setIsPending(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const sendEmailOtp = async (): Promise<void> => {
    if (otpPendingRef.current || cooldown > 0) return;
    const parsed = EmailCodeSchema.safeParse({
      email: otpEmail.trim().toLowerCase(),
    });
    setOtpSuccess('');
    if (!parsed.success) {
      setOtpError(parsed.error.errors[0]?.message || t('emailRequired'));
      return;
    }
    otpPendingRef.current = true;
    setIsOtpPending(true);
    setOtpError('');
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: parsed.data.email,
        type: 'sign-in',
      });
      if (result.error || !result.data?.success) {
        if (result.error?.status === 429) setCooldown(60);
        setOtpError(formatAuthClientError(result, t('sendCodeFailed')));
        return;
      }
      updateEmail(parsed.data.email);
      setOtpSent(true);
      setOtpCode('');
      setCooldown(60);
      setOtpSuccess(t('codeSent'));
    } catch {
      setOtpError(t('sendCodeFailed'));
    } finally {
      otpPendingRef.current = false;
      setIsOtpPending(false);
    }
  };

  const verifyEmailOtp = async (): Promise<void> => {
    if (otpPendingRef.current) return;
    const parsed = OtpCodeSchema.safeParse(otpCode);
    setOtpSuccess('');
    if (!parsed.success) {
      setOtpError(t('codeRequired'));
      return;
    }
    otpPendingRef.current = true;
    setIsOtpPending(true);
    setOtpError('');
    try {
      const result = await authClient.signIn.emailOtp({
        email: otpEmail.trim().toLowerCase(),
        otp: parsed.data,
      });
      if (result.error || !result.data?.user) {
        setOtpError(formatAuthClientError(result, t('verifyCodeFailed')));
        return;
      }
      redirectAfterSignIn();
    } catch {
      setOtpError(t('verifyCodeFailed'));
    } finally {
      otpPendingRef.current = false;
      setIsOtpPending(false);
    }
  };

  const switchLoginMethod = () => {
    setError('');
    setSuccess('');
    setOtpError('');
    setOtpSuccess('');

    if (loginMethod === 'email-code') {
      if (otpEmail) form.setValue('email', otpEmail);
      setLoginMethod('password');
      return;
    }

    const passwordEmail = form.getValues('email');
    if (passwordEmail) updateEmail(passwordEmail);
    setLoginMethod('email-code');
  };

  const signUpHref = withAuthCallbackUrl(Routes.Register, callbackUrl);

  const authContent = (
    <div className="space-y-5">
      <SocialLoginButton
        callbackUrl={callbackUrl}
        showDivider={false}
        action="continue"
        disabled={isOtpPending || isPending}
      />

      <DividerWithText text={t('methodDivider')} />
      {loginMethod === 'email-code' && (
        <p className="text-sm text-muted-foreground">{t('emailAccountHint')}</p>
      )}

      {loginMethod === 'email-code' ? (
        !otpSent ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendEmailOtp();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email-code-login-email">{t('email')}</Label>
              <Input
                id="email-code-login-email"
                disabled={isOtpPending}
                placeholder="name@example.com"
                type="email"
                value={otpEmail}
                onChange={(event) => updateEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <FormError message={otpError} />
            <FormSuccess message={otpSuccess} />
            <Button
              disabled={isOtpPending || cooldown > 0}
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2"
            >
              {isOtpPending && <Loader2Icon className="size-4 animate-spin" />}
              <span>
                {isOtpPending
                  ? t('sendingCode')
                  : cooldown
                    ? t('resendIn', { seconds: cooldown })
                    : t('continueWithEmail')}
              </span>
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              verifyEmailOtp();
            }}
            className="space-y-4"
          >
            <div className="space-y-3">
              <Label>{t('code')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('codeHint', { email: otpEmail })}
              </p>
              <InputOTP
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otpCode}
                onChange={setOtpCode}
                disabled={isOtpPending}
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <FormError message={otpError} />
            <FormSuccess message={otpSuccess} />
            <Button
              disabled={isOtpPending || otpCode.length !== 6}
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2"
            >
              {isOtpPending && <Loader2Icon className="size-4 animate-spin" />}
              <span>{isOtpPending ? t('verifyingCode') : t('verifyCode')}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full cursor-pointer"
              disabled={isOtpPending}
              onClick={() => {
                setOtpSent(false);
                setOtpCode('');
                setOtpError('');
                setOtpSuccess('');
              }}
            >
              {t('editEmail')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isOtpPending || cooldown > 0}
              onClick={() => void sendEmailOtp()}
            >
              {cooldown
                ? t('resendIn', { seconds: cooldown })
                : t('resendCode')}
            </Button>
          </form>
        )
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('email')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          updateEmail(event.target.value);
                        }}
                        disabled={isPending}
                        placeholder="name@example.com"
                        type="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t('password')}</FormLabel>
                      <Button
                        size="sm"
                        variant="link"
                        asChild
                        className="px-0 font-normal text-muted-foreground"
                      >
                        <LocaleLink
                          href={`${Routes.ForgotPassword}`}
                          className="text-xs hover:text-primary hover:underline hover:underline-offset-4"
                        >
                          {t('forgotPassword')}
                        </LocaleLink>
                      </Button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          disabled={isPending}
                          placeholder="******"
                          type={showPassword ? 'text' : 'password'}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={togglePasswordVisibility}
                          disabled={isPending}
                        >
                          {showPassword ? (
                            <EyeOffIcon className="size-4 text-muted-foreground" />
                          ) : (
                            <EyeIcon className="size-4 text-muted-foreground" />
                          )}
                          <span className="sr-only">
                            {showPassword
                              ? t('hidePassword')
                              : t('showPassword')}
                          </span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormError message={error || urlError || undefined} />
            <FormSuccess message={success} />
            <Button
              disabled={isPending}
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2"
            >
              {isPending && <Loader2Icon className="size-4 animate-spin" />}
              <span>{t('signIn')}</span>
            </Button>
          </form>
        </Form>
      )}

      {!otpSent && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mx-auto flex h-auto px-2 py-0 font-normal text-muted-foreground"
          disabled={isPending || isOtpPending}
          onClick={switchLoginMethod}
        >
          {loginMethod === 'email-code'
            ? t('usePasswordInstead')
            : t('useEmailCodeInstead')}
        </Button>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className={cn('w-full', className)}>
        {authContent}
        <div className="mt-5 border-t pt-3">
          <BottomLink label={t('modalSignUpHint')} href={signUpHref} />
        </div>
      </div>
    );
  }

  return (
    <AuthCard
      headerLabel={
        intent === 'register' ? t('createAccount') : t('continueTitle')
      }
      bottomButtonLabel={
        intent === 'register' ? t('signInHint') : t('signUpHint')
      }
      bottomButtonHref={
        intent === 'register'
          ? withAuthCallbackUrl(Routes.Login, callbackUrl)
          : signUpHref
      }
      className={cn('', className)}
    >
      {authContent}
    </AuthCard>
  );
};
