import {describe, expect, it} from 'vitest';
import {AttackInput, EventTrack} from '../../src/action-lab/runtime/kernel';

describe('AL01 independent input contract', () => {
  it('overwrites one edge and release preserves its unscaled deadline', () => {
    const input = new AttackInput(.25);
    input.press(1); input.release(); input.press(1.1); input.release();
    expect(input.request(1.3)).toBe(true);
    expect(input.request(1.36)).toBe(false);
  });
  it('failed acceptance leaves the edge until expiry, success consumes it', () => {
    const input = new AttackInput(.25);
    input.press(1); input.release();
    expect(input.request(1.2)).toBe(true);
    input.accept();
    expect(input.request(1.21)).toBe(false);
  });
  it('held retries without growing a queue; release does not cancel an action', () => {
    const input = new AttackInput(.25);
    input.press(1); input.accept();
    expect(input.request(3)).toBe(true);
    input.release();
    expect(input.request(3.01)).toBe(false);
  });
  it('blur/pause clears both held and edge', () => {
    const input = new AttackInput(.25); input.press(1); input.clear();
    expect(input.request(1.1)).toBe(false);
  });
});

describe('AL01 one authority for action events', () => {
  // Fixture event times are literal test conditions, not missing original parameters.
  const events = [{at: 0, kind: 'Dash'}, {at: .0333, kind: 'Hit'}, {at: .2, kind: 'Break'}, {at: .2333, kind: 'End'}];
  it('low frame rate crosses every event once and separates End from finish', () => {
    const track = new EventTrack(events, .7333, 1);
    expect(track.advance(.25, 1).map(e => e.kind)).toEqual(['Dash','Hit','Break','End']);
    expect(track.finished).toBe(false);
    expect(track.advance(.1, 1)).toEqual([]);
    track.advance(.5, 1);
    expect(track.finished).toBe(true);
  });
  it('uses action rate on the supplied simulation delta', () => {
    const track = new EventTrack(events, .7333, 1, 2);
    expect(track.advance(.1, 1).map(e => e.kind)).toEqual(['Dash','Hit','Break']);
    expect(track.time).toBeCloseTo(.2);
  });
  it('cancellation or a changed world generation cannot emit a late hit', () => {
    const canceled = new EventTrack(events, .7333, 1); canceled.cancel();
    expect(canceled.advance(.3, 1)).toEqual([]);
    const stale = new EventTrack(events, .7333, 1);
    expect(stale.advance(.3, 2)).toEqual([]);
  });
  it('rejects malformed event contracts instead of silently inventing timing', () => {
    expect(() => new EventTrack([{at: Number.NaN,kind:'Hit'}],1,1)).toThrow();
    expect(() => new EventTrack([{at: 2,kind:'Hit'}],1,1)).toThrow();
    expect(() => new EventTrack(events,1,0)).toThrow();
  });
});
