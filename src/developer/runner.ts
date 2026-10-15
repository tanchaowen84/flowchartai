/** Uses the website's native Agent, command engine and full-task usage collector. */
import type { ModelCallUsage } from '@/lib/billing/policy';
import { createUsageCollector } from '@/lib/billing/usage-collector';
import { prepareDrawioCommand } from '@/lib/drawio/command';
import {
  type DrawioDocument,
  drawioCommandSchema,
} from '@/lib/drawio/contracts';
import { nativeModelSettings } from '@/lib/drawio/model-settings';
import {
  createDrawioAgent,
  nativeAgentInstructions,
} from '@/lib/mastra/drawio-agent';
import {
  createNativeModel,
  getNativeModelForMode,
} from '@/lib/mastra/native-model';
import { buildMastraRequestMessages } from '@/lib/mastra/request-builder';
import { createMastraStreamMapper } from '@/lib/mastra/stream-protocol';
import { DeveloperError, type GenerationInput } from './contract';

export interface NativeTaskResult {
  document: DrawioDocument;
  title?: string;
  calls: ModelCallUsage[];
  events: unknown[];
}
export async function runNativeTask(
  document: DrawioDocument,
  input: GenerationInput,
  legacy: boolean
): Promise<NativeTaskResult> {
  const mode = input.image ? 'image_to_flowchart' : 'text_to_flowchart';
  const modelId = getNativeModelForMode(mode);
  const collector = createUsageCollector(modelId);
  try {
    const messages = [
      {
        role: 'user',
        content: input.image
          ? [
              { type: 'text', text: input.prompt },
              { type: 'image_url', image_url: { url: input.image } },
            ]
          : input.prompt,
      },
    ];
    const agent = createDrawioAgent(document, [], input.prompt, {
      silent: true,
      safeEdits: true,
    });
    const output = await agent.stream(
      buildMastraRequestMessages({ mode, messages }) as Parameters<
        typeof agent.stream
      >[0],
      {
        model: createNativeModel(mode, {
          model: modelId,
          fetch: collector.fetch,
          billing: !legacy,
        }),
        instructions: nativeAgentInstructions(document, [], input.prompt),
        maxSteps: 5,
        toolChoice: 'auto',
        abortSignal: AbortSignal.timeout(240000),
        modelSettings: nativeModelSettings(modelId),
      }
    );
    const mapper = createMastraStreamMapper({ recoverToolErrors: true });
    let repair = false;
    let command: ReturnType<typeof drawioCommandSchema.parse> | undefined;
    let finished = false;
    for await (const chunk of output.fullStream) {
      if (
        chunk.type === 'tool-error' ||
        (chunk.type === 'tool-result' &&
          (chunk as { payload?: { result?: { error?: boolean } } }).payload
            ?.result?.error)
      )
        repair = true;
      const event = mapper.map(chunk);
      if (event?.type === 'error' || event?.type === 'aborted')
        throw new DeveloperError(
          'generation_failed',
          'The diagram could not be completed. No credits were charged.',
          502
        );
      if (event?.type === 'tool-call')
        command = drawioCommandSchema.parse(event.args);
      if (event?.type === 'finish') {
        finished = true;
        break;
      }
    }
    if (!finished || !command)
      throw new DeveloperError(
        'no_diagram',
        'The assistant did not produce a diagram command. No credits were charged.',
        422
      );
    const calls = (await collector.finish()).map((call) => ({
      ...call,
      platformFunded: repair,
    }));
    if (!calls.length)
      throw new DeveloperError(
        'missing_usage',
        'Provider usage could not be verified. No credits were charged.',
        502
      );
    return {
      document: prepareDrawioCommand(document, command),
      title: command.title,
      calls,
      events: [{ type: 'tool-call', args: command }],
    };
  } catch (error) {
    const safe =
      error instanceof DeveloperError
        ? error
        : new DeveloperError(
            'generation_failed',
            'The diagram could not be completed. No credits were charged.',
            502
          );
    Object.assign(safe, { calls: await collector.receipts() });
    throw safe;
  }
}
