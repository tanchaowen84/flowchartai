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
    document.title = '创建流程图中... - FlowChart AI';

    // 设置meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', '正在为您创建AI流程图，请稍候...');
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
            setError('创建流程图时出错，请重试');
            setTimeout(() => {
              router.push('/canvas');
            }, 3000);
          }
        })
        .catch((error) => {
          console.error('Error handling pending flowchart:', error);
          setError('创建流程图时出错，请重试');
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
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        {isCreating ? (
          <>
            <Loader2Icon className="animate-spin mx-auto h-12 w-12 text-primary" />
            <h2 className="text-xl font-semibold">正在为您创建流程图...</h2>
            <p className="text-muted-foreground">请稍候，我们正在处理您的请求</p>
          </>
        ) : error ? (
          <>
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-red-600">出错了</h2>
            <p className="text-muted-foreground max-w-md">{error}</p>
            <p className="text-sm text-muted-foreground">正在跳转到画布页面...</p>
          </>
        ) : (
          <>
            <Loader2Icon className="animate-spin mx-auto h-12 w-12 text-primary" />
            <h2 className="text-xl font-semibold">准备创建流程图...</h2>
            <p className="text-muted-foreground">
              {isLoading ? '正在验证登录状态...' : '正在处理您的请求...'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}