import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { AnimationState, AnimationStateData, AtlasAttachmentLoader, Physics, Skeleton, SkeletonJson, TextureAtlas } from '@esotericsoftware/spine-webgl';
import type { DriverFrame } from '../src/core/contracts.ts';
import { appendAnimation } from '../src/output/spine43-animation.ts';
import { readSpineTarget } from '../src/target/spine-target.ts';
import { applyDriverFrameToSkeleton } from '../src/preview/live-frame-preview.ts';

const packed = fileURLToPath(new URL('../../../work/SPW-01/inputs/rozeul/packed/', import.meta.url));
const jsonFile = join(packed, 'rozeul.json');
const atlasFile = join(packed, 'rozeul.atlas');

test('live current frame matches the official runtime timeline with direction display beneath it', {
  skip: !existsSync(jsonFile) || !existsSync(atlasFile),
}, () => {
  const original = readFileSync(jsonFile, 'utf8');
  const { document, summary } = readSpineTarget(original);
  const frame: DriverFrame = { seconds: 0, diagnostics: [], keys: [
    { target: 'root', property: 'rotation', value: 18 },
    { target: 'root', property: 'scaleX', value: 1.05 },
    { target: 'LlegIK_hips', property: 'x', value: 20 },
    { target: 'LlegIK_hips', property: 'y', value: -7 },
  ] };
  const generated = appendAnimation(document, { name: 'SPW_live_frame_probe', durationSeconds: 0.5, frames: [frame] });
  const atlas = new TextureAtlas(readFileSync(atlasFile, 'utf8'));
  const loader = new AtlasAttachmentLoader(atlas);
  const originalData = new SkeletonJson(loader).readSkeletonData(original);
  const generatedData = new SkeletonJson(loader).readSkeletonData(generated.jsonText);
  const display = summary.animations[0];

  const official = new Skeleton(generatedData);
  official.setupPose();
  const officialState = new AnimationState(new AnimationStateData(generatedData));
  if (display) officialState.setAnimation(0, display, true);
  officialState.setAnimation(1, generated.name, false);
  officialState.update(0.25);
  officialState.apply(official);
  official.updateWorldTransform(Physics.reset);

  const live = new Skeleton(originalData);
  live.setupPose();
  const displayState = new AnimationState(new AnimationStateData(originalData));
  if (display) displayState.setAnimation(0, display, true);
  displayState.update(0.25);
  displayState.apply(live);
  applyDriverFrameToSkeleton(live, frame);
  live.updateWorldTransform(Physics.reset);

  for (const name of ['root', 'LlegIK_hips']) {
    const expected = official.findBone(name)?.appliedPose;
    const actual = live.findBone(name)?.appliedPose;
    assert.ok(expected && actual);
    for (const key of ['worldX', 'worldY', 'a', 'c'] as const) {
      assert.ok(Math.abs(actual[key] - expected[key]) < 1e-4, `${name}.${key}: ${actual[key]} vs ${expected[key]}`);
    }
  }
});
