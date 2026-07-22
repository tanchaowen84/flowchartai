import type { AiAssistantMode } from '@/lib/ai-modes';
import { authClient } from '@/lib/auth-client';
import {
  buildCallbackUrl,
  generateStateId,
  savePendingFlowchartData,
} from '@/lib/flowchart-callback-handler';
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StartFlowchartSessionParams {
  mode: AiAssistantMode;
  prompt?: string;
  imagePayload?: {
    base64: string;
    thumbnail?: string;
    filename?: string;
  };
  router: {
    push: (href: string) => void;
  };
}

/**
 * Prepare localStorage + navigation so canvas auto-generates via AI sidebar.
 * Handles logged-in users by pre-creating a flowchart via `/api/flowcharts`.
 * For guest users, shows login modal and saves pending data.
 */
export async function startFlowchartSession({
  mode,
  prompt,
  imagePayload,
  router,
}: StartFlowchartSessionParams) {
  if (typeof window === 'undefined') return;

  const sessionAtom = authClient.$store.atoms.session;
  const session = sessionAtom?.get();
  const userId = session?.user?.id;

  if (userId) {
    // 已登录用户：直接创建流程图
    localStorage.setItem('flowchart_auto_generate', 'true');
    localStorage.setItem('flowchart_auto_mode', mode);

    if (prompt) {
      localStorage.setItem('flowchart_auto_input', prompt);
    } else {
      localStorage.removeItem('flowchart_auto_input');
    }

    if (imagePayload) {
      localStorage.setItem(
        'flowchart_auto_image',
        JSON.stringify(imagePayload)
      );
    } else {
      localStorage.removeItem('flowchart_auto_image');
    }

    try {
      const response = await fetch('/api/flowcharts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to pre-create flowchart');
      }

      const data = (await response.json()) as { id: string };
      router.push(`/canvas/${data.id}`);
      return;
    } catch (error) {
      console.error('startFlowchartSession: pre-create failed', error);
      // fallback to guest flow
    }

    router.push('/canvas');
  } else {
    // Guest用户：保存状态并显示登录模态框
    console.log(
      '🎯 Guest user detected in startFlowchartSession - redirecting to login'
    );

    try {
      const stateId = generateStateId();

      // 保存待创建的流程图数据
      await savePendingFlowchartData(
        stateId,
        prompt || '',
        mode,
        null, // 这里没有File对象，因为我们只有base64数据
        null
      );

      // 如果有图片数据，特殊处理
      if (imagePayload) {
        // 更新保存的数据，添加图片信息
        const existingData = sessionStorage.getItem(`pending_${stateId}`);
        if (existingData) {
          const data = JSON.parse(existingData);
          data.imageFile = {
            name: imagePayload.filename || 'image',
            size: imagePayload.base64.length * 0.75, // 估算大小
            base64: imagePayload.base64,
            thumbnail: imagePayload.thumbnail,
          };
          sessionStorage.setItem(`pending_${stateId}`, JSON.stringify(data));
        }
      }

      // 构造回调URL并重定向到登录页面
      const callbackUrl = buildCallbackUrl(stateId);
      const loginUrl = `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      router.push(loginUrl);

      console.log('✅ Pending data saved and redirecting to login');
    } catch (error) {
      console.error('Error saving pending data:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to prepare your request. Please try again.');
      router.push('/canvas'); // fallback
    }
  }
}
