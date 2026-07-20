interface GuardInput {
  latestUserPrompt?: string;
}

interface GuardDependencies<T> {
  getSession: () => Promise<{ user?: { id?: string } } | null>;
  checkUsage: (userId: string) => Promise<{
    canUse: boolean;
    remainingUsage?: number;
    limit?: number;
    [key: string]: unknown;
  }>;
  moderate: (
    prompt: string,
    userId: string
  ) => Promise<{ decision: 'allow' | 'deny' | 'flag' }>;
  invokeAgent: (userId: string) => Promise<T>;
}

export interface GuardRejection {
  ok: false;
  status: number;
  body: Record<string, unknown>;
}

export interface GuardSuccess<T> {
  ok: true;
  userId: string;
  value: T;
}

export async function runGuardedFlowchartAgent<T>(
  input: GuardInput,
  dependencies: GuardDependencies<T>
): Promise<GuardRejection | GuardSuccess<T>> {
  const session = await dependencies.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Authentication required',
        message: 'Please sign in to use AI-powered flowchart generation.',
        isGuest: true,
        redirectTo: '/auth/login',
      },
    };
  }

  const usage = await dependencies.checkUsage(userId);
  if (!usage.canUse) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'Usage limit exceeded',
        message: `You have reached your AI usage limit. ${usage.remainingUsage ?? 0} of ${usage.limit ?? 0} requests remaining.`,
        usageInfo: usage,
      },
    };
  }

  if (input.latestUserPrompt) {
    let moderation: { decision: 'allow' | 'deny' | 'flag' };
    try {
      moderation = await dependencies.moderate(input.latestUserPrompt, userId);
    } catch {
      return {
        ok: false,
        status: 503,
        body: {
          error: 'moderation_unavailable',
          message:
            'We could not complete safety screening for your prompt right now. Please try again in a moment.',
        },
      };
    }

    if (moderation.decision === 'deny' || moderation.decision === 'flag') {
      return {
        ok: false,
        status: 400,
        body: {
          error:
            moderation.decision === 'deny'
              ? 'prompt_rejected'
              : 'prompt_flagged',
          message:
            moderation.decision === 'deny'
              ? 'Your prompt was rejected by our safety screening. Please revise it and try again.'
              : 'Your prompt could not be processed by our safety screening. Please revise it and try again.',
          moderationDecision: moderation.decision,
        },
      };
    }
  }

  const value = await dependencies.invokeAgent(userId);
  return { ok: true, userId, value };
}
