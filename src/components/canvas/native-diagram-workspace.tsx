'use client';

import { LoginWrapper } from '@/components/auth/login-wrapper';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { FlowchartData } from '@/hooks/use-flowchart';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNativeDiagramSave } from '@/hooks/use-native-diagram-save';
import {
  type AiAssistantMode,
  DEFAULT_AI_ASSISTANT_MODE,
} from '@/lib/ai-modes';
import { emptyFlowchartAiMetadata } from '@/lib/diagram/metadata';
import {
  type DrawioDocument,
  EMPTY_DRAWIO_XML,
  drawioDocumentSchema,
} from '@/lib/drawio/contracts';
import type { DrawioBridge } from '@/lib/drawio/editor-bridge';
import { readNativeCells } from '@/lib/drawio/native-document';
import {
  Crosshair,
  Download,
  Home,
  MessageSquare,
  Redo2,
  Undo2,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DrawioEditor from './drawio-editor';
import ResizableDivider from './resizable-divider';
import { SaveButton } from './save-button';

const AiChatSidebar = dynamic(() => import('./ai-chat-sidebar'), {
  ssr: false,
});

function download(data: Blob, title: string): void {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = title;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function pngFromSvg(svg: string): Promise<Blob> {
  // draw.io includes an SVG text fallback for each HTML label. Using that
  // fallback avoids Chromium's foreignObject canvas export restriction.
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  for (const element of Array.from(
    parsed.getElementsByTagName('foreignObject')
  ))
    element.remove();
  const rasterSvg = new XMLSerializer().serializeToString(parsed);
  const image = new Image();
  const url = URL.createObjectURL(
    new Blob([rasterSvg], { type: 'image/svg+xml' })
  );
  try {
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG export is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('Could not export PNG')),
        'image/png'
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function NativeDiagramWorkspace({
  flowchartId,
  initialFlowchart,
}: { flowchartId?: string; initialFlowchart?: FlowchartData | null }) {
  const user = useCurrentUser();
  const mobile = useIsMobile();
  const router = useRouter();
  const [fileId, setFileId] = useState(flowchartId);
  const [title, setTitle] = useState(initialFlowchart?.title || 'Untitled');
  const [bridge, setBridge] = useState<DrawioBridge | null>(null);
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(400);
  const [, setHistory] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const initial = useMemo<DrawioDocument>(() => {
    if (initialFlowchart?.content) {
      const parsed = drawioDocumentSchema.safeParse(
        JSON.parse(initialFlowchart.content)
      );
      if (parsed.success) return parsed.data;
    }
    return {
      editorKind: 'drawio',
      formatVersion: 1,
      documentId: crypto.randomUUID(),
      revision: 0,
      diagramType: 'flowchart',
      xml: EMPTY_DRAWIO_XML,
    };
  }, [initialFlowchart?.id]);
  const latestDocument = useRef(initial);
  const [auto, setAuto] = useState<{
    input: string;
    generate: boolean;
    mode: AiAssistantMode;
    image: { base64: string; thumbnail?: string; filename?: string } | null;
  }>({
    input: '',
    generate: false,
    mode: DEFAULT_AI_ASSISTANT_MODE,
    image: null,
  });
  const metadata = useMemo(emptyFlowchartAiMetadata, []);
  const save = useNativeDiagramSave(bridge, fileId, title, setFileId);
  const changeHandler = useRef(save.markChanged);
  changeHandler.current = save.markChanged;
  const currentUser = useRef(user);
  currentUser.current = user;
  const onChange = useCallback((document: DrawioDocument): void => {
    latestDocument.current = document;
    if (currentUser.current) changeHandler.current();
  }, []);
  const onHistory = useCallback(() => setHistory((n) => n + 1), []);
  useEffect(() => {
    const input = localStorage.getItem('flowchart_auto_input') || '';
    const mode =
      localStorage.getItem('flowchart_auto_mode') === 'image_to_flowchart'
        ? 'image_to_flowchart'
        : DEFAULT_AI_ASSISTANT_MODE;
    let image = null;
    try {
      const raw = localStorage.getItem('flowchart_auto_image');
      if (raw) image = JSON.parse(raw);
    } catch {}
    setAuto({
      input,
      mode,
      image,
      generate:
        localStorage.getItem('flowchart_auto_generate') === 'true' &&
        (!!input || !!image),
    });
  }, []);
  const exportDiagram = async (
    format: 'drawio' | 'svg' | 'png'
  ): Promise<void> => {
    if (!bridge) return;
    setExporting(true);
    setExportError(null);
    try {
      if (format === 'drawio')
        download(
          new Blob([bridge.exportNative()], { type: 'application/xml' }),
          `${title}.drawio`
        );
      else {
        const svg = bridge.exportSvg();
        download(
          format === 'svg'
            ? new Blob([svg], { type: 'image/svg+xml' })
            : await pngFromSvg(svg),
          `${title}.${format}`
        );
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <main
        className="flex min-w-0 flex-1 flex-col"
        style={{
          width: open && !mobile ? `calc(100% - ${width}px)` : '100%',
          flex: open && !mobile ? 'none' : 1,
        }}
      >
        <header className="flex min-h-14 flex-wrap items-center gap-2 border-b px-3 py-2">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Home"
            onClick={() => router.push('/')}
          >
            <Home className="h-4 w-4" />
          </Button>
          <Input
            aria-label="Diagram title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (
                user &&
                bridge &&
                (fileId ||
                  readNativeCells(bridge.getDocument()).some(
                    (cell) => cell.parent && cell.parent !== '0'
                  ))
              )
                save.markChanged();
            }}
            className="h-8 min-w-16 max-w-52 flex-1 border-transparent"
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Undo"
            disabled={!bridge?.canUndo()}
            onClick={() => bridge?.undo()}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Redo"
            disabled={!bridge?.canRedo()}
            onClick={() => bridge?.redo()}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!bridge?.canFocusChanges()}
            onClick={() => bridge?.focusChanges()}
          >
            <Crosshair className="h-4 w-4" />
            <span className="hidden sm:inline">Show changes</span>
          </Button>
          {user && (
            <SaveButton
              status={save.status}
              onSave={save.saveNow}
              onRetry={save.retry}
              disabled={!bridge}
              error={save.error}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!bridge || exporting}
              >
                <Download className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void exportDiagram('drawio')}>
                Editable diagram (.drawio)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportDiagram('svg')}>
                SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportDiagram('png')}>
                PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon"
            variant="ghost"
            aria-label={open ? 'Hide assistant' : 'Show assistant'}
            onClick={() => setOpen(!open)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          {user ? (
            <UserButton user={user} />
          ) : (
            <LoginWrapper
              mode="modal"
              asChild
              callbackUrl={fileId ? `/canvas/${fileId}` : '/canvas'}
            >
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4" />
                Sign in
              </Button>
            </LoginWrapper>
          )}
        </header>
        {exportError && (
          <div role="alert" className="px-4 py-2 text-sm text-destructive">
            {exportError}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <DrawioEditor
            initialDocument={latestDocument.current}
            onReady={setBridge}
            onChange={onChange}
            onHistory={onHistory}
          />
        </div>
      </main>
      {open && !mobile && (
        <ResizableDivider
          defaultWidth={width}
          onResize={setWidth}
          minWidth={320}
          maxWidth={600}
        />
      )}
      <AiChatSidebar
        isOpen={open}
        onToggle={() => setOpen(!open)}
        nativeEditor={bridge}
        isAPIReady={!!bridge}
        width={mobile ? undefined : width}
        flowchartId={fileId}
        autoInput={auto.input}
        shouldAutoGenerate={auto.generate}
        initialMode={auto.mode}
        initialImage={auto.image}
        onAutoGenerateComplete={() =>
          setAuto((value) => ({ ...value, generate: false, image: null }))
        }
        flowchartAiMetadata={metadata}
        onFlowchartAiMetadataChange={() => {
          throw new Error('Legacy metadata cannot replace a native document');
        }}
      />
    </div>
  );
}
