/**
 * [INPUT] Pinned same-origin EditorUi and validated native transactions.
 * [OUTPUT] Current XML/selection, one-step edits and reversible browser history.
 * [POS] Only module touching draw.io internal objects; version is pinned.
 * [UPDATE] Revalidate this bridge when changing drawio-version.json.
 */
import { prepareDrawioCommand } from './command';
import type {
  DrawioCommand,
  DrawioDocument,
  NativeEditorController,
} from './contracts';
import { nativeContentFingerprint, validateDrawioXml } from './native-document';

export interface NativeEditorView {
  zoom: number;
  shapesVisible: boolean;
  panning: boolean;
  selection: Array<{
    id: string;
    label: string;
    style: Record<string, string>;
  }>;
}

export interface DrawioBridge extends NativeEditorController {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  exportNative: () => string;
  exportSvg: () => string;
  focusChanges: () => void;
  canFocusChanges: () => boolean;
  getView: () => NativeEditorView;
  zoom: (scale: number) => void;
  fitDiagram: () => void;
  focusSelection: () => void;
  toggleShapes: () => void;
  setPanning: (enabled: boolean) => void;
  runAction: (name: string) => void;
  setSelectedStyle: (key: string, value: string) => void;
  setSelectedLabel: (value: string, cellId?: string) => void;
  dispose: () => void;
}

export function watchDrawioEditor(
  frame: Window,
  found: (ui: any) => void
): () => void {
  const win = frame as any;
  const restores: (() => void)[] = [];
  for (const [prototype, name] of [
    [win.EditorUi?.prototype, 'updateActionStates'],
    [win.App?.prototype, 'fileLoaded'],
    [win.EditorUi?.prototype, 'fileLoaded'],
  ] as const) {
    if (!prototype || typeof prototype[name] !== 'function') continue;
    const original = prototype[name];
    const wrapped = function (this: any, ...args: unknown[]) {
      win.__flowchartEditorUi = this;
      found(this);
      return original.apply(this, args);
    };
    prototype[name] = wrapped;
    restores.push(() => {
      if (prototype[name] === wrapped) prototype[name] = original;
    });
  }
  if (win.__flowchartEditorUi) found(win.__flowchartEditorUi);
  return () => restores.forEach((restore) => restore());
}

export function createDrawioBridge(
  ui: any,
  frame: Window,
  initial: DrawioDocument,
  onChange: (document: DrawioDocument) => void,
  onHistory: () => void,
  onView: (view: NativeEditorView) => void = () => {}
): DrawioBridge {
  const win = frame as any;
  const graph = ui?.editor?.graph;
  if (
    !graph ||
    typeof win.ReplaceDiagram !== 'function' ||
    typeof ui.getXmlFileData !== 'function'
  )
    throw new Error(
      'This editor version cannot apply reversible diagram changes'
    );
  let document = { ...initial };
  let disposed = false;
  let applying = false;
  const committed = new Set<string>();
  let changedIds: string[] = [];
  const listeners: { source: any; fn: () => void }[] = [];
  const capture = (): DrawioDocument => {
    const xml = win.mxUtils.getXml(ui.getXmlFileData(null, null, true));
    const pageId = ui.currentPage?.getId?.();
    return {
      ...document,
      xml,
      pageId: pageId == null ? undefined : String(pageId),
    };
  };
  // Hydration establishes a baseline, not an undo step or autosave mutation.
  document = capture();
  ui.editor.undoManager.clear();
  if (ui.isFormatPanelVisible?.() || (ui.formatWidth ?? 0) > 0)
    ui.actions.get('format')?.funct();
  const sync = (): void => {
    if (disposed || applying) return;
    const next = capture();
    if (
      nativeContentFingerprint(next.xml) !==
      nativeContentFingerprint(document.xml)
    ) {
      document = { ...next, revision: document.revision + 1 };
      onChange({ ...document });
    } else document = next;
    onHistory();
  };
  for (const [source, event] of [
    [graph.model, win.mxEvent.CHANGE],
    [ui.editor.undoManager, win.mxEvent.UNDO],
    [ui.editor.undoManager, win.mxEvent.REDO],
    [ui.editor.undoManager, win.mxEvent.ADD],
  ]) {
    if (source?.addListener) {
      source.addListener(event, sync);
      listeners.push({ source, fn: sync });
    }
  }
  const selection = (): string[] =>
    graph.getSelectionCells().map((cell: any) => String(cell.id));
  const getView = (): NativeEditorView => ({
    zoom: graph.view.scale,
    shapesVisible: !!ui.isShapesPanelVisible?.(),
    panning: !!graph.panningHandler.useLeftButtonForPanning,
    selection: graph.getSelectionCells().map((cell: any) => ({
      id: String(cell.id),
      label: String(graph.convertValueToString(cell)),
      style: Object.fromEntries(
        Object.entries(graph.getCellStyle(cell) || {})
          .filter(([key]) =>
            ['fontSize', 'fontColor', 'fillColor', 'strokeColor'].includes(key)
          )
          .map(([key, value]) => [key, String(value)])
      ),
    })),
  });
  const viewChanged = (): void => {
    win.document.documentElement.toggleAttribute(
      'data-flowchart-single-page',
      (ui.pages?.length ?? 1) < 2
    );
    onView(getView());
  };
  for (const [source, event] of [
    [graph.getSelectionModel(), win.mxEvent.CHANGE],
    [graph.view, win.mxEvent.SCALE],
    [graph.view, win.mxEvent.SCALE_AND_TRANSLATE],
    [graph.model, win.mxEvent.CHANGE],
  ]) {
    source.addListener(event, viewChanged);
    listeners.push({ source, fn: viewChanged });
  }
  const fitCells = (cells: any[]): void => {
    if (!cells.length) return;
    const states = cells
      .map((cell: any) => graph.view.getState(cell))
      .filter(Boolean);
    const bounds = states.length
      ? new win.mxRectangle(
          states[0].x,
          states[0].y,
          states[0].width,
          states[0].height
        )
      : null;
    for (const state of states.slice(1))
      bounds.add(
        new win.mxRectangle(state.x, state.y, state.width, state.height)
      );
    if (bounds) {
      const scale = graph.view.scale;
      const t = graph.view.translate;
      graph.fitWindow(
        new win.mxRectangle(
          bounds.x / scale - t.x,
          bounds.y / scale - t.y,
          bounds.width / scale,
          bounds.height / scale
        ),
        40,
        1.25
      );
    }
    viewChanged();
  };
  // The host owns document/tool chrome. Keep native canvas, page tabs and shapes.
  const chrome = win.document.createElement('style');
  chrome.textContent = `
    .geMenubarContainer,.geToolbarContainer { display:none!important; }
    .geDiagramContainer,.geSidebarContainer,.geHsplit { top:0!important; }
    [data-flowchart-single-page] .geTabContainer { display:none!important; }
    [data-flowchart-single-page] .geDiagramContainer { bottom:0!important; }
    .geSidebarContainer,.geSidebar,.geSidebarFooter,.geFooterContainer,.geTabContainer {
      background: var(--flowchart-chrome)!important;
      color: var(--flowchart-foreground)!important;
      font-family: var(--flowchart-font)!important;
    }
  `;
  win.document.head.appendChild(chrome);
  const syncChrome = (): void => {
    const host = win.parent.document;
    const tokens = win.parent.getComputedStyle(host.documentElement);
    win.document.documentElement.style.setProperty(
      '--flowchart-chrome',
      tokens.getPropertyValue('--muted')
    );
    win.document.documentElement.style.setProperty(
      '--flowchart-foreground',
      tokens.getPropertyValue('--foreground')
    );
    win.document.documentElement.style.setProperty(
      '--flowchart-font',
      win.parent.getComputedStyle(host.body).fontFamily
    );
    ui.setDarkMode(host.documentElement.classList.contains('dark'));
  };
  syncChrome();
  const themeObserver = new win.MutationObserver(syncChrome);
  themeObserver.observe(win.parent.document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  if (!ui.isShapesPanelVisible?.()) ui.actions.get('toggleShapes')?.funct();
  viewChanged();
  return {
    getDocument: () => {
      sync();
      return { ...document };
    },
    getSelection: selection,
    async applyCommand(command: DrawioCommand): Promise<void> {
      if (disposed) throw new Error('Editor is no longer available');
      if (committed.has(command.commandId))
        throw new Error('This edit was already applied');
      sync();
      const candidate = prepareDrawioCommand(document, command);
      const parsed = win.mxUtils.parseXml(candidate.xml);
      const models = Array.from(
        parsed.getElementsByTagName('mxGraphModel')
      ) as Element[];
      const model =
        models.length === 1
          ? models[0]
          : models.find(
              (node) =>
                (node.parentNode as Element)?.getAttribute('id') ===
                document.pageId
            );
      if (!model) throw new Error('The current page cannot be changed');
      const selected = selection();
      const viewport = {
        scale: graph.view.scale,
        x: graph.view.translate.x,
        y: graph.view.translate.y,
        left: graph.container.scrollLeft,
        top: graph.container.scrollTop,
      };
      // ReplaceDiagram records the before/after XML as one native undo change.
      // Plain setGraphXml/replaceDiagramData does not provide this history.
      const before = { ...document };
      const manager = ui.editor.undoManager;
      const history = [...manager.history];
      const historyIndex = manager.indexOfNextAdd;
      applying = true;
      try {
        graph.model.beginUpdate();
        try {
          graph.model.execute(new win.ReplaceDiagram(ui, model));
        } finally {
          graph.model.endUpdate();
        }
        const next = {
          ...capture(),
          revision: candidate.revision,
          diagramType: candidate.diagramType,
        };
        validateDrawioXml(next.xml, next.pageId);
        document = next;
      } catch (error) {
        const old = win.mxUtils.parseXml(before.xml);
        const oldModel = Array.from(
          old.getElementsByTagName('mxGraphModel')
        ).find(
          (node: any) =>
            !before.pageId ||
            node.parentNode?.getAttribute?.('id') === before.pageId
        );
        ui.editor.setGraphXml(oldModel);
        manager.history = history;
        manager.indexOfNextAdd = historyIndex;
        document = before;
        graph.view.scaleAndTranslate(viewport.scale, viewport.x, viewport.y);
        graph.container.scrollLeft = viewport.left;
        graph.container.scrollTop = viewport.top;
        onHistory();
        throw error;
      } finally {
        applying = false;
      }
      committed.add(command.commandId);
      changedIds =
        command.operation === 'patch'
          ? command.patch!.operations.flatMap((operation) =>
              operation.type === 'addCell'
                ? Array.from(
                    win.mxUtils
                      .parseXml(operation.xml)
                      .getElementsByTagName('mxCell')
                  ).map((cell: any) => cell.getAttribute('id'))
                : operation.type === 'updateCell'
                  ? [operation.id]
                  : []
            )
          : Object.values(graph.model.cells)
              .filter((cell: any) => cell.vertex && !cell.children?.length)
              .map((cell: any) => String(cell.id));
      graph.setSelectionCells(
        selected.map((id) => graph.model.getCell(id)).filter(Boolean)
      );
      if (command.operation !== 'patch') ui.actions.get('fitWindow')?.funct();
      else {
        graph.view.scaleAndTranslate(viewport.scale, viewport.x, viewport.y);
        graph.container.scrollLeft = viewport.left;
        graph.container.scrollTop = viewport.top;
      }
      onChange({ ...document });
      onHistory();
    },
    undo: () => {
      ui.editor.undoManager.undo();
      sync();
    },
    redo: () => {
      ui.editor.undoManager.redo();
      sync();
    },
    canUndo: () => ui.editor.undoManager.canUndo(),
    canRedo: () => ui.editor.undoManager.canRedo(),
    exportNative: () => capture().xml,
    exportSvg: () => win.mxUtils.getXml(graph.getSvg(null, 1, 0)),
    canFocusChanges: () => changedIds.length > 0,
    focusChanges: () => {
      const cell = changedIds
        .map((id) => graph.model.getCell(id))
        .find((cell) => cell?.vertex && !cell.children?.length);
      if (!cell) return;
      if (graph.view.scale < 1) graph.zoomTo(1);
      graph.setSelectionCell(cell);
      graph.scrollCellToVisible(cell, true);
      const highlight = new win.mxCellHighlight(graph, '#2563eb', 3);
      highlight.highlight(graph.view.getState(cell));
      win.setTimeout(() => highlight.destroy(), 4000);
    },
    getView,
    zoom: (scale) => {
      graph.zoomTo(scale);
      viewChanged();
    },
    fitDiagram: () => {
      ui.fitDiagramToWindow(1, null, false);
      viewChanged();
    },
    focusSelection: () => fitCells(graph.getSelectionCells()),
    toggleShapes: () => {
      ui.actions.get('toggleShapes')?.funct();
      viewChanged();
    },
    setPanning: (enabled) => {
      graph.panningHandler.useLeftButtonForPanning = enabled;
      graph.panningHandler.ignoreCell = enabled;
      graph.container.style.cursor = enabled ? 'grab' : '';
      viewChanged();
    },
    runAction: (name) => {
      ui.actions.get(name)?.funct();
      viewChanged();
    },
    setSelectedStyle: (key, value) => {
      const cells = graph.getSelectionCells();
      if (!cells.length) return;
      graph.model.beginUpdate();
      try {
        graph.setCellStyles(key, value, cells);
      } finally {
        graph.model.endUpdate();
      }
    },
    setSelectedLabel: (value, cellId) => {
      const cell = cellId
        ? graph.model.getCell(cellId)
        : graph.getSelectionCell();
      if (cell) graph.cellLabelChanged(cell, value);
    },
    dispose: () => {
      disposed = true;
      chrome.remove();
      win.document.documentElement.removeAttribute(
        'data-flowchart-single-page'
      );
      themeObserver.disconnect();
      for (const { source, fn } of listeners) source.removeListener(fn);
    },
  };
}
