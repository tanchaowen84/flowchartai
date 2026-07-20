import {
  type DiagramDocument,
  type DiagramNode,
  diagramDocumentSchema,
} from './contracts';

const NODE_DEFINITION_PATTERN =
  /\b([A-Za-z_][\w-]*)\s*(\[\[[^\]\n]*\]\]|\[\([^\]\n]*\)\]|\(\[[^\]\n]*\]\)|\(\([^\)\n]*\)\)|\{\{[^}\n]*\}\}|\{[^}\n]*\}|\([^\)\n]*\)|\[[^\]\n]*\])/g;

interface ParseFlowchartOptions {
  diagramId: string;
  revision?: number;
}

function cleanLabel(label: string): string {
  return label.trim().replace(/^['"]|['"]$/g, '');
}

function parseNodeToken(semanticId: string, token: string): DiagramNode {
  if (token.startsWith('[[')) {
    return {
      semanticId,
      label: cleanLabel(token.slice(2, -2)),
      shape: 'subroutine',
    };
  }
  if (token.startsWith('[(')) {
    return {
      semanticId,
      label: cleanLabel(token.slice(2, -2)),
      shape: 'cylinder',
    };
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
    return {
      semanticId,
      label: cleanLabel(token.slice(2, -2)),
      shape: 'hexagon',
    };
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

function parseStyle(styleText: string): Record<string, string> {
  return Object.fromEntries(
    styleText
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf(':');
        return separator === -1
          ? [entry, '']
          : [entry.slice(0, separator), entry.slice(separator + 1)];
      })
  );
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
  for (const line of meaningfulLines) {
    if (/^style\s+/i.test(line)) return false;
    NODE_DEFINITION_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(NODE_DEFINITION_PATTERN)) {
      if (/^(?:\[\[|\[\(|\(\[|\(\(|\{\{)/.test(match[2])) {
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
    const supportedStatement =
      /^[A-Za-z_][\w-]*(?:\s*(?:-\.->|-->)\s*(?:\|[^|]*\|\s*)?[A-Za-z_][\w-]*)*$/.test(
        normalized
      );
    if (!supportedStatement) return false;
    if (!hasNodeDefinition && !/(?:-\.->|-->)/.test(normalized)) {
      return false;
    }
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
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('%%');
  });
  const header = lines[headerIndex]?.trim() || '';
  const headerMatch = header.match(/^(flowchart|graph)\s+(LR|RL|TD|BT)\b/i);
  if (!headerMatch) {
    throw new Error('Only Mermaid flowchart or graph diagrams can be patched');
  }

  const nodeMap = new Map<string, DiagramNode>();
  const edges: DiagramDocument['edges'] = [];
  const groups: DiagramDocument['groups'] = [];
  const edgeOccurrences = new Map<string, number>();
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

    const subgraphMatch = line.match(
      /^subgraph\s+([A-Za-z_][\w-]*)(?:\s*\[([^\]]+)\])?/i
    );
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

    const styleMatch = line.match(/^style\s+([A-Za-z_][\w-]*)\s+(.+)$/i);
    if (styleMatch) {
      const node = ensureNode(styleMatch[1]);
      node.style = parseStyle(styleMatch[2]);
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
      const sourceId = before.match(/([A-Za-z_][\w-]*)\s*$/)?.[1];
      const targetMatch = after.match(
        /^\s*(?:\|([^|]*)\|\s*)?([A-Za-z_][\w-]*)/
      );
      const targetId = targetMatch?.[2];
      if (!sourceId || !targetId) continue;

      ensureNode(sourceId);
      ensureNode(targetId);
      addToCurrentGroup(sourceId);
      addToCurrentGroup(targetId);

      const baseId = `${sourceId}__${targetId}`;
      const occurrence = (edgeOccurrences.get(baseId) || 0) + 1;
      edgeOccurrences.set(baseId, occurrence);
      edges.push({
        semanticId: occurrence === 1 ? baseId : `${baseId}__${occurrence}`,
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
