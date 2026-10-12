'use client';

import type { FlowchartData } from '@/hooks/use-flowchart';
import { chooseCanvasEditor } from '@/lib/drawio/native-document';
import dynamic from 'next/dynamic';
import NativeDiagramWorkspace from './native-diagram-workspace';

const LegacyEditor = dynamic(() => import('./excalidraw-wrapper'), {
  ssr: false,
});

interface CanvasWorkspaceProps {
  flowchartId?: string;
  initialFlowchart?: FlowchartData | null;
  isFlowchartLoading?: boolean;
  flowchartLoadError?: string | null;
}

export default function CanvasWorkspace(props: CanvasWorkspaceProps) {
  if (props.flowchartId && !props.initialFlowchart) {
    return (
      <div
        className="flex h-screen items-center justify-center bg-background text-sm"
        role={props.flowchartLoadError ? 'alert' : 'status'}
      >
        {props.flowchartLoadError || 'Loading diagram…'}
      </div>
    );
  }
  const editor = chooseCanvasEditor(props.initialFlowchart?.content);
  if (editor === 'invalid')
    return (
      <div
        className="flex h-screen items-center justify-center text-destructive"
        role="alert"
      >
        This diagram could not be read. Its saved content has not been changed.
      </div>
    );
  if (editor === 'excalidraw') return <LegacyEditor {...props} />;
  return (
    <NativeDiagramWorkspace
      key={props.flowchartId || 'new'}
      flowchartId={props.flowchartId}
      initialFlowchart={props.initialFlowchart}
    />
  );
}
