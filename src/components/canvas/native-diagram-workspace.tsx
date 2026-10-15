'use client';

import { EVENTS } from '@/analytics/core-goals';
import { trackFlowchartEvent } from '@/analytics/plausible-browser';
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
  type DrawioCommand,
  type DrawioDocument,
  EMPTY_DRAWIO_XML,
  drawioDocumentSchema,
} from '@/lib/drawio/contracts';
import {
  automaticDiagramTitle,
  isUnnamedDiagram,
} from '@/lib/drawio/diagram-title';
import type {
  DrawioBridge,
  NativeEditorView,
} from '@/lib/drawio/editor-bridge';
import { readNativeCells } from '@/lib/drawio/native-document';
import {
  type DiagramTaskStatus,
  taskStatusLabel,
} from '@/lib/mastra/task-status';
import {
  Crosshair,
  Download,
  Hand,
  Home,
  Loader2,
  Map,
  MessageSquare,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PanelRight,
  Plus,
  Redo2,
  Shapes,
  Type,
  Undo2,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DrawioEditor from './drawio-editor';
import NativeStylePanel from './native-style-panel';
import styles from './native-workspace.module.css';
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
  const currentTitle = useRef(title);
  currentTitle.current = title;
  const userNamedTitle = useRef(!isUnnamedDiagram(title));
  const [bridge, setBridge] = useState<DrawioBridge | null>(null);
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(320);
  const [panelTab, setPanelTab] = useState<'ai' | 'style'>('ai');
  const [view, setView] = useState<NativeEditorView>({
    zoom: 1,
    shapesVisible: true,
    panning: false,
    selection: [],
  });
  const [task, setTask] = useState<DiagramTaskStatus>({
    active: false,
    phase: 'idle',
    startedAt: null,
    outcome: 'ready',
  });
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
  const onDiagramTitle = useCallback(
    (suggested: string, operation: DrawioCommand['operation']): void => {
      const next = automaticDiagramTitle(
        currentTitle.current,
        suggested,
        operation,
        userNamedTitle.current
      );
      if (!next) return;
      currentTitle.current = next;
      setTitle(next);
      if (currentUser.current) changeHandler.current();
    },
    []
  );
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
    if (
      readNativeCells(bridge.getDocument()).some(
        (cell) => cell.parent && cell.parent !== '0'
      )
    )
      trackFlowchartEvent(EVENTS.downloadClicked, { editor: 'drawio', format });
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
      setExportError(
        error instanceof Error ? error.message : 'Download failed'
      );
    } finally {
      setExporting(false);
    }
  };
  const zoomPercent = Math.round(view.zoom * 100);
  const selectionLabel =
    view.selection.length > 1
      ? `${view.selection.length} objects`
      : view.selection[0]?.label ||
        (view.selection.length ? 'Selected object' : 'Whole diagram');
  const tabs = (
    <div
      className="flex h-10 items-center gap-1 border-l px-3"
      role="tablist"
      aria-label="Editing panel"
    >
      <button
        type="button"
        role="tab"
        id="native-ai-tab"
        aria-controls="native-ai-panel"
        aria-selected={panelTab === 'ai'}
        className={`h-10 border-b-2 px-3 ${panelTab === 'ai' ? 'border-primary text-primary' : 'border-transparent'}`}
        onClick={() => {
          setPanelTab('ai');
          setOpen(true);
        }}
      >
        AI
        {task.active && (
          <Loader2
            className="ml-1 inline h-3 w-3 animate-spin"
            aria-hidden="true"
          />
        )}
      </button>
      <button
        type="button"
        role="tab"
        id="native-style-tab"
        aria-controls="native-style-panel"
        aria-selected={panelTab === 'style'}
        className={`h-10 border-b-2 px-3 ${panelTab === 'style' ? 'border-primary text-primary' : 'border-transparent'}`}
        onClick={() => {
          setPanelTab('style');
          setOpen(true);
        }}
      >
        Style
      </button>
    </div>
  );
  return (
    <div
      className={`${styles.workspace} flex h-screen w-screen flex-col overflow-hidden bg-muted text-foreground`}
      data-native-workspace
    >
      <header className="flex min-h-12 flex-wrap items-center gap-2 border-b px-3 py-1.5">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Home"
          className="h-8 w-8"
          onClick={() => router.push('/')}
        >
          <Home className="h-4 w-4" />
        </Button>
        <span className="hidden font-medium sm:inline">FlowchartAI</span>
        <span className="hidden h-4 border-l sm:block" />
        <Input
          aria-label="Diagram title"
          value={title}
          onChange={(event) => {
            userNamedTitle.current = true;
            currentTitle.current = event.target.value;
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
          className="h-8 min-w-20 max-w-64 flex-1 border-transparent bg-transparent"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Undo"
            className="h-8 w-8"
            disabled={!bridge?.canUndo()}
            onClick={() => bridge?.undo()}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Redo"
            className="h-8 w-8"
            disabled={!bridge?.canRedo()}
            onClick={() => bridge?.redo()}
          >
            <Redo2 className="h-4 w-4" />
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
              <Button variant="ghost" size="sm" disabled={!bridge || exporting}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
                <span className="sr-only sm:hidden">Download</span>
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
            className="h-8 w-8"
            aria-label={open ? 'Hide editing panel' : 'Show editing panel'}
            title={task.active ? taskStatusLabel(task) : 'Editing panel'}
            onClick={() => {
              if (!open && task.active) setPanelTab('ai');
              setOpen(!open);
            }}
          >
            {task.active ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
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
        </div>
      </header>
      {exportError && (
        <div
          role="alert"
          className="border-b px-4 py-2 text-sm text-destructive"
        >
          {exportError}
        </div>
      )}
      <div className="flex min-h-10 flex-wrap items-center border-b">
        <nav
          className="flex min-w-0 flex-1 items-center gap-1 px-2"
          aria-label="Drawing tools"
        >
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 ${!view.panning ? 'bg-accent' : ''}`}
            aria-label="Select objects"
            disabled={!bridge}
            onClick={() => bridge?.setPanning(false)}
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 ${view.panning ? 'bg-accent' : ''}`}
            aria-label="Pan canvas"
            title="Pan canvas · Space + drag"
            disabled={!bridge}
            onClick={() => bridge?.setPanning(true)}
          >
            <Hand className="h-4 w-4" />
          </Button>
          <span className="mx-1 h-4 border-l" />
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={view.shapesVisible}
            disabled={!bridge}
            onClick={() => bridge?.toggleShapes()}
          >
            <Shapes className="h-4 w-4" />
            Shapes
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Insert text"
            disabled={!bridge}
            onClick={() => bridge?.runAction('insertText')}
          >
            <Type className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="More drawing tools"
                disabled={!bridge}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => bridge?.runAction('outline')}>
                <Map className="h-4 w-4" />
                Diagram overview
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!view.selection.length}
                onClick={() => bridge?.focusSelection()}
              >
                <Crosshair className="h-4 w-4" />
                Focus selection
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!bridge?.canFocusChanges()}
                onClick={() => bridge?.focusChanges()}
              >
                <Crosshair className="h-4 w-4" />
                View changes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => bridge?.runAction('insertPage')}>
                <Plus className="h-4 w-4" />
                Add page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        {open && (
          <div
            className="shrink-0"
            style={{ width: mobile ? undefined : width }}
          >
            {tabs}
          </div>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 bg-background">
            <DrawioEditor
              initialDocument={latestDocument.current}
              onReady={setBridge}
              onChange={onChange}
              onHistory={onHistory}
              onView={setView}
            />
          </div>
        </main>
        {open && !mobile && (
          <ResizableDivider
            defaultWidth={width}
            onResize={setWidth}
            minWidth={280}
            maxWidth={480}
          />
        )}
        <aside
          className={
            mobile
              ? `absolute inset-y-0 right-0 z-20 flex w-[min(100%,360px)] flex-col border-l bg-muted ${open ? '' : 'hidden'}`
              : `flex shrink-0 flex-col bg-muted ${open ? '' : 'hidden'}`
          }
          style={mobile ? undefined : { width }}
          aria-label="Editing panel"
        >
          {view.selection.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
              <span className="text-muted-foreground">Selected</span>
              <button
                type="button"
                className="max-w-48 truncate text-left"
                onClick={() => bridge?.focusSelection()}
                title={`Focus selection: ${selectionLabel}`}
              >
                {selectionLabel}
              </button>
            </div>
          )}
          <div
            className={`min-h-0 flex-1 ${panelTab === 'ai' ? '' : 'hidden'}`}
            id="native-ai-panel"
            role="tabpanel"
            aria-labelledby="native-ai-tab"
          >
            <AiChatSidebar
              embedded
              isOpen={open && panelTab === 'ai'}
              onToggle={() => setOpen(!open)}
              nativeEditor={bridge}
              isAPIReady={!!bridge}
              width={width}
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
                throw new Error(
                  'Legacy metadata cannot replace a native document'
                );
              }}
              onTaskStatusChange={setTask}
              onDiagramTitle={onDiagramTitle}
              onPersistDiagram={save.ensureSaved}
              onFocusChanges={() => bridge?.focusChanges()}
            />
          </div>
          <div
            className={`min-h-0 flex-1 overflow-y-auto ${panelTab === 'style' ? '' : 'hidden'}`}
            id="native-style-panel"
            role="tabpanel"
            aria-labelledby="native-style-tab"
          >
            <NativeStylePanel bridge={bridge} view={view} />
          </div>
        </aside>
      </div>
      <footer className="flex min-h-9 shrink-0 items-center gap-1 border-t px-2 text-xs text-muted-foreground">
        <div className="mr-auto" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Zoom out"
          disabled={!bridge}
          onClick={() => bridge?.zoom(view.zoom / 1.2)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <select
          aria-label="Zoom level"
          title="Zoom · Alt + wheel"
          className="h-8 shrink-0 rounded-sm border-transparent bg-transparent px-1"
          value={zoomPercent}
          disabled={!bridge}
          onChange={(event) => bridge?.zoom(Number(event.target.value) / 100)}
        >
          {Array.from(
            new Set([25, 50, 75, 100, 125, 150, 200, 300, zoomPercent])
          )
            .sort((a, b) => a - b)
            .map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Zoom in"
          disabled={!bridge}
          onClick={() => bridge?.zoom(view.zoom * 1.2)}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={!bridge}
          onClick={() => bridge?.fitDiagram()}
        >
          Fit diagram
        </Button>
      </footer>
    </div>
  );
}
