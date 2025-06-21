// ExcalidrawElement type - using any since it's not easily accessible from exports
export type ExcalidrawElement = any;

// 画布分析结果类型定义
export interface CanvasAnalysis {
  totalElements: number;
  elementsByType: Record<string, number>;
  spatialLayout: SpatialLayout;
  connections: Connection[];
  textContent: TextContent[];
  aiGeneratedElements: ElementInfo[];
  userAddedElements: ElementInfo[];
  canvasDescription: string;
}

export interface SpatialLayout {
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  elementGroups: ElementGroup[];
}

export interface ElementGroup {
  elements: string[]; // element IDs
  center: { x: number; y: number };
  description: string;
}

export interface Connection {
  from: string; // element ID
  to: string; // element ID
  type: 'arrow' | 'line';
  description: string;
}

export interface TextContent {
  elementId: string;
  text: string;
  position: { x: number; y: number };
  elementType: string;
}

export interface ElementInfo {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  text?: string;
  style: {
    strokeColor?: string;
    backgroundColor?: string;
    strokeWidth?: number;
  };
}

/**
 * 分析画布元素并生成详细的分析报告
 */
export function analyzeCanvasElements(
  elements: ExcalidrawElement[]
): CanvasAnalysis {
  const elementsByType = groupElementsByType(elements);
  const spatialLayout = analyzeSpatialLayout(elements);
  const connections = analyzeConnections(elements);
  const textContent = extractAllTextContent(elements);
  const aiGeneratedElements = extractAiGeneratedElements(elements);
  const userAddedElements = extractUserAddedElements(elements);

  const canvasDescription = generateCanvasDescription({
    totalElements: elements.length,
    elementsByType,
    spatialLayout,
    connections,
    textContent,
    aiGeneratedElements,
    userAddedElements,
    canvasDescription: '', // Will be filled by generateCanvasDescription
  });

  return {
    totalElements: elements.length,
    elementsByType,
    spatialLayout,
    connections,
    textContent,
    aiGeneratedElements,
    userAddedElements,
    canvasDescription,
  };
}

/**
 * 按类型分组元素
 */
function groupElementsByType(
  elements: ExcalidrawElement[]
): Record<string, number> {
  const groups: Record<string, number> = {};

  for (const element of elements) {
    if (!element.isDeleted) {
      groups[element.type] = (groups[element.type] || 0) + 1;
    }
  }

  return groups;
}

/**
 * 分析空间布局
 */
function analyzeSpatialLayout(elements: ExcalidrawElement[]): SpatialLayout {
  const activeElements = elements.filter((el) => !el.isDeleted);

  if (activeElements.length === 0) {
    return {
      boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
      elementGroups: [],
    };
  }

  // 计算整体边界框
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const element of activeElements) {
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    maxX = Math.max(maxX, element.x + (element.width || 0));
    maxY = Math.max(maxY, element.y + (element.height || 0));
  }

  const boundingBox = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };

  // 简单的空间分组（基于距离）
  const elementGroups = identifyElementGroups(activeElements);

  return {
    boundingBox,
    elementGroups,
  };
}

/**
 * 识别元素组（基于空间距离）
 */
function identifyElementGroups(elements: ExcalidrawElement[]): ElementGroup[] {
  const groups: ElementGroup[] = [];
  const visited = new Set<string>();

  for (const element of elements) {
    if (visited.has(element.id)) continue;

    const group = findNearbyElements(element, elements, visited);
    if (group.length > 0) {
      const center = calculateGroupCenter(group);
      const description = generateGroupDescription(group);

      groups.push({
        elements: group.map((el) => el.id),
        center,
        description,
      });
    }
  }

  return groups;
}

/**
 * 查找附近的元素
 */
function findNearbyElements(
  centerElement: ExcalidrawElement,
  allElements: ExcalidrawElement[],
  visited: Set<string>,
  maxDistance = 200
): ExcalidrawElement[] {
  const group = [centerElement];
  visited.add(centerElement.id);

  const centerX = centerElement.x + (centerElement.width || 0) / 2;
  const centerY = centerElement.y + (centerElement.height || 0) / 2;

  for (const element of allElements) {
    if (visited.has(element.id)) continue;

    const elementX = element.x + (element.width || 0) / 2;
    const elementY = element.y + (element.height || 0) / 2;

    const distance = Math.sqrt(
      (elementX - centerX) ** 2 + (elementY - centerY) ** 2
    );

    if (distance <= maxDistance) {
      group.push(element);
      visited.add(element.id);
    }
  }

  return group;
}

/**
 * 计算组的中心点
 */
function calculateGroupCenter(elements: ExcalidrawElement[]): {
  x: number;
  y: number;
} {
  let totalX = 0;
  let totalY = 0;

  for (const element of elements) {
    totalX += element.x + (element.width || 0) / 2;
    totalY += element.y + (element.height || 0) / 2;
  }

  return {
    x: totalX / elements.length,
    y: totalY / elements.length,
  };
}

/**
 * 生成组的描述
 */
function generateGroupDescription(elements: ExcalidrawElement[]): string {
  const types = [...new Set(elements.map((el) => el.type))];
  const hasText = elements.some(
    (el) => ('text' in el && el.text) || ('label' in el && el.label?.text)
  );

  let description = `Group of ${elements.length} elements (${types.join(', ')})`;

  if (hasText) {
    description += ' with text content';
  }

  return description;
}

/**
 * 分析连接关系
 */
function analyzeConnections(elements: ExcalidrawElement[]): Connection[] {
  const connections: Connection[] = [];

  for (const element of elements) {
    if (element.isDeleted) continue;

    if (element.type === 'arrow' || element.type === 'line') {
      const connection = analyzeLineConnection(element, elements);
      if (connection) {
        connections.push(connection);
      }
    }
  }

  return connections;
}

/**
 * 分析线条/箭头的连接
 */
function analyzeLineConnection(
  lineElement: ExcalidrawElement,
  allElements: ExcalidrawElement[]
): Connection | null {
  // 检查 startBinding 和 endBinding
  const startBinding =
    'startBinding' in lineElement ? lineElement.startBinding : null;
  const endBinding =
    'endBinding' in lineElement ? lineElement.endBinding : null;

  if (startBinding?.elementId && endBinding?.elementId) {
    const fromElement = allElements.find(
      (el) => el.id === startBinding.elementId
    );
    const toElement = allElements.find((el) => el.id === endBinding.elementId);

    if (fromElement && toElement) {
      const fromText = extractElementText(fromElement);
      const toText = extractElementText(toElement);

      return {
        from: startBinding.elementId,
        to: endBinding.elementId,
        type: lineElement.type as 'arrow' | 'line',
        description: `${lineElement.type} from "${fromText || fromElement.type}" to "${toText || toElement.type}"`,
      };
    }
  }

  return null;
}

/**
 * 提取所有文本内容
 */
function extractAllTextContent(elements: ExcalidrawElement[]): TextContent[] {
  const textContent: TextContent[] = [];

  for (const element of elements) {
    if (element.isDeleted) continue;

    const text = extractElementText(element);
    if (text) {
      textContent.push({
        elementId: element.id,
        text,
        position: { x: element.x, y: element.y },
        elementType: element.type,
      });
    }
  }

  return textContent;
}

/**
 * 提取元素的文本内容
 */
function extractElementText(element: ExcalidrawElement): string | null {
  // 直接的文本元素
  if (element.type === 'text' && 'text' in element) {
    return element.text || null;
  }

  // 带标签的元素（矩形、椭圆等）
  if ('label' in element && element.label?.text) {
    return element.label.text;
  }

  return null;
}

/**
 * 提取AI生成的元素
 */
function extractAiGeneratedElements(
  elements: ExcalidrawElement[]
): ElementInfo[] {
  return elements
    .filter((el) => !el.isDeleted && el.customData?.aiGenerated)
    .map((el) => convertToElementInfo(el));
}

/**
 * 提取用户添加的元素
 */
function extractUserAddedElements(
  elements: ExcalidrawElement[]
): ElementInfo[] {
  return elements
    .filter((el) => !el.isDeleted && !el.customData?.aiGenerated)
    .map((el) => convertToElementInfo(el));
}

/**
 * 转换为ElementInfo格式
 */
function convertToElementInfo(element: ExcalidrawElement): ElementInfo {
  return {
    id: element.id,
    type: element.type,
    position: { x: element.x, y: element.y },
    size: {
      width: element.width || 0,
      height: element.height || 0,
    },
    text: extractElementText(element) || undefined,
    style: {
      strokeColor: 'strokeColor' in element ? element.strokeColor : undefined,
      backgroundColor:
        'backgroundColor' in element ? element.backgroundColor : undefined,
      strokeWidth: 'strokeWidth' in element ? element.strokeWidth : undefined,
    },
  };
}

/**
 * 生成画布的自然语言描述
 */
function generateCanvasDescription(analysis: CanvasAnalysis): string {
  const parts: string[] = [];

  // 基本统计
  if (analysis.totalElements === 0) {
    return 'The canvas is currently empty with no elements.';
  }

  parts.push(
    `The canvas contains ${analysis.totalElements} elements in total.`
  );

  // 元素类型统计
  const typeDescriptions = Object.entries(analysis.elementsByType)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    .join(', ');
  parts.push(`Element types: ${typeDescriptions}.`);

  // AI vs 用户元素
  if (analysis.aiGeneratedElements.length > 0) {
    parts.push(
      `${analysis.aiGeneratedElements.length} elements were AI-generated.`
    );
  }
  if (analysis.userAddedElements.length > 0) {
    parts.push(
      `${analysis.userAddedElements.length} elements were manually added by the user.`
    );
  }

  // 文本内容
  if (analysis.textContent.length > 0) {
    const textSummary = analysis.textContent
      .slice(0, 5) // 只显示前5个文本内容
      .map((tc) => `"${tc.text}"`)
      .join(', ');
    parts.push(
      `Text content includes: ${textSummary}${analysis.textContent.length > 5 ? '...' : ''}.`
    );
  }

  // 连接关系
  if (analysis.connections.length > 0) {
    parts.push(
      `There are ${analysis.connections.length} connections between elements.`
    );
    if (analysis.connections.length <= 3) {
      const connectionDescriptions = analysis.connections
        .map((conn) => conn.description)
        .join('; ');
      parts.push(`Connections: ${connectionDescriptions}.`);
    }
  }

  // 空间布局
  const { boundingBox } = analysis.spatialLayout;
  if (boundingBox.width > 0 && boundingBox.height > 0) {
    parts.push(
      `The content spans approximately ${Math.round(boundingBox.width)} x ${Math.round(boundingBox.height)} pixels.`
    );
  }

  return parts.join(' ');
}

/**
 * 为AI生成简化的画布状态描述
 */
export function generateAICanvasDescription(
  elements: ExcalidrawElement[]
): string {
  const analysis = analyzeCanvasElements(elements);
  return analysis.canvasDescription;
}
