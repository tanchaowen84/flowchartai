'use client';

import { Button } from '@/components/ui/button';
import { useFlowchartSave } from '@/hooks/use-flowchart-save';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SaveButtonProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  flowchartId?: string;
}

export function SaveButton({ excalidrawAPI, flowchartId }: SaveButtonProps) {
  const router = useRouter();
  const { saveFlowchart, saving, lastSaved } = useFlowchartSave(
    excalidrawAPI,
    flowchartId
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
      // redirect to the new URL
      if (!flowchartId && result.flowchartId) {
        setTimeout(() => {
          router.push(`/canvas/${result.flowchartId}`);
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
    <div className="flex flex-col items-end">
      <Button
        onClick={handleSave}
        disabled={saving || !excalidrawAPI}
        variant={getVariant()}
        size="sm"
        className="gap-2"
      >
        {getIcon()}
        {getText()}
      </Button>

      {/* Show last saved time when idle */}
      {saveStatus === 'idle' && lastSaved && (
        <span className="text-xs text-muted-foreground mt-1">
          Last saved: {lastSaved.toLocaleTimeString()}
        </span>
      )}

      {/* Show error message */}
      {saveStatus === 'error' && errorMessage && (
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
