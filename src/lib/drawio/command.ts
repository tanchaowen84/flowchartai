/**
 * [INPUT] Validated command and the latest native document.
 * [OUTPUT] An atomic candidate document or a recoverable error.
 * [POS] Shared preparation boundary; browser commit happens separately.
 * [UPDATE] Sync native contracts, Agent tool and bridge.
 */
import {
  type DrawioCommand,
  type DrawioDocument,
  drawioCommandSchema,
} from './contracts';
import {
  applyDrawioPatch,
  readNativeCells,
  validateDrawioXml,
} from './native-document';

export function prepareDrawioCommand(
  current: DrawioDocument,
  input: DrawioCommand
): DrawioDocument {
  const command = drawioCommandSchema.parse(input);
  if (command.documentId !== current.documentId)
    throw new Error('Diagram target changed; read the current document');
  if (command.baseRevision !== current.revision)
    throw new Error(
      'Diagram revision changed; read the current diagram and retry'
    );
  if (command.pageId !== current.pageId)
    throw new Error('Page changed; read the current page before editing');
  if (command.operation === 'patch') {
    if (!command.patch || command.patch.baseRevision !== command.baseRevision)
      throw new Error('Patch requires the current baseRevision');
    return applyDrawioPatch(current, command.patch);
  }
  if (
    command.operation === 'create' &&
    readNativeCells(current).some((cell) => cell.parent && cell.parent !== '0')
  )
    throw new Error(
      'The diagram is not empty; use a patch or an explicit rebuild'
    );
  if (!command.xml) throw new Error('Create/rebuild requires native XML');
  return {
    ...current,
    xml: validateDrawioXml(command.xml),
    diagramType: command.diagramType,
    pageId: undefined,
    revision: current.revision + 1,
  };
}
