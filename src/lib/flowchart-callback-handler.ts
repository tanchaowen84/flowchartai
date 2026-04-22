import { createImageThumbnail, encodeImageToBase64 } from '@/lib/image-utils';
import type { useRouter } from 'next/navigation';

export interface PendingFlowchartData {
  input: string;
  mode: 'text_to_flowchart' | 'image_to_flowchart';
  imageFile?: {
    name: string;
    size: number;
    base64: string;
    thumbnail?: string;
  };
  timestamp: number;
}

export interface FlowchartCallbackOptions {
  title?: string;
  message?: string;
}

/**
 * 生成唯一的状态ID用于标识待处理的流程图
 */
export function generateStateId(): string {
  return `flowchart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 构造回调URL，用于Google OAuth登录后的重定向
 */
export function buildCallbackUrl(stateId: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/auth/callback/flowchart?state=${stateId}`;
}

/**
 * 保存用户输入到sessionStorage，用于Google OAuth跳转期间的状态保持
 */
export async function savePendingFlowchartData(
  stateId: string,
  input: string,
  mode: 'text_to_flowchart' | 'image_to_flowchart',
  imageFile?: File | null,
  imagePreview?: string | null
): Promise<void> {
  // 验证输入
  if (!input.trim() && mode !== 'image_to_flowchart') {
    throw new Error('Input text is required for text mode');
  }

  if (mode === 'image_to_flowchart' && !imageFile) {
    throw new Error('Image file is required for image mode');
  }

  const pendingData: PendingFlowchartData = {
    input: input.trim(),
    mode,
    timestamp: Date.now(),
  };

  // 处理图片文件（限制大小）
  if (imageFile && mode === 'image_to_flowchart') {
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

    if (imageFile.size > MAX_IMAGE_SIZE) {
      throw new Error('Image file too large. Maximum size is 5MB.');
    }

    try {
      const base64 = await encodeImageToBase64(imageFile);
      const thumbnail =
        imagePreview || (await createImageThumbnail(imageFile, 320, 200));

      pendingData.imageFile = {
        name: imageFile.name,
        size: imageFile.size,
        base64,
        thumbnail,
      };
    } catch (error) {
      console.error('Failed to process image file:', error);
      throw new Error(
        'Failed to process image file. Please try a different image.'
      );
    }
  }

  try {
    // 保存到sessionStorage（Google跳转期间更安全）
    const key = `pending_${stateId}`;
    sessionStorage.setItem(key, JSON.stringify(pendingData));

    console.log('✅ Pending flowchart data saved:', {
      stateId,
      mode,
      hasImage: !!imageFile,
    });
  } catch (error) {
    console.error('Failed to save pending data to sessionStorage:', error);
    throw new Error(
      'Failed to save your request. Your browser storage might be full.'
    );
  }
}

/**
 * 从sessionStorage获取待处理的流程图数据
 */
export function getPendingFlowchartData(
  stateId: string
): PendingFlowchartData | null {
  try {
    const key = `pending_${stateId}`;
    const dataStr = sessionStorage.getItem(key);

    if (!dataStr) {
      console.warn('No pending data found for state:', stateId);
      return null;
    }

    const data: PendingFlowchartData = JSON.parse(dataStr);

    // 验证数据有效性（24小时过期）
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    if (now - data.timestamp > maxAge) {
      console.warn('Pending data expired:', stateId);
      sessionStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error retrieving pending flowchart data:', error);
    return null;
  }
}

/**
 * 清理待处理的流程图数据
 */
export function clearPendingFlowchartData(stateId: string): void {
  const key = `pending_${stateId}`;
  sessionStorage.removeItem(key);
  console.log('✅ Pending flowchart data cleared:', stateId);
}

/**
 * 创建流程图并设置自动生成参数
 */
export async function createFlowchartWithAutoGeneration(
  pendingData: PendingFlowchartData,
  userId: string,
  router: ReturnType<typeof useRouter>
): Promise<string | null> {
  try {
    console.log('🚀 Starting flowchart creation with auto-generation...');

    // 创建新流程图
    const response = await fetch('/api/flowcharts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // 空body用于预创建
    });

    if (!response.ok) {
      throw new Error('Failed to create flowchart');
    }

    const { id: flowchartId } = await response.json();
    console.log('✅ Flowchart created successfully:', flowchartId);

    // 立即设置自动生成参数到localStorage，确保canvas页面能立即获取
    localStorage.setItem('flowchart_auto_input', pendingData.input);
    localStorage.setItem('flowchart_auto_generate', 'true');
    localStorage.setItem('flowchart_auto_mode', pendingData.mode);

    // 处理图片
    if (pendingData.imageFile) {
      localStorage.setItem(
        'flowchart_auto_image',
        JSON.stringify({
          base64: pendingData.imageFile.base64,
          thumbnail: pendingData.imageFile.thumbnail,
          filename: pendingData.imageFile.name,
        })
      );
      console.log('✅ Image data saved to localStorage');
    }

    // 预缓存flowchart数据以减少canvas页面加载时间
    try {
      const cacheData = {
        id: flowchartId,
        title: 'Untitled',
        content:
          '{"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"}}',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 将数据存储在sessionStorage中以供canvas页面快速访问
      sessionStorage.setItem(
        `flowchart_cache_${flowchartId}`,
        JSON.stringify(cacheData)
      );
      console.log('✅ Flowchart data cached for immediate access');
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache flowchart data:', cacheError);
      // 缓存失败不是致命错误，继续流程
    }

    console.log('✅ All auto-generation data prepared successfully');
    return flowchartId;
  } catch (error) {
    console.error('❌ Error creating flowchart:', error);
    return null;
  }
}

/**
 * 处理完整的流程图创建和跳转流程
 */
export async function handlePendingFlowchart(
  stateId: string,
  userId: string,
  router: ReturnType<typeof useRouter>
): Promise<boolean> {
  try {
    // 获取待处理数据
    const pendingData = getPendingFlowchartData(stateId);
    if (!pendingData) {
      console.error('No valid pending data found for state:', stateId);
      return false;
    }

    // 创建流程图
    const flowchartId = await createFlowchartWithAutoGeneration(
      pendingData,
      userId,
      router
    );
    if (!flowchartId) {
      console.error('Failed to create flowchart');
      return false;
    }

    // 清理临时数据
    clearPendingFlowchartData(stateId);

    // 跳转到画布
    router.push(`/canvas/${flowchartId}`);
    return true;
  } catch (error) {
    console.error('Error handling pending flowchart:', error);
    return false;
  }
}

/**
 * 清理所有过期的待处理数据
 */
export function cleanupExpiredPendingData(): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24小时

  // 遍历所有sessionStorage项
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('pending_')) {
      try {
        const dataStr = sessionStorage.getItem(key);
        if (dataStr) {
          const data: PendingFlowchartData = JSON.parse(dataStr);
          if (now - data.timestamp > maxAge) {
            sessionStorage.removeItem(key);
            console.log('🧹 Cleaned up expired pending data:', key);
          }
        }
      } catch (error) {
        // 清理无效数据
        sessionStorage.removeItem(key);
      }
    }
  }
}

/**
 * 检查是否有过期的待处理数据（用于页面加载时清理）
 */
export function initPendingDataCleanup(): void {
  // 页面加载时清理过期数据
  if (typeof window !== 'undefined') {
    cleanupExpiredPendingData();

    // 每30分钟清理一次
    const intervalId = setInterval(cleanupExpiredPendingData, 30 * 60 * 1000);

    // 页面卸载时清理定时器
    window.addEventListener('beforeunload', () => {
      clearInterval(intervalId);
    });
  }
}
