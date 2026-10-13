/**
 * [INPUT] Native XML, the current revision and explicit field-level operations.
 * [OUTPUT] Validated XML and an atomic next document; never mutates the input.
 * [POS] Shared browser/server engine preserving native geometry and grouping.
 * [UPDATE] Sync contracts, Agent instructions, bridge and FOLDER_INDEX.
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import {
  type DrawioDocument,
  type DrawioPatch,
  drawioDocumentSchema,
  drawioPatchSchema,
} from './contracts';

type XmlDocument = ReturnType<DOMParser['parseFromString']>;
type XmlElement = NonNullable<XmlDocument['documentElement']>;
interface CellRecord {
  element: XmlElement;
  cell: XmlElement;
  id: string;
}

function parseXml(xml: string): XmlDocument {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('XML entity declarations are not supported');
  return new DOMParser({
    onError: (_level, message) => {
      throw new Error(`Invalid XML: ${message}`);
    },
  }).parseFromString(xml, 'text/xml');
}

function elements(parent: XmlElement): XmlElement[] {
  return Array.from(parent.childNodes).filter(
    (node) => node.nodeType === 1
  ) as XmlElement[];
}

function cellRecord(element: XmlElement): CellRecord {
  const cell =
    element.tagName === 'mxCell'
      ? element
      : elements(element).find((node) => node.tagName === 'mxCell');
  if (!cell) throw new Error('Expected an mxCell or wrapped mxCell');
  const id = element.getAttribute('id') || cell.getAttribute('id');
  if (!id) throw new Error('Every cell requires a stable ID');
  return { element, cell, id };
}

function cellMap(root: XmlElement): Map<string, CellRecord> {
  const map = new Map<string, CellRecord>();
  for (const node of elements(root)) {
    const record = cellRecord(node);
    if (map.has(record.id)) throw new Error(`Duplicate cell ID: ${record.id}`);
    map.set(record.id, record);
  }
  return map;
}

function graphRoot(model: XmlElement): XmlElement {
  const root = elements(model).find((node) => node.tagName === 'root');
  if (!root) throw new Error('Native diagram requires an mxGraphModel root');
  return root;
}

function models(document: XmlDocument): XmlElement[] {
  const root = document.documentElement;
  if (!root || !['mxGraphModel', 'mxfile'].includes(root.tagName))
    throw new Error('Expected native mxGraphModel or uncompressed mxfile');
  const result = Array.from(document.getElementsByTagName('mxGraphModel'));
  if (!result.length)
    throw new Error(
      'Compressed or empty native diagram; expand XML before editing'
    );
  return result;
}

function activeModel(document: XmlDocument, pageId?: string): XmlElement {
  const all = models(document);
  if (all.length === 1 && all[0].parentNode?.nodeType === 9) return all[0];
  if (pageId) {
    const selected = all.find(
      (model) =>
        (model.parentNode as XmlElement)?.getAttribute?.('id') === pageId
    );
    if (!selected) throw new Error('Active page is missing');
    return selected;
  }
  if (all.length > 1) throw new Error('Select one page before editing');
  return all[0];
}

function validateModel(model: XmlElement): void {
  const cells = cellMap(graphRoot(model));
  if (!cells.has('0')) throw new Error('Missing graph root reference');
  for (const { cell, id } of cells.values()) {
    for (const key of ['parent', 'source', 'target']) {
      const reference = cell.getAttribute(key);
      if (reference && !cells.has(reference))
        throw new Error(`Missing ${key} reference ${reference} for ${id}`);
    }
    const ancestors = new Set<string>([id]);
    let parent = cell.getAttribute('parent');
    while (parent) {
      if (ancestors.has(parent)) throw new Error(`Parent cycle at ${id}`);
      ancestors.add(parent);
      parent = cells.get(parent)?.cell.getAttribute('parent') || null;
    }
    const geometry = elements(cell).find(
      (node) => node.tagName === 'mxGeometry'
    );
    if (
      (cell.getAttribute('vertex') === '1' ||
        cell.getAttribute('edge') === '1') &&
      (!geometry || geometry.getAttribute('as') !== 'geometry')
    ) {
      throw new Error(
        `Cell ${id} requires an mxGeometry child with as=geometry; geometry attributes are not supported`
      );
    }
    if (geometry)
      for (const key of ['x', 'y', 'width', 'height']) {
        if (!geometry.hasAttribute(key)) continue;
        const value = geometry.getAttribute(key) || '';
        if (
          !value.trim() ||
          !Number.isFinite(Number(value)) ||
          (['width', 'height'].includes(key) && Number(value) < 0)
        )
          throw new Error(`Invalid ${key} geometry on ${id}`);
      }
  }
}

function serialize(document: XmlDocument): string {
  return new XMLSerializer().serializeToString(document);
}

export interface NativeCellSummary {
  id: string;
  value: string;
  parent: string;
  source?: string;
  target?: string;
  style: string;
  geometry: Record<string, string>;
}

export function readNativeCells(document: DrawioDocument): NativeCellSummary[] {
  const parsed = parseXml(document.xml);
  const cells = cellMap(graphRoot(activeModel(parsed, document.pageId)));
  return [...cells.values()].map(({ cell, element, id }) => {
    const geom = elements(cell).find((node) => node.tagName === 'mxGeometry');
    const geometry: Record<string, string> = {};
    if (geom)
      for (const attribute of Array.from(geom.attributes))
        geometry[attribute.name] = attribute.value;
    return {
      id,
      value:
        element !== cell
          ? element.getAttribute('label') || cell.getAttribute('value') || ''
          : cell.getAttribute('value') || '',
      parent: cell.getAttribute('parent') || '',
      source: cell.getAttribute('source') || undefined,
      target: cell.getAttribute('target') || undefined,
      style: cell.getAttribute('style') || '',
      geometry,
    };
  });
}

function mergeStyle(
  current: string,
  changes: Record<string, string>,
  remove: string[]
): string {
  const named: string[] = [];
  const values = new Map<string, string>();
  for (const part of current.split(';').filter(Boolean)) {
    const at = part.indexOf('=');
    if (at < 0) named.push(part);
    else values.set(part.slice(0, at), part.slice(at + 1));
  }
  for (const key of remove) values.delete(key);
  for (const [key, value] of Object.entries(changes)) {
    if (/[;=]/.test(key) || value.includes(';'))
      throw new Error('Style changes must contain individual keys and values');
    values.set(key, value);
  }
  return (
    [...named, ...[...values].map(([key, value]) => `${key}=${value}`)].join(
      ';'
    ) + ';'
  );
}

export function applyDrawioPatch(
  document: DrawioDocument,
  input: DrawioPatch
): DrawioDocument {
  const current = drawioDocumentSchema.parse(document);
  const patch = drawioPatchSchema.parse(input);
  if (patch.baseRevision !== current.revision)
    throw new Error(
      'Diagram revision changed; read the current diagram and retry'
    );
  validateDrawioXml(current.xml, current.pageId);
  const parsed = parseXml(current.xml);
  const root = graphRoot(activeModel(parsed, current.pageId));
  for (const op of patch.operations) {
    const cells = cellMap(root);
    if (op.type === 'addCell') {
      const fragment = parseXml(op.xml);
      const element = fragment.documentElement;
      if (
        !element ||
        !['mxCell', 'object', 'UserObject'].includes(element.tagName)
      )
        throw new Error('addCell requires exactly one native cell');
      const record = cellRecord(element);
      if (cells.has(record.id))
        throw new Error(`Duplicate cell ID: ${record.id}`);
      root.appendChild(parsed.importNode(element, true));
      continue;
    }
    if (op.id === '0' || op.id === '1')
      throw new Error(
        'Graph root/layer cannot be removed or edited by the assistant'
      );
    const record = cells.get(op.id);
    if (!record) throw new Error(`Cell reference ${op.id} is missing`);
    if (op.type === 'removeCell') {
      root.removeChild(record.element);
      continue;
    }
    const { cell, element } = record;
    const changes = op.changes;
    if (changes.value !== undefined)
      (element !== cell ? element : cell).setAttribute(
        element !== cell ? 'label' : 'value',
        changes.value
      );
    if (changes.style || changes.removeStyleKeys)
      cell.setAttribute(
        'style',
        mergeStyle(
          cell.getAttribute('style') || '',
          changes.style || {},
          changes.removeStyleKeys || []
        )
      );
    for (const key of ['parent', 'source', 'target'] as const)
      if (changes[key] !== undefined) cell.setAttribute(key, changes[key]);
    if (changes.geometry || changes.points) {
      let geometry = elements(cell).find(
        (node) => node.tagName === 'mxGeometry'
      );
      if (!geometry) {
        geometry = parsed.createElement('mxGeometry');
        geometry.setAttribute('as', 'geometry');
        cell.appendChild(geometry);
      }
      for (const [key, value] of Object.entries(changes.geometry || {}))
        geometry.setAttribute(key, String(value));
      if (changes.points) {
        for (const child of elements(geometry))
          if (child.getAttribute('as') === 'points')
            geometry.removeChild(child);
        const points = parsed.createElement('Array');
        points.setAttribute('as', 'points');
        for (const point of changes.points) {
          const node = parsed.createElement('mxPoint');
          node.setAttribute('x', String(point.x));
          node.setAttribute('y', String(point.y));
          points.appendChild(node);
        }
        geometry.appendChild(points);
      }
    }
  }
  const xml = validateDrawioXml(serialize(parsed), current.pageId);
  return { ...current, xml, revision: current.revision + 1 };
}

export function validateDrawioXml(xml: string, pageId?: string): string {
  const parsed = parseXml(xml);
  for (const model of models(parsed)) validateModel(model);
  if (pageId) activeModel(parsed, pageId);
  return serialize(parsed);
}

export function nativeContentFingerprint(xml: string): string {
  const parsed = parseXml(xml);
  for (const model of models(parsed))
    for (const key of ['dx', 'dy']) model.removeAttribute(key);
  if (parsed.documentElement?.tagName === 'mxfile')
    for (const key of ['modified', 'agent', 'host', 'version', 'etag'])
      parsed.documentElement.removeAttribute(key);
  return serialize(parsed);
}

export function chooseCanvasEditor(
  content?: string | null
): 'drawio' | 'excalidraw' | 'invalid' {
  if (!content) return 'drawio';
  try {
    const parsed = JSON.parse(content);
    if (parsed.editorKind === 'drawio') {
      const native = drawioDocumentSchema.parse(parsed);
      validateDrawioXml(native.xml, native.pageId);
      return 'drawio';
    }
    if (Array.isArray(parsed.elements)) {
      const metadata = parsed.flowchartAi;
      const hasDiagrams =
        metadata &&
        [metadata.diagrams, metadata.mermaidDiagrams].some(
          (value) => value && Object.keys(value).length
        );
      return parsed.elements.length ||
        Object.keys(parsed.files || {}).length ||
        hasDiagrams
        ? 'excalidraw'
        : 'drawio';
    }
    return 'invalid';
  } catch {
    return 'invalid';
  }
}
