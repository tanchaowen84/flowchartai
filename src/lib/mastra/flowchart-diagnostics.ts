export type FlowchartDiagnosticStage =
  | 'request'
  | 'guard'
  | 'agent'
  | 'tool_validation'
  | 'sse_map'
  | 'prepare_canvas';

export type FlowchartDiagnosticStatus =
  | 'started'
  | 'success'
  | 'failed'
  | 'aborted'
  | 'stream_incomplete';

export type FlowchartDiagnosticCode =
  | 'request_received'
  | 'invalid_json'
  | 'invalid_messages'
  | 'too_many_images'
  | 'guard_rejected'
  | 'agent_invoked'
  | 'canvas_command_valid'
  | 'invalid_canvas_command'
  | 'invalid_tool_input'
  | 'revision_conflict'
  | 'semantic_entity_missing'
  | 'semantic_entity_duplicate'
  | 'patch_target_mismatch'
  | 'unsupported_patch_target'
  | 'scene_alignment_mismatch'
  | 'invalid_patch_result'
  | 'ambiguous_diagram_target'
  | 'missing_diagram_target'
  | 'invalid_create_target'
  | 'invalid_replace_target'
  | 'tool_execution_failed'
  | 'agent_stream_error'
  | 'stream_finished'
  | 'stream_aborted'
  | 'stream_incomplete'
  | 'stream_exception'
  | 'http_error'
  | 'no_response_body'
  | 'invalid_sse_command'
  | 'multiple_canvas_commands'
  | 'canvas_command_incomplete'
  | 'canvas_command_missing'
  | 'prepare_canvas_failed'
  | 'prepare_canvas_succeeded'
  | 'client_request_failed'
  | 'validation_failed'
  | 'unknown_error';

export interface SafeValidationIssue {
  code: string;
  path: string;
}

export interface FlowchartDiagnosticEvent {
  stage: FlowchartDiagnosticStage;
  status: FlowchartDiagnosticStatus;
  code: FlowchartDiagnosticCode;
  errorName?: string;
  validationIssues?: SafeValidationIssue[];
  mode?: 'text_to_flowchart' | 'image_to_flowchart';
  targetStatus?: 'none' | 'resolved' | 'ambiguous';
  commandKind?: 'render-mermaid' | 'patch-diagram';
  operation?: 'create' | 'replace' | 'patch';
  operationCount?: number;
  messageCount?: number;
  imageCount?: number;
  toolCallsCompleted?: boolean;
}

export interface FlowchartDiagnosticRecord extends FlowchartDiagnosticEvent {
  requestId: string;
  elapsedMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeToken(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(value) ? value : fallback;
}

function readProperty(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined;
  try {
    return value[key];
  } catch {
    return undefined;
  }
}

function normalizeIssuePath(path: unknown): string | null {
  if (!Array.isArray(path)) return null;
  const segments = path.map((segment) => {
    if (typeof segment === 'number') return '[number]';
    return safeToken(segment, '[field]');
  });
  return segments.length > 0 ? segments.join('.') : '[root]';
}

function sanitizeIssuePath(path: string): string {
  return path
    .split('.')
    .slice(0, 12)
    .map((segment) =>
      segment === '[number]' || segment === '[root]' || segment === '[field]'
        ? segment
        : safeToken(segment, '[field]')
    )
    .join('.');
}

export function extractSafeValidationIssues(
  error: unknown
): SafeValidationIssue[] {
  const issues: SafeValidationIssue[] = [];
  const visited = new Set<unknown>();

  const visit = (value: unknown, depth: number): void => {
    if (!isRecord(value) || depth > 5 || visited.has(value)) return;
    visited.add(value);

    const candidateIssues = readProperty(value, 'issues');
    if (Array.isArray(candidateIssues)) {
      for (const candidate of candidateIssues.slice(0, 12)) {
        const path = normalizeIssuePath(readProperty(candidate, 'path'));
        if (!path) continue;
        issues.push({
          code: safeToken(readProperty(candidate, 'code'), 'validation_issue'),
          path,
        });
      }
    }

    visit(readProperty(value, 'cause'), depth + 1);
    visit(readProperty(value, 'error'), depth + 1);
  };

  visit(error, 0);
  return issues;
}

function collectErrorFacts(error: unknown): {
  names: string[];
  messages: string[];
} {
  const names: string[] = [];
  const messages: string[] = [];
  const visited = new Set<unknown>();

  const visit = (value: unknown, depth: number): void => {
    if (depth > 5 || visited.has(value)) return;
    if (typeof value === 'string') {
      messages.push(value);
      return;
    }
    if (!isRecord(value)) return;
    visited.add(value);

    const name = readProperty(value, 'name');
    if (typeof name === 'string') names.push(name);
    const message = readProperty(value, 'message');
    if (typeof message === 'string') messages.push(message);

    visit(readProperty(value, 'cause'), depth + 1);
    visit(readProperty(value, 'error'), depth + 1);
  };

  visit(error, 0);
  return { names, messages };
}

export function getSafeErrorName(error: unknown): string {
  const { names } = collectErrorFacts(error);
  return safeToken(names[0], 'UnknownError');
}

export function classifyFlowchartError(
  error: unknown
): FlowchartDiagnosticCode {
  const { names, messages } = collectErrorFacts(error);
  const text = [...names, ...messages].join(' ').toLowerCase();

  if (text.includes('abort')) return 'stream_aborted';
  if (text.includes('revision conflict')) return 'revision_conflict';
  if (
    text.includes('invalid input for tool') ||
    text.includes('invalidtoolinput') ||
    text.includes('typevalidation')
  ) {
    return 'invalid_tool_input';
  }
  if (text.includes('does not exist')) return 'semantic_entity_missing';
  if (text.includes('already exists')) return 'semantic_entity_duplicate';
  if (text.includes('patch targets diagram')) return 'patch_target_mismatch';
  if (
    text.includes('cannot be locally patched') ||
    text.includes('subgraph/group diagrams')
  ) {
    return 'unsupported_patch_target';
  }
  if (text.includes('scene does not match')) {
    return 'scene_alignment_mismatch';
  }
  if (
    text.includes('patch validation failed') ||
    text.includes('outside the shared patchable')
  ) {
    return 'invalid_patch_result';
  }
  if (text.includes('target is ambiguous')) {
    return 'ambiguous_diagram_target';
  }
  if (text.includes('no diagram is available')) {
    return 'missing_diagram_target';
  }
  if (text.includes('create is not valid')) return 'invalid_create_target';
  if (text.includes('replace command diagram id')) {
    return 'invalid_replace_target';
  }
  if (text.includes('multiple canvas commands')) {
    return 'multiple_canvas_commands';
  }
  if (text.includes('no response body')) return 'no_response_body';
  if (text.includes('before completion')) return 'stream_incomplete';
  if (text.includes('not completed by the agent')) {
    return 'canvas_command_incomplete';
  }
  if (text.includes('without a canvas command')) {
    return 'canvas_command_missing';
  }
  if (text.includes('invalid canvas command')) {
    return 'invalid_canvas_command';
  }
  if (text.includes('tool execution')) return 'tool_execution_failed';
  if (extractSafeValidationIssues(error).length > 0) {
    return 'validation_failed';
  }
  return 'unknown_error';
}

export function logFlowchartDiagnostic(
  record: FlowchartDiagnosticRecord
): void {
  const boundedRecord: FlowchartDiagnosticRecord = {
    requestId: safeToken(record.requestId, 'invalid-request-id'),
    stage: record.stage,
    status: record.status,
    code: record.code,
    errorName: record.errorName
      ? safeToken(record.errorName, 'UnknownError')
      : undefined,
    validationIssues: record.validationIssues?.slice(0, 12).map((issue) => ({
      code: safeToken(issue.code, 'validation_issue'),
      path: sanitizeIssuePath(issue.path),
    })),
    mode: record.mode,
    targetStatus: record.targetStatus,
    commandKind: record.commandKind,
    operation: record.operation,
    operationCount: record.operationCount,
    messageCount: record.messageCount,
    imageCount: record.imageCount,
    toolCallsCompleted: record.toolCallsCompleted,
    elapsedMs:
      typeof record.elapsedMs === 'number'
        ? Math.max(0, Math.round(record.elapsedMs))
        : undefined,
  };
  const serialized = JSON.stringify(boundedRecord);

  if (record.status === 'failed' || record.status === 'stream_incomplete') {
    console.error('[flowchart-diagnostic]', serialized);
    return;
  }
  console.info('[flowchart-diagnostic]', serialized);
}
