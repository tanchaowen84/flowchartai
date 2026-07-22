import {
  type DiagramDocument,
  type DiagramNode,
  diagramDocumentSchema,
} from './contracts';
import {
  PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE,
  canonicalPatchableFlowchartEdgeSemanticId,
  parsePatchableFlowchartNodeStyle,
} from './flowchart-capabilities';

const NODE_DEFINITION_PATTERN = new RegExp(
  `\\b(${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE})\\s*(\\[\\[[^\\]\\n]*\\]\\]|\\[\\([^\\]\\n]*\\)\\]|\\(\\[[^\\]\\n]*\\]\\)|\\(\\([^\\)\\n]*\\)\\)|\\{\\{[^}\\n]*\\}\\}|\\{[^}\\n]*\\}|\\([^\\)\\n]*\\)|\\[[^\\]\\n]*\\])`,
  'g'
);
const FLOWCHART_HEADER_PATTERN = /^(flowchart|graph)\s+(LR|RL|TD|BT)\s*$/i;
const SUPPORTED_STATEMENT_PATTERN = new RegExp(
  `^${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE}(?:\\s*(?:-\\.->|-->)\\s*(?:\\|[^|]*\\|\\s*)?${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE})*$`
);
const SOURCE_SEMANTIC_ID_PATTERN = new RegExp(
  `(${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE})\\s*$`
);
const TARGET_SEMANTIC_ID_PATTERN = new RegExp(
  `^\\s*(?:\\|([^|]*)\\|\\s*)?(${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE})`
);
const SUBGRAPH_PATTERN = new RegExp(
  `^subgraph\\s+(${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE})(?:\\s*\\[([^\\]]+)\\])?`,
  'i'
);
const HTML_TAG_PATTERN = /<\/?[A-Za-z][^>\n]*>/;

interface ParseFlowchartOptions {
  diagramId: string;
  revision?: number;
}

function cleanLabel(label: string): string {
  return label.trim().replace(/^['"]|['"]$/g, '');
}

function parseNodeToken(semanticId: string, token: string): DiagramNode {
  if (token.startsWith('[[')) {
    throw new Error('Subroutine nodes require targeted replacement');
  }
  if (token.startsWith('[(')) {
    throw new Error('Cylinder nodes require targeted replacement');
  }
  if (token.startsWith('([')) {
    return {
      semanticId,
      label: cleanLabel(token.slice(2, -2)),
      shape: 'stadium',
    };
  }
  if (token.startsWith('((')) {
    return {
      semanticId,
      label: cleanLabel(token.slice(2, -2)),
      shape: 'circle',
    };
  }
  if (token.startsWith('{{')) {
    throw new Error('Hexagon nodes require targeted replacement');
  }
  if (token.startsWith('{')) {
    return {
      semanticId,
      label: cleanLabel(token.slice(1, -1)),
      shape: 'diamond',
    };
  }
  if (token.startsWith('(')) {
    return {
      semanticId,
      label: cleanLabel(token.slice(1, -1)),
      shape: 'rounded',
    };
  }

  return {
    semanticId,
    label: cleanLabel(token.slice(1, -1)),
    shape: 'rectangle',
  };
}

export function getMermaidDiagramType(source: string): string | null {
  const firstLine = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('%%'));
  return firstLine?.match(/^([A-Za-z][\w-]*)/)?.[1] || null;
}

export function isPatchableFlowchart(source: string): boolean {
  const type = getMermaidDiagramType(source)?.toLowerCase();
  if (type !== 'flowchart' && type !== 'graph') return false;

  if (
    HTML_TAG_PATTERN.test(source) ||
    /\b(subgraph|classDef|class|click|linkStyle|accTitle|accDescr)\b|:::|\s&\s|%%\{|@\{|<--|--[ox]|[ox]--|~~~|;|==>|---|--\s+[^|\n]+\s+-->/i.test(
      source
    )
  ) {
    return false;
  }

  const meaningfulLines = source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/%%.*$/, '').trim())
    .filter(Boolean)
    .slice(1);
  const header = source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/%%.*$/, '').trim())
    .find(Boolean);
  if (!header || !FLOWCHART_HEADER_PATTERN.test(header)) return false;

  const referencedNodeIds = new Set<string>();
  const styledNodeIds = new Set<string>();
  for (const line of meaningfulLines) {
    const styleMatch = line.match(
      new RegExp(
        `^style\\s+(${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE})\\s+(.+)$`,
        'i'
      )
    );
    if (styleMatch) {
      if (
        styledNodeIds.has(styleMatch[1]) ||
        !parsePatchableFlowchartNodeStyle(styleMatch[2])
      ) {
        return false;
      }
      styledNodeIds.add(styleMatch[1]);
      continue;
    }
    if (/^style\s+/i.test(line)) return false;

    NODE_DEFINITION_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(NODE_DEFINITION_PATTERN)) {
      if (/^(?:\[\[|\[\(|\{\{)/.test(match[2])) {
        return false;
      }
    }
    NODE_DEFINITION_PATTERN.lastIndex = 0;
    const hasNodeDefinition = NODE_DEFINITION_PATTERN.test(line);
    NODE_DEFINITION_PATTERN.lastIndex = 0;
    const normalized = line.replace(
      NODE_DEFINITION_PATTERN,
      (_match, semanticId: string) => semanticId
    );
    const supportedStatement = SUPPORTED_STATEMENT_PATTERN.test(normalized);
    if (!supportedStatement) return false;
    if (!hasNodeDefinition && !/(?:-\.->|-->)/.test(normalized)) {
      return false;
    }

    const statementWithoutLabels = normalized.replace(/\|[^|]*\|/g, ' ');
    const semanticIdPattern = new RegExp(
      PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE,
      'g'
    );
    for (const match of statementWithoutLabels.matchAll(semanticIdPattern)) {
      referencedNodeIds.add(match[0]);
    }
  }

  for (const semanticId of styledNodeIds) {
    if (!referencedNodeIds.has(semanticId)) return false;
  }

  try {
    const document = parseFlowchartMermaid(source, {
      diagramId: 'patchability-check',
    });
    return document.nodes.length > 0;
  } catch {
    return false;
  }
}

export function parseFlowchartMermaid(
  source: string,
  options: ParseFlowchartOptions
): DiagramDocument {
  if (HTML_TAG_PATTERN.test(source)) {
    throw new Error('HTML labels require targeted replacement');
  }
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('%%');
  });
  const header = lines[headerIndex]?.trim() || '';
  const headerMatch = header.match(FLOWCHART_HEADER_PATTERN);
  if (!headerMatch) {
    throw new Error('Only Mermaid flowchart or graph diagrams can be patched');
  }

  const nodeMap = new Map<string, DiagramNode>();
  const edges: DiagramDocument['edges'] = [];
  const groups: DiagramDocument['groups'] = [];
  const edgeIds = new Set<string>();
  let currentGroup: DiagramDocument['groups'][number] | null = null;

  const ensureNode = (semanticId: string): DiagramNode => {
    const existing = nodeMap.get(semanticId);
    if (existing) return existing;
    const created: DiagramNode = {
      semanticId,
      label: semanticId,
      shape: 'rectangle',
    };
    nodeMap.set(semanticId, created);
    return created;
  };

  const addToCurrentGroup = (semanticId: string) => {
    if (currentGroup && !currentGroup.nodeSemanticIds.includes(semanticId)) {
      currentGroup.nodeSemanticIds.push(semanticId);
    }
  };

  for (const rawLine of lines.slice(headerIndex + 1)) {
    const line = rawLine.replace(/%%.*$/, '').trim();
    if (!line) continue;

    const subgraphMatch = line.match(SUBGRAPH_PATTERN);
    if (subgraphMatch) {
      currentGroup = {
        semanticId: subgraphMatch[1],
        label: cleanLabel(subgraphMatch[2] || subgraphMatch[1]),
        nodeSemanticIds: [],
      };
      groups.push(currentGroup);
      continue;
    }
    if (/^end\b/i.test(line)) {
      currentGroup = null;
      continue;
    }

    const styleMatch = line.match(
      new RegExp(
        `^style\\s+(${PATCHABLE_FLOWCHART_SEMANTIC_ID_SOURCE})\\s+(.+)$`,
        'i'
      )
    );
    if (styleMatch) {
      const node = ensureNode(styleMatch[1]);
      const style = parsePatchableFlowchartNodeStyle(styleMatch[2]);
      if (!style) {
        throw new Error(
          `Unsupported node style for patchable flowchart node ${styleMatch[1]}`
        );
      }
      node.style = style;
      continue;
    }

    NODE_DEFINITION_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(NODE_DEFINITION_PATTERN)) {
      const parsed = parseNodeToken(match[1], match[2]);
      const existingStyle = nodeMap.get(match[1])?.style;
      nodeMap.set(match[1], { ...parsed, style: existingStyle });
      addToCurrentGroup(match[1]);
    }

    NODE_DEFINITION_PATTERN.lastIndex = 0;
    const normalizedLine = line.replace(
      NODE_DEFINITION_PATTERN,
      (_match, semanticId: string) => semanticId
    );
    const connectorPattern = /(-\.->|-->|==>|---)/g;

    for (const connectorMatch of normalizedLine.matchAll(connectorPattern)) {
      const connectorIndex = connectorMatch.index || 0;
      const before = normalizedLine.slice(0, connectorIndex);
      const after = normalizedLine.slice(
        connectorIndex + connectorMatch[0].length
      );
      const sourceId = before.match(SOURCE_SEMANTIC_ID_PATTERN)?.[1];
      const targetMatch = after.match(TARGET_SEMANTIC_ID_PATTERN);
      const targetId = targetMatch?.[2];
      if (!sourceId || !targetId) continue;

      ensureNode(sourceId);
      ensureNode(targetId);
      addToCurrentGroup(sourceId);
      addToCurrentGroup(targetId);

      const edgeId = canonicalPatchableFlowchartEdgeSemanticId(
        sourceId,
        targetId
      );
      if (edgeIds.has(edgeId)) {
        throw new Error(
          `Parallel edge ${edgeId} requires targeted replacement`
        );
      }
      edgeIds.add(edgeId);
      edges.push({
        semanticId: edgeId,
        sourceSemanticId: sourceId,
        targetSemanticId: targetId,
        label: targetMatch?.[1]?.trim() || undefined,
        lineStyle: connectorMatch[0] === '-->' ? 'solid' : 'dashed',
      });
    }
  }

  return diagramDocumentSchema.parse({
    schemaVersion: 1,
    diagramId: options.diagramId,
    diagramType: 'flowchart',
    mermaidKeyword: headerMatch[1].toLowerCase(),
    direction: headerMatch[2].toUpperCase(),
    revision: options.revision ?? 0,
    sourceMermaid: source.trim(),
    nodes: [...nodeMap.values()],
    edges,
    groups,
  });
}
