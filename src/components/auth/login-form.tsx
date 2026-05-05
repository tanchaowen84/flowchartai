'use client';

import { AuthCard } from '@/components/auth/auth-card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocaleLink, useLocaleRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { getUrlWithLocaleInCallbackUrl } from '@/lib/urls/urls';
import { cn } from '@/lib/utils';
import { DEFAULT_LOGIN_REDIRECT, Routes } from '@/routes';
import { zodResolver } from '@hookform/resolvers/zod';
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { SocialLoginButton } from './social-login-button';

export interface LoginFormProps {
  className?: string;
  callbackUrl?: string;
}

type AuthClientErrorContext = {
  error?: {
    status?: number | string;
    message?: string;
    statusText?: string;
  };
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
}: LoginFormProps) => {
  const t = useTranslations('AuthPage.login');
  const router = useLocaleRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const paramCallbackUrl = searchParams.get('callbackUrl');
  // Use prop callback URL or param callback URL if provided, otherwise use the default login redirect
  const locale = useLocale();
  const defaultCallbackUrl = getUrlWithLocaleInCallbackUrl(
    DEFAULT_LOGIN_REDIRECT,
    locale
  );
  const callbackUrl = propCallbackUrl || paramCallbackUrl || defaultCallbackUrl;
  console.log('login form, callbackUrl', callbackUrl);

  const [error, setError] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | undefined>('');
  const [otpSuccess, setOtpSuccess] = useState<string | undefined>('');
  const [isOtpPending, setIsOtpPending] = useState(false);

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

  const OtpCodeSchema = z.string().length(6, {
    message: t('codeRequired'),
  });

  const redirectAfterSignIn = () => {
    if (callbackUrl.startsWith('http')) {
      window.location.assign(callbackUrl);
      return;
    }

    router.push(callbackUrl as any);
    router.refresh();
  };

  const onSubmit = async (values: z.infer<typeof LoginSchema>) => {
    // 1. if callbackUrl is provided, user will be redirected to the callbackURL after login successfully.
    // if user email is not verified, a new verification email will be sent to the user with the callbackURL.
    // 2. if callbackUrl is not provided, we should redirect manually in the onSuccess callback.
    await authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
        callbackURL: callbackUrl,
      },
      {
        onRequest: (ctx) => {
          // console.log("login, request:", ctx.url);
          setIsPending(true);
          setError('');
          setSuccess('');
        },
        onResponse: (ctx) => {
          // console.log("login, response:", ctx.response);
          setIsPending(false);
        },
        onSuccess: (ctx) => {
          // console.log("login, success:", ctx.data);
          // setSuccess("Login successful");
          // router.push(callbackUrl || "/dashboard");
        },
        onError: (ctx) => {
          console.error('login, error:', ctx.error);
          setError(formatAuthClientError(ctx, t('signInFailed')));
        },
      }
    );
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const sendEmailOtp = async () => {
    const parsed = EmailCodeSchema.safeParse({ email: otpEmail });
    if (!parsed.success) {
      setOtpError(parsed.error.errors[0]?.message || t('emailRequired'));
      setOtpSuccess('');
      return;
    }

    await authClient.emailOtp.sendVerificationOtp(
      {
        email: parsed.data.email,
        type: 'sign-in',
      },
      {
        onRequest: () => {
          setIsOtpPending(true);
          setOtpError('');
          setOtpSuccess('');
        },
        onResponse: () => {
          setIsOtpPending(false);
        },
        onSuccess: () => {
          setOtpSent(true);
          setOtpCode('');
          setOtpSuccess(t('codeSent'));
        },
        onError: (ctx) => {
          console.error('send email otp error:', ctx.error);
          setOtpError(formatAuthClientError(ctx, t('sendCodeFailed')));
        },
      }
    );
  };

  const verifyEmailOtp = async () => {
    const parsed = OtpCodeSchema.safeParse(otpCode);
    if (!parsed.success) {
      setOtpError(parsed.error.errors[0]?.message || t('codeRequired'));
      setOtpSuccess('');
      return;
    }

    await authClient.signIn.emailOtp(
      {
        email: otpEmail,
        otp: parsed.data,
      },
      {
        onRequest: () => {
          setIsOtpPending(true);
          setOtpError('');
          setOtpSuccess('');
        },
        onResponse: () => {
          setIsOtpPending(false);
        },
        onSuccess: () => {
          setOtpSuccess(t('signedIn'));
          redirectAfterSignIn();
        },
        onError: (ctx) => {
          console.error('verify email otp error:', ctx.error);
          setOtpError(formatAuthClientError(ctx, t('verifyCodeFailed')));
        },
      }
    );
  };

  return (
    <AuthCard
      headerLabel={t('welcomeBack')}
      bottomButtonLabel={t('signUpHint')}
      bottomButtonHref={`${Routes.Register}`}
      className={cn('', className)}
    >
      <Tabs defaultValue="email-code" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email-code">{t('emailCodeTab')}</TabsTrigger>
          <TabsTrigger value="password">{t('passwordTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="email-code" className="mt-6">
          {!otpSent ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendEmailOtp();
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="email-code-login-email">{t('email')}</Label>
                <Input
                  id="email-code-login-email"
                  disabled={isOtpPending}
                  placeholder="name@example.com"
                  type="email"
                  value={otpEmail}
                  onChange={(event) => setOtpEmail(event.target.value)}
                />
              </div>
              <FormError message={otpError} />
              <FormSuccess message={otpSuccess} />
              <Button
                disabled={isOtpPending}
                size="lg"
                type="submit"
                className="w-full flex items-center justify-center gap-2 cursor-pointer"
              >
                {isOtpPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                <span>{isOtpPending ? t('sendingCode') : t('sendCode')}</span>
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                verifyEmailOtp();
              }}
              className="space-y-6"
            >
              <div className="space-y-3">
                <Label>{t('code')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('codeHint', { email: otpEmail })}
                </p>
                <InputOTP
                  maxLength={6}
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
                size="lg"
                type="submit"
                className="w-full flex items-center justify-center gap-2 cursor-pointer"
              >
                {isOtpPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                <span>
                  {isOtpPending ? t('verifyingCode') : t('verifyCode')}
                </span>
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
            </form>
          )}
        </TabsContent>
        <TabsContent value="password" className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                      <div className="flex justify-between items-center">
                        <FormLabel>{t('password')}</FormLabel>
                        <Button
                          size="sm"
                          variant="link"
                          asChild
                          className="px-0 font-normal text-muted-foreground"
                        >
                          <LocaleLink
                            href={`${Routes.ForgotPassword}`}
                            className="text-xs hover:underline hover:underline-offset-4 hover:text-primary"
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
                size="lg"
                type="submit"
                className="w-full flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                <span>{t('signIn')}</span>
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
      <div className="mt-4">
        <SocialLoginButton callbackUrl={callbackUrl} />
      </div>
    </AuthCard>
  );
};
