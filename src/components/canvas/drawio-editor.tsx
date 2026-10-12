'use client';

import { Button } from '@/components/ui/button';
import type { DrawioDocument } from '@/lib/drawio/contracts';
import {
  type DrawioBridge,
  createDrawioBridge,
  watchDrawioEditor,
} from '@/lib/drawio/editor-bridge';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface DrawioEditorProps {
  initialDocument: DrawioDocument;
  onReady: (bridge: DrawioBridge | null) => void;
  onChange: (document: DrawioDocument) => void;
  onHistory: () => void;
}

export default function DrawioEditor({
  initialDocument,
  onReady,
  onChange,
  onHistory,
}: DrawioEditorProps) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onReady, onChange, onHistory });
  callbacks.current = { onReady, onChange, onHistory };
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    callbacks.current.onReady(null);
    let editorUi: any = null;
    let bridge: DrawioBridge | null = null;
    let unwatch: (() => void) | undefined;
    let active = true;
    let loaded = false;
    const finish = (): void => {
      if (!active || !loaded || !editorUi || bridge) return;
      try {
        bridge = createDrawioBridge(
          editorUi,
          iframe.current!.contentWindow!,
          initialDocument,
          (document) => callbacks.current.onChange(document),
          () => callbacks.current.onHistory()
        );
        setReady(true);
        setError(null);
        callbacks.current.onReady(bridge);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Editor could not be initialized'
        );
      }
    };
    const hook = (): void => {
      if (unwatch || !iframe.current?.contentWindow) return;
      const frame = iframe.current.contentWindow as any;
      if (!frame.EditorUi) return;
      unwatch = watchDrawioEditor(frame, (ui) => {
        if (ui.editor?.graph) {
          editorUi = ui;
          if (ui.getCurrentFile?.()) loaded = true;
          queueMicrotask(finish);
        }
      });
    };
    const message = (event: MessageEvent): void => {
      if (
        event.source !== iframe.current?.contentWindow ||
        event.origin !== window.location.origin
      )
        return;
      let data: any;
      try {
        data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      hook();
      const send = (payload: unknown): void =>
        iframe.current?.contentWindow?.postMessage(
          JSON.stringify(payload),
          window.location.origin
        );
      if (data?.event === 'configure')
        send({
          action: 'configure',
          config: {
            defaultFonts: ['Arial', 'Helvetica', 'Verdana'],
            defaultFontSize: 14,
          },
        });
      if (data?.event === 'init')
        send({
          action: 'load',
          xml: initialDocument.xml,
          autosave: 1,
          title: 'FlowchartAI',
        });
      if (data?.event === 'load') {
        loaded = true;
        finish();
      }
      if (data?.event === 'autosave') callbacks.current.onHistory();
    };
    window.addEventListener('message', message);
    const poll = window.setInterval(hook, 100);
    const timeout = window.setTimeout(() => {
      if (!bridge)
        setError(
          'The diagram editor did not load. Retry to load the local editor.'
        );
    }, 25000);
    return () => {
      active = false;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      window.removeEventListener('message', message);
      unwatch?.();
      bridge?.dispose();
    };
  }, [initialDocument.documentId, attempt]);
  return (
    <div className="relative h-full min-h-0 w-full">
      <iframe
        key={attempt}
        ref={iframe}
        title="Diagram editor"
        className="h-full w-full border-0"
        src="/drawio/index.html?embed=1&proto=json&configure=1&ui=simple&noSaveBtn=1&noExitBtn=1&spin=1&offline=1&libraries=0"
      />
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
          {error ? (
            <>
              <span role="alert">{error}</span>
              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  setReady(false);
                  setAttempt((n) => n + 1);
                }}
              >
                Retry editor
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading diagram editor…</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
