'use client';

import { authClient } from '@/lib/auth-client';
import { getUrlWithLocaleInCallbackUrl } from '@/lib/urls/urls';
import { DEFAULT_LOGIN_REDIRECT, Routes } from '@/routes';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface GoogleOneTapProps {
  callbackUrl?: string;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  disabled?: boolean;
  testMode?: boolean;
}

export const GoogleOneTap = ({
  callbackUrl: propCallbackUrl,
  onSuccess,
  onError,
  disabled = false,
  testMode = false,
}: GoogleOneTapProps) => {
  console.log('🎯 GoogleOneTap component initialized');
  console.log('🔧 Props:', {
    disabled,
    testMode,
    callbackUrl: propCallbackUrl,
  });

  const searchParams = useSearchParams();
  const locale = useLocale();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const initializeAttempted = useRef(false);

  // Determine callback URL
  const paramCallbackUrl = searchParams.get('callbackUrl');
  const defaultCallbackUrl = getUrlWithLocaleInCallbackUrl(
    DEFAULT_LOGIN_REDIRECT,
    locale
  );
  const callbackUrl = propCallbackUrl || paramCallbackUrl || defaultCallbackUrl;

  console.log('🔗 Callback URL determined:', callbackUrl);

  const handleCredentialResponse = async (response: any) => {
    if (!response.credential) {
      console.error('No credential received from Google One Tap');
      return;
    }

    try {
      console.log('🎉 Google One Tap credential received, triggering OAuth...');

      // Trigger Better Auth's Google OAuth flow
      await authClient.signIn.social(
        {
          provider: 'google',
          callbackURL: callbackUrl,
          errorCallbackURL: Routes.AuthError,
        },
        {
          onRequest: () => {
            console.log('Google OAuth flow initiated from One Tap');
          },
          onSuccess: () => {
            console.log('Google login successful');
            onSuccess?.();
          },
          onError: (ctx) => {
            console.error('Google login error:', ctx.error);
            onError?.(ctx.error);
          },
        }
      );
    } catch (error) {
      console.error('Error processing Google One Tap:', error);
      onError?.(error);
    }
  };

  // Load Google Identity Services script
  useEffect(() => {
    console.log('📜 Loading Google script...');

    if (disabled || typeof window === 'undefined') {
      console.log('❌ Skipping script load - disabled or no window');
      return;
    }

    const loadGoogleScript = () => {
      if (window.google?.accounts?.id) {
        console.log('✅ Google script already loaded');
        setIsScriptLoaded(true);
        return;
      }

      console.log('📥 Loading Google Identity Services script...');
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ Google script loaded successfully');
        setIsScriptLoaded(true);
      };
      script.onerror = () => {
        console.error('❌ Failed to load Google Identity Services script');
        onError?.('Failed to load Google script');
      };
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, [disabled, onError]);

  // Initialize Google One Tap
  useEffect(() => {
    console.log('🚀 Initializing Google One Tap...');
    console.log('📜 Script loaded:', isScriptLoaded);
    console.log('🌐 Google API available:', !!window.google?.accounts?.id);
    console.log('🔄 Initialize attempted:', initializeAttempted.current);

    if (
      !isScriptLoaded ||
      !window.google?.accounts?.id ||
      initializeAttempted.current ||
      disabled
    ) {
      console.log('❌ Skipping initialization - conditions not met');
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    console.log('🔑 Google Client ID:', clientId ? 'found' : 'not found');
    console.log('🧪 Test mode:', testMode);

    if (!clientId) {
      console.error('❌ Google Client ID not found');
      onError?.('Google Client ID not configured');
      return;
    }

    initializeAttempted.current = true;

    try {
      console.log('⚙️ Initializing Google One Tap with Client ID...');

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup',
        use_fedcm_for_prompt: false,
      });

      // Show the One Tap prompt after a short delay
      setTimeout(() => {
        if (window.google?.accounts?.id && !disabled) {
          console.log('🎭 Showing Google One Tap prompt...');
          window.google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed()) {
              console.log(
                'One Tap not displayed:',
                notification.getNotDisplayedReason()
              );
            } else if (notification.isSkippedMoment()) {
              console.log('One Tap skipped:', notification.getSkippedReason());
            } else if (notification.isDismissedMoment()) {
              console.log(
                'One Tap dismissed:',
                notification.getDismissedReason()
              );
            }
          });
        }
      }, 1000);
    } catch (error) {
      console.error('Error initializing Google One Tap:', error);
      onError?.(error);
    }
  }, [isScriptLoaded, disabled, callbackUrl, onError, testMode]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if ((window as any).google?.accounts?.id?.cancel) {
        try {
          (window as any).google.accounts.id.cancel();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  // This component doesn't render any visible UI
  // The One Tap prompt is rendered by Google's script
  return null;
};

export default GoogleOneTap;
