import Link from 'next/link';
import { Code } from './developer-docs';
const request = `curl https://flowchartai.org/api/v1/generations \\
  -H "Authorization: Bearer $FLOWCHART_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: onboarding-001' \\
  -d '{
    "prompt": "Map signup, email verification and activation, including a resend email branch.",
    "max_credits": 100
  }'`;
const faqs = [
  [
    'Can I generate a flowchart from an image?',
    'Yes. Include one PNG, JPEG or WebP as a base64 data URI with your prompt. The decoded image must be no larger than 2 MB. This works best with a legible diagram or screenshot. The API returns editable native shapes, so review the recognized labels and branches before sharing it.',
  ],
  [
    'What happens if a request times out?',
    'Each write has an idempotency key. Repeat the same request and key, or read its task receipt, to find the existing result. A duplicate does not start another generation. A prepared result can finish saving without a new model call. Check the terminal receipt before starting a fresh operation.',
  ],
  [
    'Can I use Python or JavaScript?',
    'Yes. This is a standard JSON-over-HTTPS REST API with a downloadable OpenAPI specification. Any language with an HTTP client can authenticate, generate diagrams and download files. The Quickstart uses cURL and jq so you can verify the workflow before adding it to your own application.',
  ],
  [
    'How do I protect a production API key?',
    'Keep the key on your server, give it only the permissions it needs, and set an expiry and daily budget. The complete secret is displayed once. Rotate it from the dashboard when replacing credentials, or revoke it to stop access immediately. An API key cannot create a website login session.',
  ],
  [
    'Can an assistant use the same diagrams through MCP?',
    'Yes. The remote MCP endpoint uses the same account, saved files and task services. OAuth clients request your permission through FlowchartAI; clients with custom headers can use a scoped key. Open the MCP connection page for the correct setup for your client.',
  ],
];
export function ApiLanding() {
  return (
    <div
      data-developer-landing="api"
      className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:leading-7"
    >
      <section className="grid gap-10 pt-14 pb-16 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-24">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.2em] text-muted-foreground">
            FlowchartAI for developers
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            A flowchart API for diagrams you can keep editing.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Turn process descriptions into saved, editable draw.io diagrams.
            Generate from your app, change a branch with another request, then
            open the same file to finish it by hand.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background"
              href="/developers"
            >
              Create an API key
            </Link>
            <Link
              className="rounded-lg border px-5 py-3 text-sm font-medium"
              href="/developers/docs#quickstart"
            >
              Read the Quickstart
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Uses your existing FlowchartAI allowance. Set a maximum for each AI
            request.
          </p>
        </div>
        <div className="min-w-0">
          <div className="rounded-t-xl border border-b-0 px-5 py-3 text-xs text-muted-foreground">
            POST /api/v1/generations
          </div>
          <div className="[&_pre]:mt-0 [&_pre]:rounded-t-none">
            <Code>{request}</Code>
          </div>
          <Link
            className="text-sm underline underline-offset-4"
            href="/api/v1/openapi.json"
          >
            Download the OpenAPI specification ↗
          </Link>
        </div>
      </section>
      <section className="border-t py-16">
        <div className="grid gap-8 md:grid-cols-[.65fr_1fr]">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              From a description to a working file
            </p>
            <h2>One request. A diagram your team can change.</h2>
            <p className="mt-5 text-muted-foreground">
              The onboarding example maps signup, email verification, an
              resend-email branch and activation. Its output is a native
              document with separate shapes and connectors. You can rename a
              step, restyle a decision or move a branch in the editor.
            </p>
            <p className="mt-4 text-muted-foreground">
              The response includes the saved diagram ID, a version hash and an
              editor link. Keep those with your source material so the next
              revision has a clear starting point.
            </p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border bg-white p-4">
            <img
              src="https://cdn.flowchartai.org/developer/2026-10-15/api-onboarding-01aa63ad.webp"
              alt="Generated onboarding flowchart with email verification and a path to resend the email"
              width="410"
              height="676"
              className="mx-auto h-auto max-h-[800px] w-auto max-w-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>
      <section className="border-t py-16">
        <h2>Build diagram creation into the work you already do</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            [
              'Product documentation',
              'Turn a written feature brief into a first process map. Keep the API response with the brief, review the decisions with a teammate, and carry approved changes into the same editable file.',
            ],
            [
              'Operations playbooks',
              'Convert a checklist into a flow with owners, handoffs and exception paths. When a procedure changes, send the current file and the requested change instead of rebuilding the diagram from scratch.',
            ],
            [
              'Agent-assisted development',
              'Give a script or coding assistant a diagram task alongside a ticket. Save the result in your account and use its editor URL in the handoff. People can inspect the actual document before making the next change.',
            ],
          ].map(([title, text]) => (
            <div key={title} className="border-l-2 pl-5">
              <h3 className="text-lg font-medium">{title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-10 border-t py-16 md:grid-cols-2">
        <div>
          <h2>Revise the process without losing the current file</h2>
          <p className="mt-5 text-muted-foreground">
            Read a saved diagram, then describe the change: “Add a welcome email
            after activation” or “Send an expired link back to verification.” A
            natural-language edit starts from the existing native document.
          </p>
          <p className="mt-4 text-muted-foreground">
            Every edit includes the file's current version. If someone has saved
            a newer copy on the website, the API asks you to read it again
            before applying changes. API and MCP saves capture versions you can
            inspect later.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-medium">
            Choose the output your next step needs
          </h3>
          <dl className="mt-5 divide-y">
            <div className="py-4">
              <dt className="font-medium">Editable draw.io file</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Download native XML for continued diagram editing.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium">Native JSON document</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Read and save the document, revision and diagram type in your
                integration.
              </dd>
            </div>
            <div className="py-4">
              <dt className="font-medium">PNG and SVG from the editor</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Follow the returned editor link to render an image for a
                document, deck or review.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="rounded-2xl bg-muted/50 p-7 sm:p-10">
        <h2>Put a budget around automation</h2>
        <p className="mt-5 max-w-3xl text-muted-foreground">
          Each AI request carries a credit maximum. Charges use the complete
          task's model usage and stay within the accepted reservation. Failed
          delivery and platform corrections do not add another user charge.
          Manual saves, reads and exports are free of AI charges.
        </p>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Set account and key daily budgets in one dashboard, review recent task
          receipts and revoke unused credentials. Your current Credits or
          eligible legacy subscription allowance continues to apply.
        </p>
        <div className="mt-6 flex flex-wrap gap-5 text-sm underline underline-offset-4">
          <Link href="/pricing">View current pricing</Link>
          <Link href="/developers">Manage developer access</Link>
        </div>
      </section>
      <Faq title="Flowchart API questions" items={faqs} />
      <section className="flex flex-wrap items-center justify-between gap-6 border-t pt-12">
        <div>
          <h2>Try one process from your own workflow</h2>
          <p className="mt-3 text-muted-foreground">
            Start with a scoped key and a small, specific description.
          </p>
        </div>
        <Link
          className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background"
          href="/developers/docs#quickstart"
        >
          Open the Quickstart →
        </Link>
      </section>
    </div>
  );
}
export function Faq({ title, items }: { title: string; items: string[][] }) {
  return (
    <section className="py-16">
      <h2>{title}</h2>
      <div className="mt-7 divide-y">
        {items.map(([question, answer]) => (
          <details key={question} className="group py-5">
            <summary className="cursor-pointer list-none pr-7 text-lg font-medium">
              {question}
              <span className="float-right text-muted-foreground group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-4 max-w-3xl text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Static FAQ copy, serialized and escaped for JSON-LD.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map(([question, answer]) => ({
              '@type': 'Question',
              name: question,
              acceptedAnswer: { '@type': 'Answer', text: answer },
            })),
          }).replace(/</g, '\\u003c'),
        }}
      />
    </section>
  );
}
