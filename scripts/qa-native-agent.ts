/** Explicit single-task SDK probe. Never runs as part of build/test. */
import { readFileSync, writeFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { prepareDrawioCommand } from '../src/lib/drawio/command';
import {
  drawioCommandSchema,
  drawioDocumentSchema,
} from '../src/lib/drawio/contracts';
import { nativeModelSettings } from '../src/lib/drawio/model-settings';
import { createDrawioAgent } from '../src/lib/mastra/drawio-agent';
import { getNativeModelForMode } from '../src/lib/mastra/native-model';

async function main(): Promise<void> {
  const [documentFile, promptFile, prefix] = process.argv.slice(2);
  if (!documentFile || !promptFile || !prefix)
    throw new Error(
      'Usage: tsx scripts/qa-native-agent.ts DOCUMENT_JSON PROMPT_TXT OUTPUT_PREFIX'
    );
  dotenv.config();
  dotenv.config({ path: '.env.local', override: true });
  const document = drawioDocumentSchema.parse(
    JSON.parse(readFileSync(documentFile, 'utf8'))
  );
  const prompt = readFileSync(promptFile, 'utf8');
  const agent = createDrawioAgent(document, [], prompt);
  const counts: Record<string, number> = {};
  let command: unknown;
  const trace: unknown[] = [];
  let failure: string | undefined;
  let finish: unknown;
  const start = Date.now();
  const output = await agent.stream(prompt, {
    maxSteps: 5,
    toolChoice: 'auto',
    modelSettings: nativeModelSettings(
      getNativeModelForMode('text_to_flowchart')
    ),
    abortSignal: AbortSignal.timeout(180000),
  });
  for await (const chunk of output.fullStream as AsyncIterable<any>) {
    counts[chunk.type] = (counts[chunk.type] || 0) + 1;
    if (
      chunk.type === 'tool-call' &&
      chunk.payload.toolName === 'generate_flowchart'
    )
      writeFileSync(
        `${prefix}-input.json`,
        JSON.stringify(chunk.payload.args, null, 2)
      );
    if (
      chunk.type === 'tool-result' &&
      chunk.payload.toolName === 'generate_flowchart'
    ) {
      trace.push(chunk.payload);
      const parsed = drawioCommandSchema.safeParse(chunk.payload.result);
      if (parsed.success) {
        command = parsed.data;
        failure = undefined;
      } else
        failure =
          chunk.payload.result?.message || 'Tool result was not a command';
    }
    if (chunk.type === 'tool-error' || chunk.type === 'error')
      failure = chunk.payload.error?.message || String(chunk.payload.error);
    if (chunk.type === 'finish')
      finish = {
        reason: chunk.payload.stepResult?.reason,
        usage: chunk.payload.output?.usage || chunk.payload.usage,
      };
  }
  const stats = {
    scope: 'One real SDK task; not the HTTP auth/quota path',
    elapsedMs: Date.now() - start,
    counts,
    failure,
    finish,
  };
  writeFileSync(`${prefix}-trace.json`, JSON.stringify(trace, null, 2));
  writeFileSync(`${prefix}-stats.json`, JSON.stringify(stats, null, 2));
  if (command) {
    const parsed = drawioCommandSchema.parse(command);
    const prepared = prepareDrawioCommand(document, parsed);
    writeFileSync(`${prefix}-command.json`, JSON.stringify(parsed, null, 2));
    writeFileSync(`${prefix}-document.json`, JSON.stringify(prepared, null, 2));
    console.log({
      commandValidated: true,
      operation: parsed.operation,
      xmlLength: prepared.xml.length,
      elapsedMs: stats.elapsedMs,
    });
  } else {
    console.log({ commandValidated: false, failure, counts, finish });
    process.exitCode = 1;
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'SDK task failed');
  process.exitCode = 1;
});
