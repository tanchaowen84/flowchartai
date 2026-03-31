'use client';

import { DividerWithText } from '@/components/auth/divider-with-text';
import { GitHubIcon } from '@/components/icons/github';
import { GoogleIcon } from '@/components/icons/google';
import { Button } from '@/components/ui/button';
import { websiteConfig } from '@/config/website';
import { authClient } from '@/lib/auth-client';
import { getUrlWithLocaleInCallbackUrl } from '@/lib/urls/urls';
import { DEFAULT_LOGIN_REDIRECT, Routes } from '@/routes';
import { Loader2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface SocialLoginButtonProps {
  callbackUrl?: string;
}

/**
 * social login buttons
 */
export const SocialLoginButton = ({
  callbackUrl: propCallbackUrl,
}: SocialLoginButtonProps) => {
  if (
    !websiteConfig.auth.enableGoogleLogin &&
    !websiteConfig.auth.enableGithubLogin
  ) {
    return null;
  }

  const t = useTranslations('AuthPage.login');
  const searchParams = useSearchParams();
  const paramCallbackUrl = searchParams.get('callbackUrl');
  // Use prop callback URL or param callback URL if provided, otherwise use the default login redirect
  const locale = useLocale();
  const defaultCallbackUrl = getUrlWithLocaleInCallbackUrl(
    DEFAULT_LOGIN_REDIRECT,
    locale
  );
  const callbackUrl = propCallbackUrl || paramCallbackUrl || defaultCallbackUrl;
  const [isLoading, setIsLoading] = useState<'google' | 'github' | null>(null);
  console.log('social login button, callbackUrl', callbackUrl);

  const onClick = async (provider: 'google' | 'github') => {
    setIsLoading(provider);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: callbackUrl,
      });
      if (result?.error) {
        console.log('social login error', result.error);
      }
      // Better Auth handles the redirect automatically
    } catch (error) {
      console.log('social login error', error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <DividerWithText text={t('or')} />
      {websiteConfig.auth.enableGoogleLogin && (
        <Button
          size="lg"
          className="w-full cursor-pointer"
          variant="outline"
          onClick={() => onClick('google')}
          disabled={isLoading === 'google'}
        >
          {isLoading === 'google' ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <GoogleIcon className="size-4 mr-2" />
          )}
          <span>{t('signInWithGoogle')}</span>
        </Button>
      )}
      {websiteConfig.auth.enableGithubLogin && (
        <Button
          size="lg"
          className="w-full cursor-pointer"
          variant="outline"
          onClick={() => onClick('github')}
          disabled={isLoading === 'github'}
        >
          {isLoading === 'github' ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <GitHubIcon className="size-4 mr-2" />
          )}
          <span>Sign in with GitHub</span>
        </Button>
      )}
    </div>
  );
};
