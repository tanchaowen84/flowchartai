import { expect, it } from 'vitest';
import {
  type DrawioCommand,
  type DrawioDocument,
  EMPTY_DRAWIO_XML,
} from './contracts';
import { assertVisibleAdditions } from './visible-additions';
const document: DrawioDocument = {
  editorKind: 'drawio',
  formatVersion: 1,
  documentId: 'visible-test',
  revision: 1,
  diagramType: 'flowchart',
  xml: EMPTY_DRAWIO_XML.replace(
    '</root>',
    '<mxCell id="activate" value="Activate account" vertex="1" parent="1"><mxGeometry x="220" y="490" width="180" height="56" as="geometry"/></mxCell></root>'
  ),
};
function patch(style: string, x = 220): DrawioCommand {
  return {
    kind: 'drawio-command',
    commandId: 'patch',
    documentId: document.documentId,
    baseRevision: 1,
    operation: 'patch',
    diagramType: 'flowchart',
    description: 'Add a welcome step',
    patch: {
      baseRevision: 1,
      operations: [
        {
          type: 'addCell',
          xml: `<mxCell id="welcome" value="Send welcome email" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="490" width="180" height="56" as="geometry"/></mxCell>`,
        },
      ],
    },
  };
}
it('rejects a new process that hides an existing process before a tool succeeds', () => {
  expect(() => assertVisibleAdditions(document, patch('rounded=1;'))).toThrow(
    /overlap/
  );
});
it('allows separate new steps and intentional text or container layers', () => {
  expect(() =>
    assertVisibleAdditions(document, patch('rounded=1;', 450))
  ).not.toThrow();
  expect(() =>
    assertVisibleAdditions(document, patch('text;html=1;'))
  ).not.toThrow();
  expect(() =>
    assertVisibleAdditions(document, patch('swimlane;container=1;'))
  ).not.toThrow();
});
it('allows a complete correction that moves the previous node away', () => {
  const command = patch('rounded=1;');
  command.patch!.operations.push({
    type: 'updateCell',
    id: 'activate',
    changes: { geometry: { y: 390 } },
  });
  expect(() => assertVisibleAdditions(document, command)).not.toThrow();
});
