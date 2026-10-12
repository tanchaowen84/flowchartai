/** Explicit whole-diagram intent is required before the Agent can replace. */
export function allowsNativeRebuild(request: string): boolean {
  const pattern =
    /(?:重新生成|重新绘制|重画|重建|从头生成|从头绘制)(?:这|整个|整张|全|全部|这张|一张|整个流程|完整流程|流程图|图表|图)|(?:rebuild|redraw|recreate)\s+(?:(?:the|this)\s+)?(?:entire|whole|full)\s+(?:diagram|flowchart)|start\s+over/gi;
  for (const match of request.matchAll(pattern)) {
    const preceding = request.slice(
      Math.max(0, match.index! - 20),
      match.index
    );
    if (
      !/(?:不要|无需|不用|不必|不能|别|don.t|do\s+not|without|not)\s*(?:\w+\s+){0,2}$/i.test(
        preceding
      )
    )
      return true;
  }
  return false;
}
