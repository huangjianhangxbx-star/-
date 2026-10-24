/** Frame stepping operates inside the selected source trim range. */
export function stepFrame(start: number, seconds: number, direction: -1 | 1, end: number, sampleHz: number): number {
  const rate = Number.isFinite(sampleHz) && sampleHz > 0 ? sampleHz : 30;
  const frame = (seconds - start) * rate;
  const rounded = Math.round(frame);
  const index = Math.abs(frame - rounded) < 1e-7 ? rounded : frame;
  const next = direction > 0 ? Math.floor(index) + 1 : Math.ceil(index) - 1;
  return Math.max(start, Math.min(end, start + next / rate));
}
