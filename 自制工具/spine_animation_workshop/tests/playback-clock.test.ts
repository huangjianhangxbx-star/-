import assert from 'node:assert/strict';
import test from 'node:test';
import { playbackAt } from '../src/ui/playback-clock.ts';

test('loop playback wraps within the selected range, including delayed frames spanning several cycles', () => {
  assert.deepEqual(playbackAt(4, 1.5, [2, 5], true), { seconds: 2.5, finished: false });
  assert.deepEqual(playbackAt(4, 10.5, [2, 5], true), { seconds: 2.5, finished: false });
  assert.deepEqual(playbackAt(2, 3, [2, 5], true), { seconds: 2, finished: false });
});

test('one-shot playback stops at the last frame and an empty range never loops', () => {
  assert.deepEqual(playbackAt(4, 1.5, [2, 5], false), { seconds: 5, finished: true });
  assert.deepEqual(playbackAt(2, 1, [2, 5], false), { seconds: 3, finished: false });
  assert.deepEqual(playbackAt(2, 5, [2, 2], true), { seconds: 2, finished: true });
});
