'use client';

import { websiteConfig } from '@/config/website';
import { useCurrentUser } from '@/hooks/use-current-user';
import { authClient } from '@/lib/auth-client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface GoogleOneTapProviderProps {
  children: React.ReactNode;
}

export const GoogleOneTapProvider = ({
  children,
}: GoogleOneTapProviderProps) => {
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    console.log('🔍 Google One Tap - initializing...');
    console.log('👤 User:', currentUser);
    console.log('📍 Path:', pathname);
    console.log('⚙️ Feature enabled:', websiteConfig.auth.enableGoogleOneTap);

    // 简单条件：只在首页且未登录时显示
    if (
      !websiteConfig.auth.enableGoogleOneTap ||
      pathname !== '/' ||
      currentUser?.id
    ) {
      console.log('❌ Conditions not met, skipping One Tap');
      return;
    }

    console.log('✅ Conditions met, initializing Better Auth One Tap...');

    if (typeof (authClient as any).oneTap !== 'function') {
      console.warn(
        '⚠️ authClient.oneTap is not available, skipping initialization'
      );
      return;
    }

    const initializeOneTap = async () => {
      try {
        console.log('🎯 Calling Better Auth oneTap...');

        await (authClient as any).oneTap({
          fetchOptions: {
            onSuccess: async (context: any) => {
              console.log('✅ Google One Tap login successful!', context);

              // 重要：登录成功后需要刷新页面以更新session状态
              // 因为Better Auth的session需要通过页面刷新来同步客户端状态
              console.log('🔄 Refreshing page to sync session...');
              window.location.href = '/dashboard';
            },
            onError: (context: any) => {
              console.error('❌ Google One Tap login error:', context);
              // 如果One Tap失败，重定向到普通登录页面
              router.push('/auth/login');
            },
          },
          onPromptNotification: (notification: any) => {
            console.log('📢 One Tap prompt notification:', notification);
            if (notification.isNotDisplayed?.()) {
              console.log(
                '❌ One Tap not displayed:',
                notification.getNotDisplayedReason?.()
              );
            } else if (notification.isSkippedMoment?.()) {
              console.log(
                '⏭️ One Tap skipped:',
                notification.getSkippedReason?.()
              );
            } else if (notification.isDismissedMoment?.()) {
              console.log(
                '❌ One Tap dismissed:',
                notification.getDismissedReason?.()
              );
            }
          },
        });
      } catch (error) {
        console.error('❌ Error initializing Better Auth One Tap:', error);
        // 降级到普通登录
        router.push('/auth/login');
      }
    };

    // 延迟初始化，避免页面加载时的冲突
    const timer = setTimeout(() => {
      initializeOneTap();
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [currentUser, pathname, router]);

  return <>{children}</>;
};

export default GoogleOneTapProvider;
