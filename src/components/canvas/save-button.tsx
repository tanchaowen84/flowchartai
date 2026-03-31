'use client';

import { Button } from '@/components/ui/button';
import { useFlowchartSave } from '@/hooks/use-flowchart-save';
import { cn } from '@/lib/utils';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SaveButtonProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  flowchartId?: string;
  flowchartTitle?: string;
  onFlowchartIdChange?: (newId: string) => void;
  // 新增：用于合并按钮的样式控制
  isMerged?: boolean;
}

export function SaveButton({
  excalidrawAPI,
  flowchartId,
  flowchartTitle,
  onFlowchartIdChange,
  isMerged = false, // 默认不是合并模式
}: SaveButtonProps) {
  const router = useRouter();
  const { saveFlowchart, saving, lastSaved } = useFlowchartSave(
    excalidrawAPI,
    flowchartId,
    flowchartTitle
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSave = async () => {
    const result = await saveFlowchart();

    if (result.success) {
      setSaveStatus('success');
      setErrorMessage('');

      // If this was a new flowchart (no existing flowchartId) and we got a new ID,
      // update the URL without reloading the page
      if (!flowchartId && result.flowchartId) {
        setTimeout(() => {
          // Update URL without page reload using History API
          const newUrl = `/canvas/${result.flowchartId}`;
          window.history.replaceState(null, '', newUrl);
          // Notify parent component about the flowchart ID change
          if (onFlowchartIdChange && result.flowchartId) {
            onFlowchartIdChange(result.flowchartId);
          }
          setSaveStatus('idle');
        }, 1000); // Wait 1 second to show the success state
      } else {
        // Reset status after 2 seconds for existing flowcharts
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } else {
      setSaveStatus('error');
      setErrorMessage(result.error || 'Save failed');
      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Get button icon based on status
  const getIcon = () => {
    if (saving) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (saveStatus === 'success') return <Check className="h-4 w-4" />;
    if (saveStatus === 'error') return <AlertCircle className="h-4 w-4" />;
    return <Save className="h-4 w-4" />;
  };

  // Get button variant based on status
  const getVariant = () => {
    if (saveStatus === 'success') return 'default' as const;
    if (saveStatus === 'error') return 'destructive' as const;
    return 'outline' as const;
  };

  // Get button text based on status
  const getText = () => {
    if (saving) return 'Saving...';
    if (saveStatus === 'success') return 'Saved!';
    if (saveStatus === 'error') return 'Error';
    return 'Save';
  };

  return (
    <div className={isMerged ? 'contents' : 'flex flex-col items-end'}>
      <Button
        onClick={handleSave}
        disabled={saving || !excalidrawAPI}
        variant={getVariant()}
        size="sm"
        className={cn(
          'gap-2 transition-all duration-200',
          isMerged && 'h-9 px-4 rounded-r-lg rounded-l-none border-0'
        )}
      >
        {getIcon()}
        <span className={isMerged ? 'text-sm font-medium' : ''}>
          {getText()}
        </span>
      </Button>

      {/* Show error message */}
      {saveStatus === 'error' && errorMessage && !isMerged && (
        <span
          className="text-xs text-destructive mt-1 max-w-32 truncate"
          title={errorMessage}
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
}
