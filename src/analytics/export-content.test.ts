import { describe, expect, it } from 'vitest';
import { EMPTY_DRAWIO_XML } from '../lib/drawio/contracts';
import { hasLiveSceneContent, hasNativeExportContent } from './export-content';

const blank = {
  editorKind: 'drawio' as const,
  formatVersion: 1 as const,
  xml: EMPTY_DRAWIO_XML,
  revision: 0,
  documentId: 'qa',
  diagramType: 'flowchart',
};

describe('exportable canvas milestones', () => {
  it('does not count a blank native document or a missing editor as ready', () => {
    expect(hasNativeExportContent()).toBe(false);
    expect(hasNativeExportContent(blank)).toBe(false);
  });
  it('counts an actual native diagram object', () => {
    expect(
      hasNativeExportContent({
        ...blank,
        xml: EMPTY_DRAWIO_XML.replace(
          '</root>',
          '<mxCell id="node" parent="1" vertex="1" value="A"><mxGeometry x="10" y="10" width="100" height="40" as="geometry"/></mxCell></root>'
        ),
        revision: 1,
      })
    ).toBe(true);
  });
  it('does not count empty or deleted-only legacy scenes', () => {
    expect(hasLiveSceneContent()).toBe(false);
    expect(hasLiveSceneContent([{ isDeleted: true }])).toBe(false);
  });
  it('counts remaining content after a partial deletion', () => {
    expect(
      hasLiveSceneContent([{ isDeleted: true }, { isDeleted: false }])
    ).toBe(true);
  });
});
