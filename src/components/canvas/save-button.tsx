'use client';

import { Button } from '@/components/ui/button';
import type { FlowchartAutosaveStatus } from '@/lib/flowchart-autosave';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';

interface SaveButtonProps {
  status: FlowchartAutosaveStatus;
  onSave: () => void;
  onRetry: () => void;
  disabled?: boolean;
  error?: string | null;
  isMerged?: boolean;
}

export function SaveButton({
  status,
  onSave,
  onRetry,
  disabled = false,
  error,
  isMerged = false,
}: SaveButtonProps) {
  const isSaving = status === 'saving';
  const hasError = status === 'error';

  const icon = hasError ? (
    <AlertCircle className="h-4 w-4" />
  ) : isSaving ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : status === 'saved' ? (
    <Check className="h-4 w-4" />
  ) : (
    <Save className="h-4 w-4" />
  );

  const label = hasError
    ? 'Save failed · Retry'
    : isSaving
      ? 'Saving…'
      : status === 'saved'
        ? 'Saved'
        : 'Save';

  return (
    <div className={isMerged ? 'contents' : 'flex flex-col items-end'}>
      <Button
        type="button"
        onClick={hasError ? onRetry : onSave}
        disabled={disabled || isSaving}
        variant={hasError ? 'destructive' : 'outline'}
        size="sm"
        className={cn(
          'gap-2',
          isMerged && 'h-9 rounded-l-none rounded-r-lg border-0 px-4'
        )}
        title={hasError && error ? error : undefined}
      >
        {icon}
        <span className={isMerged ? 'text-sm font-medium' : ''}>{label}</span>
      </Button>

      {hasError && error && !isMerged && (
        <span className="mt-1 max-w-48 text-xs text-destructive" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
