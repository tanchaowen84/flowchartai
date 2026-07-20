type UsageMetadata = Record<string, unknown>;
type UsageRecorder = (metadata: UsageMetadata) => Promise<unknown> | unknown;

export interface CanvasUsageGate {
  commit: (metadata: UsageMetadata) => Promise<boolean>;
  fail: () => void;
  abort: () => void;
}

export function createCanvasUsageGate(
  recordUsage: UsageRecorder
): CanvasUsageGate {
  let closed = false;
  let recorded = false;

  return {
    async commit(metadata): Promise<boolean> {
      if (closed || recorded) return false;
      recorded = true;
      await recordUsage(metadata);
      return true;
    },
    fail(): void {
      closed = true;
    },
    abort(): void {
      closed = true;
    },
  };
}
