import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const realGlb = new URL('../../../work/SPW-01/inputs/CesiumMan.glb', import.meta.url);

function glbWithJoints(options: { animation?: boolean; duplicateNames?: boolean } = {}): ArrayBuffer {
  const animation = options.animation ?? true;
  const bin = Buffer.alloc(32);
  bin.writeFloatLE(0, 0);
  bin.writeFloatLE(1, 4);
  [5, 0, 0, 6, 0, 0].forEach((value, index) => bin.writeFloatLE(value, 8 + index * 4));

  const gltf: Record<string, unknown> = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Armature', children: options.duplicateNames ? [1, 2] : [1] },
      { name: 'Joint', translation: [1, 0, 0] },
      ...(options.duplicateNames ? [{ name: 'Joint' }] : []),
    ],
    skins: [{ joints: options.duplicateNames ? [1, 2] : [1] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 24 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC3' },
    ],
    animations: animation ? [{ name: 'move', channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }], samplers: [{ input: 0, output: 1 }] }] : [],
  };
  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const totalLength = 12 + 8 + jsonLength + 8 + bin.length;
  const glb = Buffer.alloc(totalLength, 0);
  glb.write('glTF', 0, 'ascii');
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(totalLength, 8);
  glb.writeUInt32LE(jsonLength, 12);
  glb.write('JSON', 16, 'ascii');
  json.copy(glb, 20);
  glb.fill(0x20, 20 + json.length, 20 + jsonLength);
  const binHeader = 20 + jsonLength;
  glb.writeUInt32LE(bin.length, binHeader);
  glb.write('BIN\0', binHeader + 4, 'ascii');
  bin.copy(glb, binHeader + 8);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

test('real CesiumMan exposes one 2-second clip and 19 stable joint paths', { skip: !existsSync(realGlb) }, async () => {
  const { openGlb } = await import('../src/source/glb-motion.ts');
  const bytes = await readFile(realGlb);
  const source = await openGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(source.clips.length, 1);
  assert.ok(Math.abs(source.clips[0].durationSeconds - 2) < 0.01);
  assert.equal(source.joints.length, 19);
  assert.equal(new Set(source.joints.map((joint) => joint.path)).size, 19);

  const first = source.poseAt(source.clips[0].id, 0);
  const middle = source.poseAt(source.clips[0].id, 1);
  const firstAgain = source.poseAt(source.clips[0].id, 0);
  assert.deepEqual(firstAgain, first);
  assert.equal(first.length, 19);
  assert.ok(first.every((joint) => joint.world.length === 16 && joint.bindWorld.length === 16));
  assert.ok(first.every((joint) => joint.world.every(Number.isFinite) && joint.bindWorld.every(Number.isFinite)));
  assert.ok(first.some((joint, index) => joint.parentPath !== null && joint.world.some((value, element) => Math.abs(value - middle[index].world[element]) > 1e-5)));
});

test('bind pose comes from the GLB skeleton and remains distinct from animated time zero', async () => {
  const { openGlb } = await import('../src/source/glb-motion.ts');
  const source = await openGlb(glbWithJoints());
  const [joint] = source.poseAt(source.clips[0].id, 0);
  assert.equal(joint.bindWorld[12], 1);
  assert.equal(joint.world[12], 5);
  assert.equal(source.poseAt(source.clips[0].id, 1)[0].world[12], 6);
});

test('GLB with no animation has an actionable error', async () => {
  const { openGlb } = await import('../src/source/glb-motion.ts');
  await assert.rejects(openGlb(glbWithJoints({ animation: false })), /animation|clip|动画/i);
});

test('duplicate full joint paths are rejected rather than silently merged', async () => {
  const { openGlb } = await import('../src/source/glb-motion.ts');
  await assert.rejects(openGlb(glbWithJoints({ duplicateNames: true })), /duplicate|重复/i);
});

test('unknown clip and times outside its range are rejected', async () => {
  const { openGlb } = await import('../src/source/glb-motion.ts');
  const source = await openGlb(glbWithJoints());
  assert.throws(() => source.poseAt('absent', 0), /clip|动画/i);
  assert.throws(() => source.poseAt(source.clips[0].id, -0.1), /time|range|时间|范围/i);
  assert.throws(() => source.poseAt(source.clips[0].id, 1.1), /time|range|时间|范围/i);
});
