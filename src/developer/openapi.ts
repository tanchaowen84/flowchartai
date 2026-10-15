import { origin } from './contract';
type Schema = Record<string, unknown>;
const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const response = (
  schema: Schema,
  description = 'Successful response'
): Schema => ({ description, content: { 'application/json': { schema } } });
const errors = Object.fromEntries(
  [400, 401, 402, 403, 404, 409, 413, 422, 429, 502, 503].map((code) => [
    code,
    response(
      ref('Error'),
      'Invalid request, credentials, ownership, allowance, conflict, budget, or unavailable upstream. A 429 response includes Retry-After.'
    ),
  ])
);
const id = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};
const cursor = { name: 'cursor', in: 'query', schema: { type: 'string' } };
const idempotency = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  description:
    '8–120 ASCII letters, digits, underscore, period, colon or hyphen. Reuse the same key and exact request after a timeout. Keys are scoped to the owner, across their credentials.',
  schema: { type: 'string', pattern: '^[A-Za-z0-9_.:-]{8,120}$' },
};
const body = (schema: Schema): Schema => ({
  required: true,
  content: { 'application/json': { schema } },
});
function operation(
  operationId: string,
  summary: string,
  schema: Schema,
  extra: Schema = {}
): Schema {
  return {
    operationId,
    summary,
    responses: { '200': response(schema), ...errors },
    ...extra,
  };
}
export function openapi(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'FlowchartAI Developer API',
      version: '1.0.0',
      description:
        'Generate, edit, save and export owned native draw.io diagrams using the existing FlowchartAI account. API keys cannot sign in to the website. AI requests execute synchronously for up to 240 seconds; durable receipts allow recovery without another generation.',
    },
    servers: [{ url: `${origin()}/api/v1` }],
    security: [{ bearerKey: [] }, { apiKey: [] }],
    paths: {
      '/capabilities': {
        get: operation('getCapabilities', 'Read formats and charging rules', {
          type: 'object',
          additionalProperties: true,
        }),
      },
      '/account': {
        get: operation(
          'getAccount',
          'Read wallet, legacy allowance, scopes and budgets',
          {
            type: 'object',
            properties: {
              wallet: { type: 'object' },
              scopes: { type: 'array', items: { type: 'string' } },
              limits: { type: 'object' },
              usage: { type: 'object' },
            },
          }
        ),
      },
      '/generations': {
        post: operation(
          'generateDiagram',
          'Generate or edit and save an owned native diagram',
          ref('Task'),
          { parameters: [idempotency], requestBody: body(ref('Generation')) }
        ),
      },
      '/tasks': {
        get: operation(
          'listTasks',
          'List owned durable operation receipts',
          {
            type: 'object',
            properties: {
              data: { type: 'array', items: ref('Task') },
              next_cursor: { type: ['string', 'null'] },
            },
          },
          { parameters: [cursor] }
        ),
      },
      '/tasks/{id}': {
        get: operation(
          'getTask',
          'Read status or recover a prepared result without regenerating',
          ref('Task'),
          { parameters: [id] }
        ),
      },
      '/diagrams': {
        get: operation(
          'listDiagrams',
          'List saved files belonging to the account',
          {
            type: 'object',
            properties: {
              data: { type: 'array', items: ref('Diagram') },
              next_cursor: { type: ['string', 'null'] },
            },
          },
          { parameters: [cursor] }
        ),
        post: {
          ...operation(
            'createDiagram',
            'Save a native document without AI charges',
            ref('Task'),
            { parameters: [idempotency], requestBody: body(ref('Save')) }
          ),
          responses: { '201': response(ref('Task')), ...errors },
        },
      },
      '/diagrams/{id}': {
        get: operation(
          'getDiagram',
          'Read an owned file, content hash and editor URL',
          ref('Diagram'),
          { parameters: [id] }
        ),
        put: operation(
          'saveDiagram',
          'Save an owned native document at an expected content hash',
          ref('Task'),
          {
            parameters: [id, idempotency],
            requestBody: body({
              allOf: [
                ref('Save'),
                { type: 'object', required: ['expected_version'] },
              ],
            }),
          }
        ),
      },
      '/diagrams/{id}/versions': {
        get: operation(
          'getDiagramVersions',
          'List up to 50 saved version summaries, or read one snapshot by version',
          {
            oneOf: [
              {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        version: { type: 'string' },
                        title: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              {
                type: 'object',
                properties: {
                  version: { type: 'string' },
                  title: { type: 'string' },
                  document: ref('NativeDocument'),
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            ],
          },
          {
            parameters: [
              id,
              {
                name: 'version',
                in: 'query',
                description: 'A saved version hash. Omit to list summaries.',
                schema: { type: 'string', pattern: '^[a-f0-9]{64}$' },
              },
            ],
          }
        ),
      },
      '/diagrams/{id}/export': {
        get: {
          operationId: 'exportDiagram',
          summary:
            'Download native draw.io XML or original JSON without AI charges',
          parameters: [
            id,
            {
              name: 'format',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['drawio', 'json'],
                default: 'drawio',
              },
            },
          ],
          responses: {
            '200': {
              description:
                'Private owned file attachment. PNG and SVG are available in the website editor.',
              content: {
                'application/xml': { schema: { type: 'string' } },
                'application/json': { schema: { type: 'object' } },
              },
            },
            ...errors,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'fca_key_…',
        },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                required_credits: {
                  type: 'integer',
                  description:
                    'Full-context reservation required when max_credits_too_low is returned.',
                },
              },
            },
          },
        },
        NativeDocument: {
          type: 'object',
          additionalProperties: false,
          required: [
            'editorKind',
            'formatVersion',
            'documentId',
            'revision',
            'diagramType',
            'xml',
          ],
          properties: {
            editorKind: { const: 'drawio' },
            formatVersion: { const: 1 },
            documentId: { type: 'string', minLength: 1 },
            revision: { type: 'integer', minimum: 0 },
            diagramType: { type: 'string' },
            pageId: { type: 'string' },
            xml: {
              type: 'string',
              description:
                'Valid uncompressed mxGraphModel/mxfile XML. Maximum 2 MB / 2,000 objects. No external entities.',
            },
          },
        },
        Generation: {
          type: 'object',
          additionalProperties: false,
          required: ['prompt', 'max_credits'],
          properties: {
            prompt: { type: 'string', minLength: 1, maxLength: 12000 },
            max_credits: {
              type: 'integer',
              minimum: 1,
              maximum: 2000,
              description:
                'Upper limit. A cap below the full-context estimate returns 409 max_credits_too_low with required_credits before generation. Never raise it without owner authorization. The accepted reservation may be lower; actual full-task provider usage is capped at that reservation.',
            },
            image: {
              type: 'string',
              description:
                'Optional PNG/JPEG/WebP base64 data URI, at most 2 MB decoded. Arbitrary URLs are not fetched.',
            },
            diagram_id: {
              type: 'string',
              description:
                'Existing owned native file to edit; omit to create. Edits also require diagrams:read in addition to diagrams:write and diagrams:generate.',
            },
            expected_version: {
              type: 'string',
              pattern: '^[a-f0-9]{64}$',
              description:
                'Required when diagram_id is set. Read the latest file first.',
            },
          },
          dependentRequired: { diagram_id: ['expected_version'] },
        },
        Save: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'document'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 160 },
            document: ref('NativeDocument'),
            expected_version: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          },
        },
        Diagram: {
          type: 'object',
          required: ['id', 'title', 'version', 'open_url'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            version: {
              type: 'string',
              description:
                'Digest of the saved title and content, including website changes.',
            },
            format: { type: 'string', enum: ['drawio', 'legacy'] },
            document: {
              type: 'object',
              description:
                'Included on reads; native document or original legacy JSON.',
            },
            open_url: { type: 'string', format: 'uri' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          required: [
            'id',
            'state',
            'operation',
            'diagram_id',
            'budget_credits',
            'reserved_credits',
            'charged_credits',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            state: {
              type: 'string',
              enum: ['running', 'prepared', 'succeeded', 'failed'],
            },
            operation: { type: 'string', enum: ['generate', 'edit', 'save'] },
            diagram_id: { type: 'string' },
            budget_credits: {
              type: 'integer',
              description: 'Accepted task estimate, retained after settlement.',
            },
            reserved_credits: { type: 'integer' },
            charged_credits: { type: 'integer' },
            diagram: ref('Diagram'),
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  };
}
