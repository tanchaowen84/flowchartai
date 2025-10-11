'use client';

import { useSession } from '@/hooks/use-session';
import { authClient } from '@/lib/auth-client';
import {
  handlePendingFlowchart,
  initPendingDataCleanup,
} from '@/lib/flowchart-callback-handler';
import { Loader2Icon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FlowchartCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 设置页面标题
  useEffect(() => {
    document.title = 'Creating Flowchart... - FlowChart AI';

    // 设置meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Creating your AI flowchart, please wait...');
    }
  }, []);

  // 初始化清理过期数据
  useEffect(() => {
    initPendingDataCleanup();
  }, []);

  useEffect(() => {
    // 检查session状态
    if (session === undefined) {
      // session还在加载中
      setIsLoading(true);
      return;
    }

    setIsLoading(false);

    const stateId = searchParams.get('state');

    if (!stateId) {
      console.error('No state parameter found in callback');
      router.push('/canvas');
      return;
    }

    if (session?.user) {
      // 用户已登录，处理待创建的流程图
      setIsCreating(true);
      handlePendingFlowchart(stateId, session.user.id, router)
        .then((success) => {
          if (!success) {
            setError('Error creating flowchart. Please try again.');
            setTimeout(() => {
              router.push('/canvas');
            }, 3000);
          }
        })
        .catch((error) => {
          console.error('Error handling pending flowchart:', error);
          setError('Error creating flowchart. Please try again.');
          setTimeout(() => {
            router.push('/canvas');
          }, 3000);
        })
        .finally(() => {
          setIsCreating(false);
        });
    } else {
      // 用户未登录，重定向到登录页面并传递callbackUrl
      const currentUrl = encodeURIComponent(window.location.href);
      const loginUrl = `/auth/login?callbackUrl=${currentUrl}`;
      router.push(loginUrl);
    }
  }, [session, router, searchParams]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-950">
      {isCreating ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2Icon className="animate-spin h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold">Creating your flowchart...</h2>
          <p className="text-muted-foreground">Please wait while we prepare your canvas</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-red-600">Something went wrong</h2>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to canvas...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Loader2Icon className="animate-spin h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold">Preparing your flowchart...</h2>
          <p className="text-muted-foreground">
            {isLoading ? 'Verifying your login status...' : 'Processing your request...'}
          </p>
        </div>
      )}
    </div>
  );
}