/**
 * [INPUT] Current native document or legacy scene after a canvas action.
 * [OUTPUT] Whether the canvas contains actual exportable content.
 * [POS] Keep empty/deleted-only canvases out of ready/download Goals.
 * [UPDATE] Sync editor event hooks and empty-scene tests after changes.
 */
import type { DrawioDocument } from '../lib/drawio/contracts';
import { readNativeCells } from '../lib/drawio/native-document';

export function hasNativeExportContent(document?: DrawioDocument): boolean {
  try {
    return (
      !!document &&
      readNativeCells(document).some(
        (cell) => cell.parent && cell.parent !== '0'
      )
    );
  } catch {
    return false;
  }
}

export function hasLiveSceneContent(
  elements: readonly { isDeleted?: boolean }[] = []
): boolean {
  return elements.some((element) => !element.isDeleted);
}
