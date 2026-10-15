import Link from 'next/link';
const create = `curl --max-time 300 https://flowchartai.org/api/v1/generations \\
  -H "Authorization: Bearer $FLOWCHART_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: onboarding-flow-001' \\
  -d '{"prompt":"Map signup, email verification and activation, including an expired-link retry.","max_credits":100}' \\
  > task.json

jq '{id,state,charged_credits,diagram}' task.json`;
const edit = `ID=$(jq -r '.diagram_id' task.json)
VERSION=$(jq -r '.diagram.version' task.json)

jq -n --arg id "$ID" --arg version "$VERSION" \\
  '{diagram_id:$id,expected_version:$version,
    prompt:"Add a welcome email after activation.",max_credits:100}' \\
  > edit.json

curl --max-time 300 https://flowchartai.org/api/v1/generations \\
  -H "Authorization: Bearer $FLOWCHART_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: onboarding-edit-001' \\
  --data-binary @edit.json > edited-task.json

curl "https://flowchartai.org/api/v1/diagrams/$ID/export?format=drawio" \\
  -H "Authorization: Bearer $FLOWCHART_API_KEY" \\
  -o onboarding.drawio`;
const custom = `{
  "mcpServers": {
    "flowchartai": {
      "url": "https://flowchartai.org/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_FLOWCHARTAI_KEY" }
    }
  }
}`;
export function Code({ children }: { children: string }) {
  return (
    <pre className="my-5 overflow-x-auto rounded-xl border bg-muted/40 p-5 text-xs leading-6 sm:text-sm">
      <code>{children}</code>
    </pre>
  );
}
export function DeveloperDocs() {
  return (
    <article className="mx-auto max-w-4xl px-5 py-14 sm:py-20 [&_h2]:mt-14 [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-muted-foreground">
      <p className="text-sm">FlowchartAI developer documentation · v1</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Generate a diagram. Keep it editable.
      </h1>
      <p>
        Use the REST API from your application or connect an MCP client. Both
        use the same saved diagrams, account allowance and developer budgets.
      </p>
      <nav className="mt-6 flex flex-wrap gap-4 text-sm underline">
        <a href="#quickstart">REST Quickstart</a>
        <a href="#mcp">MCP connection</a>
        <a href="#reference">Endpoint reference</a>
        <Link href="/api/v1/openapi.json">OpenAPI JSON ↗</Link>
        <Link href="/developers">Manage keys →</Link>
      </nav>
      <h2 id="quickstart">1. Create a scoped API key</h2>
      <p>
        Sign in to the{' '}
        <Link className="text-foreground underline" href="/developers">
          developer dashboard
        </Link>
        . Create a key with <code>diagrams:generate</code> and{' '}
        <code>diagrams:write</code>; add read, export, task and account
        permissions for the complete workflow. Copy the key once and store it as
        a server environment variable. Send <code>Authorization: Bearer …</code>{' '}
        or <code>X-API-Key</code>. Keys cannot log in to the website.
      </p>
      <h2>2. Generate and save</h2>
      <p>
        Set <code>FLOWCHART_API_KEY</code> in your shell, then run this request
        with cURL and jq. Choose a unique idempotency key for each new operation
        and keep it unchanged for retries. The successful response includes the
        saved file, a content version and a link to its website editor.
      </p>
      <Code>{create}</Code>
      <h2>3. Edit, reopen and export</h2>
      <p>
        To edit an existing diagram, send its ID and latest{' '}
        <code>expected_version</code>. The version covers changes made in the
        website, too. A stale version returns <code>409 version_conflict</code>.
        read the file again and review it before retrying with a new operation
        key. Successful edits are saved automatically.
      </p>
      <Code>{edit}</Code>
      <p>
        Open <code>diagram.open_url</code> to continue editing on the website.
        API exports return editable draw.io XML or the original JSON. The
        website editor also renders SVG and PNG. Read, manual save and export do
        not incur AI charges.
      </p>
      <h2>Task states and uncertain responses</h2>
      <p>
        Generation executes synchronously for up to 240 seconds. A request may
        take several model steps. Its receipt is persisted before execution.
        States are <code>running → prepared → succeeded</code>, or{' '}
        <code>failed</code>. A concurrent duplicate returns the current receipt
        and starts no second model call. List <code>/tasks</code>, read{' '}
        <code>/tasks/ID</code>, or repeat the exact request and key after a
        timeout. Reading a prepared receipt can finish delivery without
        regenerating. An interrupted running task becomes failed after six
        minutes when read. Start a new operation only after checking the
        terminal receipt.
      </p>
      <h2>Usage, limits and charges</h2>
      <p>
        AI operations share your existing Credits or eligible legacy
        subscription allowance. Every generation requires{' '}
        <code>max_credits</code>, between 1 and 2,000. The server may reserve
        less using the full prompt, image and native-document context. A cap
        below this estimate returns 409 with required_credits before generation;
        review the amount before increasing your cap. The receipt retains
        budget_credits and reports the active reservation and actual charge.
        Full-task usage includes every model call. Settlement never exceeds the
        accepted reservation. Failed delivery and platform corrections do not
        create an extra user charge.
      </p>
      <p>
        The account and credential each have daily credit and AI-request
        budgets, resetting at 00:00 UTC. Active reservations count toward the
        credit budget. The account is limited to 120 authenticated requests per
        minute across all credentials. A key defaults to 60 requests per minute;
        its owner can choose up to 120. API, MCP and website AI tasks share the
        wallet's single active-task rule. A rate or budget limit returns 429;
        wait for its reset instead of cycling keys. See the current allowance on{' '}
        <Link className="text-foreground underline" href="/pricing">
          Pricing
        </Link>
        .
      </p>
      <h2 id="mcp">Connect an MCP client</h2>
      <p>
        Remote endpoint:{' '}
        <code className="break-all">https://flowchartai.org/api/mcp</code>.
        Transport: Streamable HTTP. Add this URL to a client supporting remote
        MCP and OAuth. It opens FlowchartAI sign-in and a permission screen;
        review the app name, return destination and permissions before allowing
        it. Revoke connections from the developer dashboard.
      </p>
      <p>
        For clients supporting custom request headers, use an API key.
        Configuration syntax varies by client; this is a common JSON shape. Keep
        the key in the client's secret store when available.
      </p>
      <Code>{custom}</Code>
      <p>
        Discovery: <code>/.well-known/oauth-protected-resource/api/mcp</code>{' '}
        and <code>/.well-known/oauth-authorization-server</code>. The server
        supports dynamic public-client registration, authorization-code PKCE
        S256, exact registered redirects and resource{' '}
        <code className="break-all">https://flowchartai.org/api/mcp</code>.
        Access tokens last 10 minutes. Request <code>offline_access</code> for a
        rotating refresh token lasting up to 30 days. Refresh reuse revokes the
        connection. Dashboard revocation blocks both token types immediately.
        OAuth tokens are accepted only by MCP.
      </p>
      <p>
        Tools: <code>get_capabilities</code>, <code>get_account</code>,{' '}
        <code>create_flowchart</code>, <code>edit_flowchart</code>,{' '}
        <code>list_flowcharts</code>, <code>get_flowchart</code>,{' '}
        <code>save_flowchart</code>, <code>list_flowchart_versions</code>,{' '}
        <code>export_flowchart</code>, <code>get_task</code>,{' '}
        <code>list_tasks</code>. Ask the assistant to read the latest file
        before editing, set a credit maximum and keep the operation key stable
        after an uncertain response.
      </p>
      <h2 id="reference">REST endpoint reference</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-3 pr-4">Endpoint</th>
              <th className="py-3">Permission / purpose</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                'GET /capabilities',
                'Authenticated · formats and execution rules',
              ],
              ['GET /account', 'account:read · wallet and budgets'],
              [
                'POST /generations',
                'diagrams:generate + diagrams:write · create; also diagrams:read to edit',
              ],
              ['GET /tasks, /tasks/{id}', 'tasks:read · durable receipts'],
              [
                'GET /diagrams, /diagrams/{id}',
                'diagrams:read · files and content hash',
              ],
              ['POST /diagrams', 'diagrams:write · save a new native document'],
              [
                'PUT /diagrams/{id}',
                'diagrams:write · save with expected_version',
              ],
              [
                'GET /diagrams/{id}/versions',
                'diagrams:read · up to 50 captured versions',
              ],
              [
                'GET /diagrams/{id}/export',
                'diagrams:export · format=drawio or json',
              ],
            ].map(([path, purpose]) => (
              <tr key={path} className="border-b">
                <td className="py-3 pr-4 font-mono text-xs">{path}</td>
                <td className="py-3 text-muted-foreground">{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Paths are relative to <code>/api/v1</code>. Lists return 20 records and
        an optional <code>next_cursor</code>. Every write requires{' '}
        <code>Idempotency-Key</code>. A manual save body is{' '}
        <code>{'{"title":"…","document":{…},"expected_version":"…"}'}</code>.
        Omit the version for a new file. Follow OpenAPI's{' '}
        <code>NativeDocument</code> schema. Native XML is limited to 2 MB and
        2,000 objects. Images are one base64 PNG, JPEG or WebP of at most 2 MB;
        arbitrary image URLs are not fetched. Legacy files remain readable and
        exportable as JSON; native AI editing requires draw.io format.
      </p>
      <h2>Errors and recovery</h2>
      <p>
        Errors use <code>{'{"error":{"code":"…","message":"…"}}'}</code>. 401:
        invalid, expired or revoked credential. 403: missing permission or
        unavailable account. 402: insufficient Credits. 409: busy task, changed
        file or conflicting idempotency key. 413: oversized input. 422:
        unsupported format or no usable diagram. 429: rate or daily budget
        limit. 502/503: upstream or database unavailable. Never put prompts, API
        keys or tokens in URLs or client logs.
      </p>
      <p>
        Rotating a key immediately revokes its old secret. Reconnecting OAuth
        creates a new grant and cannot reactivate revoked tokens. Task IDs,
        response states and content hashes let you reconcile results
        independently of a network response.
      </p>
    </article>
  );
}
