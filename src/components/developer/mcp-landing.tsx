import Link from 'next/link';
import { Faq } from './api-landing';
import { Code } from './developer-docs';
const faqs = [
  [
    'Which assistants can connect?',
    'Use a client that supports a remote Streamable HTTP MCP server. OAuth clients can connect with the server URL and your consent. Clients that accept custom request headers can authenticate with an API key. Check that your client supports one of these authentication methods before adding the endpoint.',
  ],
  [
    'Do I need to install a local server?',
    'No local FlowchartAI server is required for the hosted endpoint. Your MCP client sends tool requests to FlowchartAI over HTTPS. Diagrams are stored in your FlowchartAI account and model generation runs through the hosted service. Hosted generation sends diagram context to FlowchartAI and its model service.',
  ],
  [
    'Can the assistant read every file in my account?',
    'Only grant permissions that fit the task. Diagram read permission allows the connection to list and read your saved files; generation and write permissions allow creating or changing them. A read-only key can leave generation and write permissions off. Each connection is limited to its owning account.',
  ],
  [
    'Will reconnecting restore a revoked token?',
    'No. Revoking a connection blocks its old access and refresh tokens. Connecting again creates a separate grant. Refresh tokens rotate when used, and reusing a consumed refresh token revokes that connection. You can review active and revoked connections in the developer dashboard.',
  ],
  [
    'What can I download through a tool?',
    'The export tool returns editable draw.io XML or the original JSON document. It does not require another AI generation. Open the saved file in the website editor when you need a rendered PNG or SVG for sharing. Legacy website documents remain readable as their original JSON.',
  ],
];
export function McpLanding() {
  return (
    <div
      data-developer-landing="mcp"
      className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:leading-7"
    >
      <section className="grid gap-10 pt-14 pb-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.2em] text-muted-foreground">
            Your assistant, connected to your diagrams
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            A flowchart MCP server for creating and revising real files.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Ask your assistant to draw a process, change a branch and save the
            result in FlowchartAI. Open the same editable diagram when the
            conversation turns into a review.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background"
              href="/developers/docs#mcp"
            >
              Connect your client
            </Link>
            <Link
              className="rounded-lg border px-5 py-3 text-sm font-medium"
              href="/developers"
            >
              Manage connections
            </Link>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border p-6 sm:p-8">
          <p className="text-sm font-medium">Remote MCP endpoint</p>
          <code className="my-5 block break-all rounded-lg bg-muted p-4 text-sm">
            https://flowchartai.org/api/mcp
          </code>
          <p className="text-sm text-muted-foreground">
            Streamable HTTP · OAuth with permission review
          </p>
          <div className="mt-7 border-t pt-6">
            <p className="font-medium">A useful first request</p>
            <p className="mt-3 text-sm text-muted-foreground">
              “Create an onboarding flow with signup, email verification and
              activation. Include a path to resend the verification email, use
              at most 100 credits, and give me the saved diagram link.”
            </p>
          </div>
        </div>
      </section>
      <section className="border-t py-16">
        <h2>Choose the connection your client supports</h2>
        <div className="mt-8 grid gap-7 md:grid-cols-3">
          {[
            [
              'Remote OAuth client',
              'Add the endpoint URL in a client supporting OAuth remote MCP. Sign in to FlowchartAI, review the requested permissions and approve the connection. No API key needs to be pasted into the conversation.',
            ],
            [
              'Client with custom headers',
              'Create a scoped API key and add it as an Authorization: Bearer header in the client’s MCP configuration. Keep the key in its credential settings. Each request uses the permissions and expiry you chose.',
            ],
            [
              'Server script or application',
              'Use the REST API when your integration calls HTTP directly. It exposes the same saved diagrams, generation service and task receipts, with an OpenAPI specification and a cURL Quickstart.',
            ],
          ].map(([title, text], i) => (
            <div key={title} className="border-t-2 pt-5">
              <p className="text-xs text-muted-foreground">0{i + 1}</p>
              <h3 className="mt-3 text-xl font-medium">{title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-7 text-sm">
          <Link
            className="underline underline-offset-4"
            href="/developers/docs#mcp"
          >
            Connection instructions and configuration example →
          </Link>
        </p>
      </section>
      <section className="grid gap-10 border-t py-16 md:grid-cols-[1fr_.75fr]">
        <div className="overflow-hidden rounded-2xl border bg-white p-4">
          <img
            src="https://cdn.flowchartai.org/developer/2026-10-15/mcp-onboarding-a3102734.webp"
            alt="Edited onboarding flowchart with a welcome email after account activation"
            width="410"
            height="824"
            className="mx-auto h-auto max-h-[840px] w-auto max-w-full"
            loading="lazy"
          />
        </div>
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Continue the conversation
          </p>
          <h2>Make the next change to the same diagram</h2>
          <p className="mt-5 text-muted-foreground">
            After creating the onboarding flow, ask: “Add a welcome email after
            activation.” The assistant reads the current file and sends a
            natural-language edit against that version. It can return the
            updated diagram link and editable file.
          </p>
          <p className="mt-4 text-muted-foreground">
            You can move from an assistant to the website without redrawing the
            process. Manual adjustments stay in the document, and a version
            check prevents a tool from overwriting a newer website save.
          </p>
        </div>
      </section>
      <section className="border-t py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2>Give the assistant a specific job</h2>
            <p className="mt-5 text-muted-foreground">
              A product review can start from a written user journey. An
              operations discussion can turn an escalation checklist into a
              decision flow. A developer can map the process described in a
              ticket, then attach the saved file to the handoff.
            </p>
            <p className="mt-4 text-muted-foreground">
              Include the steps, decision labels and exception paths that
              matter. Ask the assistant to read the latest diagram before making
              an edit, and review the result before treating it as an approved
              procedure.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-medium">
              Tools for the whole document workflow
            </h3>
            <Code>
              {[
                'Discover    get_capabilities · get_account',
                'Create      create_flowchart',
                'Revise      get_flowchart · edit_flowchart',
                'Organize    list_flowcharts · save_flowchart',
                'Review      list_flowchart_versions',
                'Deliver     export_flowchart',
                'Recover     get_task · list_tasks',
              ].join('\n')}
            </Code>
            <p className="text-sm text-muted-foreground">
              Tool names describe the action. Each request checks the
              connection’s permissions and file ownership on the server.
            </p>
          </div>
        </div>
      </section>
      <section className="rounded-2xl bg-muted/50 p-7 sm:p-10">
        <h2>Keep control of access and spending</h2>
        <p className="mt-5 max-w-3xl text-muted-foreground">
          A connection uses your existing FlowchartAI allowance. Creating or
          revising with AI can spend Credits or an eligible legacy request;
          manual saves, reads and native exports do not incur AI charges. Set a
          per-task maximum, then use account and credential daily budgets to
          bound recurring work.
        </p>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          The dashboard shows recent operations and lets you revoke access.
          OAuth approval is separate from website sign-in: the client receives
          scoped tokens for the MCP resource. It cannot turn that token into a
          FlowchartAI login session.
        </p>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          If a connection drops during generation, check the task receipt before
          asking for another run. Reusing the same operation key recovers the
          existing task. Failed delivery and platform corrections do not create
          an extra user charge.
        </p>
        <div className="mt-6 flex flex-wrap gap-5 text-sm underline underline-offset-4">
          <Link href="/developers">Review keys and connections</Link>
          <Link href="/pricing">See current pricing</Link>
          <Link href="/flowchart-api">Build with the REST API</Link>
        </div>
      </section>
      <Faq title="Flowchart MCP questions" items={faqs} />
      <section className="flex flex-wrap items-center justify-between gap-6 border-t pt-12">
        <div>
          <h2>Bring a process into the conversation</h2>
          <p className="mt-3 text-muted-foreground">
            Connect your client, describe the flow and inspect the saved result.
          </p>
        </div>
        <Link
          className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background"
          href="/developers/docs#mcp"
        >
          Set up MCP →
        </Link>
      </section>
    </div>
  );
}
