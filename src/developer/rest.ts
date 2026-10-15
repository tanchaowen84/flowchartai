import { authenticate } from './access';
import { DeveloperError } from './contract';
import {
  diagramVersions,
  exportDiagram,
  listDiagrams,
  readDiagram,
} from './diagrams';
import { failure, json, readBody } from './http';
import {
  account,
  capabilities,
  generate,
  listTasks,
  readTask,
  save,
} from './service';

export async function rest(
  request: Request,
  path: string[]
): Promise<Response> {
  try {
    const principal = await authenticate(request);
    const method = request.method;
    const url = new URL(request.url);
    const key = request.headers.get('idempotency-key') || '';
    if (method === 'GET' && path.join('/') === 'capabilities')
      return json(capabilities);
    if (method === 'GET' && path.join('/') === 'account')
      return json(await account(principal));
    if (method === 'POST' && path.join('/') === 'generations')
      return json(
        await generate(principal, JSON.parse(await readBody(request)), key)
      );
    if (path[0] === 'tasks') {
      if (method === 'GET' && path.length === 1)
        return json(
          await listTasks(
            principal,
            url.searchParams.get('cursor') || undefined
          )
        );
      if (method === 'GET' && path.length === 2)
        return json(await readTask(principal, path[1]));
    }
    if (path[0] === 'diagrams') {
      if (method === 'GET' && path.length === 1)
        return json(
          await listDiagrams(
            principal,
            url.searchParams.get('cursor') || undefined
          )
        );
      if (method === 'POST' && path.length === 1)
        return json(
          await save(principal, JSON.parse(await readBody(request)), key),
          201
        );
      if (method === 'GET' && path.length === 2)
        return json(await readDiagram(principal, path[1]));
      if (method === 'PUT' && path.length === 2)
        return json(
          await save(
            principal,
            JSON.parse(await readBody(request)),
            key,
            path[1]
          )
        );
      if (method === 'GET' && path.length === 3 && path[2] === 'versions')
        return json(
          await diagramVersions(
            principal,
            path[1],
            url.searchParams.get('version') || undefined
          )
        );
      if (method === 'GET' && path.length === 3 && path[2] === 'export') {
        const output = await exportDiagram(
          principal,
          path[1],
          url.searchParams.get('format') || 'drawio'
        );
        return new Response(output.body, {
          headers: {
            'Content-Type': output.contentType,
            'Content-Disposition': `attachment; filename="${output.filename}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }
    throw new DeveloperError('not_found', 'API route not found.', 404);
  } catch (error) {
    return failure(error);
  }
}
