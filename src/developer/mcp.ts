import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { authenticate } from './access';
import { DeveloperError, type Principal, origin, resource } from './contract';
import {
  diagramVersions,
  exportDiagram,
  listDiagrams,
  readDiagram,
  saveSchema,
} from './diagrams';
import { failure, readBody } from './http';
import {
  account,
  capabilities,
  generate,
  listTasks,
  readTask,
  save,
} from './service';

export function mcpServer(principal: Principal): McpServer {
  const server = new McpServer({ name: 'flowchartai', version: '1.0.0' });
  function tool<T extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: T,
    readOnly: boolean,
    run: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>
  ): void {
    server.registerTool<z.ZodRawShape, z.ZodRawShape>(
      name,
      {
        description,
        inputSchema: shape,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args) => {
        try {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  await run(args as z.infer<z.ZodObject<T>>)
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(await failure(error).json()),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
  tool(
    'get_capabilities',
    'Read formats, image limits, execution and charging rules.',
    {},
    true,
    async () => capabilities
  );
  tool(
    'get_account',
    'Read existing wallet/legacy allowance, scopes and developer budgets.',
    {},
    true,
    () => account(principal)
  );
  const key = { idempotency_key: z.string().min(8).max(120) };
  const ai = {
    prompt: z.string().min(1).max(12000),
    max_credits: z
      .number()
      .int()
      .min(1)
      .max(2000)
      .describe(
        'User-authorized spending cap. Below the server estimate returns max_credits_too_low and required_credits without generation. Do not raise the cap without user approval.'
      ),
    image: z.string().max(2800000).optional(),
    ...key,
  };
  tool(
    'create_flowchart',
    'Generate and save a native flowchart from text or one base64 image. Spends the existing wallet up to max_credits. Execution may take up to 240 seconds. After timeout, read tasks or repeat the exact input/key; never change the key to recover an uncertain result.',
    ai,
    false,
    ({ idempotency_key, ...input }) =>
      generate(principal, input, idempotency_key)
  );
  tool(
    'edit_flowchart',
    'Apply a natural-language edit to an owned native diagram at its expected_version. Saves atomically and spends existing allowance. Requires diagram read, write and generate scopes. Read the diagram first; keep one idempotency key for all retries.',
    {
      ...ai,
      diagram_id: z.string().min(1).max(160),
      expected_version: z.string().regex(/^[a-f0-9]{64}$/),
    },
    false,
    ({ idempotency_key, ...input }) =>
      generate(principal, input, idempotency_key)
  );
  tool(
    'list_flowcharts',
    'List owned saved files with cursor pagination.',
    { cursor: z.string().optional() },
    true,
    ({ cursor }) => listDiagrams(principal, cursor)
  );
  tool(
    'get_flowchart',
    'Read an owned file, version hash and website editor URL.',
    { diagram_id: z.string() },
    true,
    ({ diagram_id }) => readDiagram(principal, diagram_id)
  );
  tool(
    'save_flowchart',
    'Save a native document without AI charges. For an existing diagram, provide diagram_id and its expected_version. Creates an operation receipt.',
    { ...saveSchema.shape, ...key, diagram_id: z.string().optional() },
    false,
    ({ idempotency_key, diagram_id, ...input }) =>
      save(principal, input, idempotency_key, diagram_id)
  );
  tool(
    'list_flowchart_versions',
    'List up to 50 saved version summaries, or read one native snapshot by its version hash.',
    {
      diagram_id: z.string(),
      version: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    },
    true,
    ({ diagram_id, version }) => diagramVersions(principal, diagram_id, version)
  );
  tool(
    'export_flowchart',
    'Return the editable draw.io XML or original JSON. No AI charge. Use the returned website URL to render PNG/SVG.',
    {
      diagram_id: z.string(),
      format: z.enum(['drawio', 'json']).default('drawio'),
    },
    true,
    async ({ diagram_id, format }) =>
      exportDiagram(principal, diagram_id, format)
  );
  tool(
    'get_task',
    'Read or recover an owned task receipt without starting another model generation.',
    { task_id: z.string().uuid() },
    false,
    ({ task_id }) => readTask(principal, task_id)
  );
  tool(
    'list_tasks',
    'List owned task receipts. Check these after an uncertain submission.',
    { cursor: z.string().uuid().optional() },
    true,
    ({ cursor }) => listTasks(principal, cursor)
  );
  return server;
}
export async function mcp(request: Request): Promise<Response> {
  let server: McpServer | undefined;
  try {
    const clientOrigin = request.headers.get('origin');
    if (
      clientOrigin &&
      !new Set([origin(), 'https://chatgpt.com', 'https://claude.ai']).has(
        clientOrigin
      )
    )
      throw new DeveloperError(
        'invalid_origin',
        'Untrusted MCP browser origin.',
        403
      );
    const principal = await authenticate(request, true);
    // This server has no out-of-band notifications. Do not buffer a never-ending
    // standalone SSE response in a serverless function; Streamable HTTP permits 405.
    if (request.method !== 'POST')
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    server = mcpServer(principal);
    await server.connect(transport);
    const parsedBody =
      request.method === 'POST'
        ? JSON.parse(await readBody(request))
        : undefined;
    const response = await transport.handleRequest(request, { parsedBody });
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    const response = failure(error);
    if (response.status === 401)
      response.headers.set(
        'WWW-Authenticate',
        `Bearer resource_metadata="${origin()}/.well-known/oauth-protected-resource/api/mcp"`
      );
    return response;
  } finally {
    await server?.close();
  }
}
