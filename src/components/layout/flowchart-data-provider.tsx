'use client';

import { initPendingDataCleanup } from '@/lib/flowchart-callback-handler';
import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';

/**
 * FlowchartDataProvider - 初始化流程图数据清理
 *
 * 这个组件负责初始化过期待处理数据的清理机制
 * 确保用户在Google OAuth跳转期间保存的临时数据能够及时清理
 */
export function FlowchartDataProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    // 初始化数据清理机制
    initPendingDataCleanup();

    console.log('✅ FlowchartDataProvider initialized');
  }, []);

  return <>{children}</>;
}
