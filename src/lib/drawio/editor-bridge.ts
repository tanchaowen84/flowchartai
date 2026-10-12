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

export interface DrawioBridge extends NativeEditorController {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  exportNative: () => string;
  exportSvg: () => string;
  focusChanges: () => void;
  canFocusChanges: () => boolean;
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
  onHistory: () => void
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
      const candidate = prepareDrawioCommand(document, command, selection());
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
      if (graph.view.scale < 0.6) graph.zoomTo(0.6);
      graph.scrollCellToVisible(cell, true);
      const highlight = new win.mxCellHighlight(graph, '#2563eb', 3);
      highlight.highlight(graph.view.getState(cell));
      win.setTimeout(() => highlight.destroy(), 4000);
    },
    dispose: () => {
      disposed = true;
      for (const { source, fn } of listeners) source.removeListener(fn);
    },
  };
}
