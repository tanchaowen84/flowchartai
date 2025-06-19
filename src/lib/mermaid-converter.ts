import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';

// ExcalidrawElement type - using any since it's not easily accessible from exports
export type ExcalidrawElement = any;
/**
 * Configuration options for Mermaid to Excalidraw conversion
 */
export interface MermaidConfig {
  /**
   * Whether to start the diagram automatically when the page loads.
   * @default false
   */
  startOnLoad?: boolean;
  /**
   * The flowchart curve style.
   * @default "linear"
   */
  flowchart?: {
    curve?: 'linear' | 'basis';
  };
  /**
   * Theme variables
   * @default { fontSize: "20px" }
   */
  themeVariables?: {
    fontSize?: string;
  };
  /**
   * Maximum number of edges to be rendered.
   * @default 500
   */
  maxEdges?: number;
  /**
   * Maximum number of characters to be rendered.
   * @default 50000
   */
  maxTextSize?: number;
}

/**
 * Result of Mermaid to Excalidraw conversion
 */
export interface MermaidConversionResult {
  elements: ExcalidrawElement[];
  files: BinaryFiles;
  success: true;
}

/**
 * Error result of Mermaid to Excalidraw conversion
 */
export interface MermaidConversionError {
  success: false;
  error: string;
  details?: string;
}

/**
 * Union type for conversion results
 */
export type MermaidConversionOutput =
  | MermaidConversionResult
  | MermaidConversionError;

/**
 * Default configuration for Mermaid conversion
 */
const DEFAULT_CONFIG: MermaidConfig = {
  startOnLoad: false,
  flowchart: {
    curve: 'linear',
  },
  themeVariables: {
    fontSize: '20px',
  },
  maxEdges: 500,
  maxTextSize: 50000,
};

/**
 * Converts Mermaid diagram syntax to Excalidraw elements
 *
 * This function uses a two-step process:
 * 1. Parse Mermaid syntax to skeleton elements using parseMermaidToExcalidraw
 * 2. Convert skeleton elements to fully qualified Excalidraw elements
 *
 * @param mermaidSyntax - The Mermaid diagram definition string
 * @param config - Optional configuration for the conversion
 * @returns Promise resolving to conversion result or error
 */
export async function convertMermaidToExcalidraw(
  mermaidSyntax: string,
  config?: MermaidConfig
): Promise<MermaidConversionOutput> {
  try {
    // Validate input
    if (!mermaidSyntax || typeof mermaidSyntax !== 'string') {
      return {
        success: false,
        error: 'Invalid Mermaid syntax',
        details: 'Mermaid syntax must be a non-empty string',
      };
    }

    // Merge with default configuration
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Step 1: Parse Mermaid to skeleton elements
    const { elements: skeletonElements, files } =
      await parseMermaidToExcalidraw(mermaidSyntax, mergedConfig);

    // Step 2: Convert skeleton elements to fully qualified Excalidraw elements
    const excalidrawElements = convertToExcalidrawElements(skeletonElements, {
      regenerateIds: true, // Generate new IDs for elements
    });

    return {
      success: true,
      elements: excalidrawElements,
      files: files || {},
    };
  } catch (error) {
    // Handle parsing errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: 'Failed to convert Mermaid to Excalidraw',
      details: errorMessage,
    };
  }
}

/**
 * Validates if a string contains valid Mermaid syntax
 *
 * @param syntax - The string to validate
 * @returns boolean indicating if the syntax appears to be valid Mermaid
 */
export function isValidMermaidSyntax(syntax: string): boolean {
  if (!syntax || typeof syntax !== 'string') {
    return false;
  }

  // Basic validation - check for common Mermaid diagram types
  const mermaidKeywords = [
    'flowchart',
    'graph',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'journey',
    'gantt',
    'pie',
    'gitGraph',
    'mindmap',
    'timeline',
    'quadrantChart',
    'requirement',
    'c4Context',
  ];

  const trimmedSyntax = syntax.trim().toLowerCase();

  return mermaidKeywords.some(
    (keyword) =>
      trimmedSyntax.startsWith(keyword) || trimmedSyntax.includes(keyword)
  );
}

/**
 * Extracts the diagram type from Mermaid syntax
 *
 * @param syntax - The Mermaid syntax string
 * @returns The diagram type or 'unknown' if not detected
 */
export function getMermaidDiagramType(syntax: string): string {
  if (!syntax || typeof syntax !== 'string') {
    return 'unknown';
  }

  const trimmedSyntax = syntax.trim().toLowerCase();

  // Check for flowchart patterns
  if (
    trimmedSyntax.startsWith('flowchart') ||
    trimmedSyntax.startsWith('graph')
  ) {
    return 'flowchart';
  }

  // Check for other diagram types
  const diagramTypes = [
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'journey',
    'gantt',
    'pie',
    'gitGraph',
    'mindmap',
    'timeline',
    'quadrantChart',
    'requirement',
    'c4Context',
  ];

  for (const type of diagramTypes) {
    if (trimmedSyntax.includes(type.toLowerCase())) {
      return type;
    }
  }

  return 'unknown';
}

/**
 * Provides helpful error messages for common Mermaid syntax issues
 *
 * @param syntax - The Mermaid syntax string
 * @returns Array of potential issues or suggestions
 */
export function analyzeMermaidSyntax(syntax: string): string[] {
  const issues: string[] = [];

  if (!syntax || typeof syntax !== 'string') {
    issues.push('Mermaid syntax is required');
    return issues;
  }

  const trimmedSyntax = syntax.trim();

  if (trimmedSyntax.length === 0) {
    issues.push('Mermaid syntax cannot be empty');
    return issues;
  }

  // Check if it looks like Mermaid
  if (!isValidMermaidSyntax(syntax)) {
    issues.push("Syntax doesn't appear to be valid Mermaid format");
    issues.push(
      "Make sure to start with a diagram type (e.g., 'flowchart TD', 'graph LR')"
    );
  }

  // Check for common issues
  const lines = trimmedSyntax.split('\n');

  // Check for missing diagram declaration
  if (!lines[0].match(/^(flowchart|graph|sequenceDiagram|classDiagram)/i)) {
    issues.push('Consider starting with a diagram type declaration');
  }

  // Check for potential syntax issues
  const hasArrows = syntax.includes('-->') || syntax.includes('---');
  const hasNodes = syntax.match(/[A-Za-z0-9_]+/);

  if (!hasArrows && !hasNodes) {
    issues.push('Diagram appears to be missing nodes or connections');
  }

  return issues;
}

/**
 * Creates a sample Mermaid flowchart for testing
 *
 * @returns A simple Mermaid flowchart syntax
 */
export function createSampleMermaidFlowchart(): string {
  return `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E`;
}
