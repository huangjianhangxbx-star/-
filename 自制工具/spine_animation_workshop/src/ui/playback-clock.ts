/** Both previews share one clock; delayed frames wrap without drifting between cycles. */
export function playbackAt(from: number, elapsed: number, range: readonly [number, number], loop: boolean): { seconds: number; finished: boolean } {
  const [start, end] = range;
  const duration = end - start;
  if (duration <= 0) return { seconds: start, finished: true };
  const position = Math.max(start, from + elapsed);
  return loop
    ? { seconds: start + (position - start) % duration, finished: false }
    : { seconds: Math.min(position, end), finished: position >= end };
}
