/** Real HTTP/R2/DB acceptance using isolated short-lived QA users, never a customer's session. */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';

const base = process.env.QA_BASE_URL || 'http://localhost:3108';
const statePath = process.env.QA_STATE_PATH || '/tmp/flowchart-r2-qa.json';
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
interface State {
  userId: string;
  otherUserId: string;
  token: string;
  otherToken: string;
  chartId?: string;
}
async function main(): Promise<void> {
  let state: State;
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    state = {
      userId: `r2qa_${randomUUID()}`,
      otherUserId: `r2qa_${randomUUID()}`,
      token: randomUUID(),
      otherToken: randomUUID(),
    };
  }
  if (process.argv.includes('--cleanup')) {
    for (const id of [state.userId, state.otherUserId]) {
      if (!id.startsWith('r2qa_')) throw new Error('Not a QA user');
      await sql`delete from public.flowcharts where user_id=${id}`;
      await sql`delete from public.session where user_id=${id}`;
      await sql`delete from public."user" where id=${id}`;
    }
    console.log('QA users, sessions and diagrams removed');
    return;
  }
  for (const [id, token] of [
    [state.userId, state.token],
    [state.otherUserId, state.otherToken],
  ]) {
    await sql`insert into public."user" (id,name,email,email_verified,created_at,updated_at) values (${id},'R2 storage acceptance',${`${id}@example.invalid`},true,now(),now()) on conflict(id) do nothing`;
    await sql`insert into public.session (id,token,user_id,created_at,updated_at,expires_at) values (${`session_${id}`},${token},${id},now(),now(),now()+interval '6 hours') on conflict(id) do nothing`;
  }
  const cookie = (token: string): string => {
    const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
      .update(token)
      .digest('base64');
    return `__Secure-better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
  };
  await writeFile(
    statePath,
    JSON.stringify({
      ...state,
      cookie: cookie(state.token),
      otherCookie: cookie(state.otherToken),
    }),
    { mode: 0o600 }
  );
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = state.token
  ): Promise<Response> =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        Cookie: token ? cookie(token) : '',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#115e59"/><text x="24" y="70" font-size="24" fill="white">R2 storage QA</text></svg>';
  const dataURL = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const scene = {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [
      {
        type: 'image',
        id: 'r2-image',
        x: 100,
        y: 100,
        width: 480,
        height: 240,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: 'a0',
        roundness: null,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        status: 'saved',
        fileId: 'r2-image-file',
        scale: [1, 1],
        crop: null,
      },
    ],
    files: {
      'r2-image-file': {
        id: 'r2-image-file',
        dataURL,
        mimeType: 'image/svg+xml',
        created: 1,
      },
    },
    flowchartAi: { qa: 'preserve' },
  };
  const created = await request('/api/flowcharts', 'POST', {
    title: 'R2 storage QA',
    content: JSON.stringify(scene),
    thumbnail: dataURL,
  });
  assert.equal(created.status, 201, `Create: ${await created.clone().text()}`);
  state.chartId = (await created.json()).id;
  await writeFile(
    statePath,
    JSON.stringify({
      ...state,
      cookie: cookie(state.token),
      otherCookie: cookie(state.otherToken),
    }),
    { mode: 0o600 }
  );
  const [stored] =
    await sql`select content,thumbnail from public.flowcharts where id=${state.chartId!}`;
  assert.ok(stored.content.includes('r2asset:v1:'));
  assert.ok(!stored.content.includes('base64'));
  assert.ok(stored.thumbnail.startsWith('r2asset:v1:'));
  const detail = await request(`/api/flowcharts/${state.chartId}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(JSON.parse((await detail.json()).content), scene);
  const list = await request('/api/flowcharts');
  assert.equal(list.status, 200);
  const item = (await list.json()).flowcharts.find(
    (row: { id: string }) => row.id === state.chartId
  );
  assert.ok(item && !('content' in item));
  const thumb = await request(item.thumbnail);
  assert.equal(thumb.status, 200);
  assert.equal(await thumb.text(), svg);
  assert.match(thumb.headers.get('content-security-policy') || '', /sandbox/);
  assert.equal(
    (await request(item.thumbnail, 'GET', undefined, '')).status,
    401
  );
  assert.equal(
    (await request(item.thumbnail, 'GET', undefined, state.otherToken)).status,
    404
  );
  assert.equal(
    (
      await request(
        `/api/flowcharts/${state.chartId}`,
        'GET',
        undefined,
        state.otherToken
      )
    ).status,
    404
  );
  const edited = await request(`/api/flowcharts/${state.chartId}`, 'PUT', {
    title: 'R2 storage QA edited',
    content: JSON.stringify(scene),
    thumbnail: dataURL,
  });
  assert.equal(edited.status, 200);
  const after = await request(`/api/flowcharts/${state.chartId}`);
  assert.deepEqual(JSON.parse((await after.json()).content), scene);
  console.log(
    JSON.stringify({
      status: 'PASS',
      base,
      checks: [
        'create',
        'private-r2-reference',
        'exact-file-readback',
        'metadata-preserved',
        'list-no-content',
        'thumbnail-bytes',
        'anonymous-401',
        'cross-user-404',
        'edit-and-reopen',
      ],
      chartId: state.chartId,
    })
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Acceptance failed');
    process.exitCode = 1;
  })
  .finally(() => sql.end());
