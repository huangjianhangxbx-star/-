import assert from 'node:assert/strict';
import test from 'node:test';
import { AtlasAttachmentLoader, Skeleton, SkeletonJson, TextureAtlas } from '@esotericsoftware/spine-webgl';
import { Spine43Preview } from '../src/preview/spine43-preview.ts';

const atlasText = 'dummy.png\nsize: 2,2\nfilter: Linear,Linear\nrepeat: none\npiece\n  bounds: 0,0,2,2\n';
function previewFixture() {
  const document = { skeleton: { spine: '4.3.26' }, bones: [{ name: 'root' }, { name: '正面', parent: 'root', x: 3500 },
    { name: '身体', parent: '正面', y: 100 }, { name: '手', parent: '身体', x: 20, y: 30, length: 15 }, { name: '背面', parent: 'root', x: -4000 }],
    slots: [{ name: '身体图', bone: '身体', attachment: 'piece' }, { name: '原点其他方向图', bone: 'root', attachment: 'piece' }, { name: '背面图', bone: '背面', attachment: 'piece' }],
    skins: [{ name: 'default', attachments: Object.fromEntries(['身体图', '原点其他方向图', '背面图'].map(n => [n, { piece: { path: 'piece', width: 40, height: 80 } }])) }],
    animations: { move: { bones: { 正面: { translate: [{ x: 0 }, { time: 1, x: 100 }] } } } } };
  const data = new SkeletonJson(new AtlasAttachmentLoader(new TextureAtlas(atlasText))).readSkeletonData(document);
  const skeleton = new Skeleton(data); skeleton.setSkin('default');
  const rendered: string[][] = [], camera: { x: number; y: number }[] = [], rects: number[][] = [], lines: number[][] = [];
  const renderer = { context: { gl: { viewport() {}, clearColor() {}, clear() {}, COLOR_BUFFER_BIT: 1 } },
    camera: { setViewport() {}, position: { set(x: number, y: number) { camera.push({ x, y }); } } }, begin() {}, end() {},
    drawSkeleton(value: Skeleton) { rendered.push(value.slots.filter(s => s.appliedPose.attachment !== null).map(s => s.data.name)); },
    circle() {}, line(...points: number[]) { lines.push(points); }, rect(_filled: boolean, x: number, y: number, w: number, h: number) { rects.push([x, y, w, h]); } };
  const preview = Object.create(Spine43Preview.prototype) as Spine43Preview;
  Object.assign(preview, { renderer, skeleton, data, skin: 'default', displayAnimation: 'move', generatedAnimation: '', selectedBone: '', liveFrame: null,
    canvas: { clientWidth: 500, clientHeight: 400, width: 500, height: 400 }, bounds: { x: -4020, y: -40, width: 7560, height: 180 }, loadRevision: 0 });
  return { preview, skeleton, document, rendered, camera, rects, lines };
}
const selection = { directionId: '正面', directionRoot: '正面', bodyAnchor: '身体', groundAnchor: '正面', sharedBones: [], normalizationBones: ['身体', '手'] };

test('direction preview hides unrelated and root-bound art, keeps animation time and focuses on selected body', () => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { devicePixelRatio: 1 } });
  try {
    const { preview, skeleton, document, rendered, camera, rects, lines } = previewFixture();
    const original = structuredClone(document);
    preview.seek(0.5); const before = skeleton.findBone('身体')!.appliedPose.worldX;
    preview.setRigSelection(selection);
    assert.deepEqual(rendered.at(-1), ['身体图']);
    assert.ok(Math.abs(skeleton.findBone('身体')!.appliedPose.worldX - before) < 1e-6);
    assert.ok(camera.at(-1)!.x > 3400);
    assert.ok(rects.some(r => r[2]! > 0 && r[2]! < 200));
    assert.ok(lines.length > 0);
    assert.deepEqual(document, original);
    preview.setRigSelection(null);
    assert.deepEqual(rendered.at(-1), ['身体图', '原点其他方向图', '背面图']);
    assert.ok(camera.at(-1)!.x < 1000);
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('invalid preview direction selection cannot silently display another direction', () => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { devicePixelRatio: 1 } });
  try {
    const { preview, rendered } = previewFixture(); preview.setRigSelection(selection);
    assert.throws(() => preview.setRigSelection({ ...selection, bodyAnchor: '背面' }), /身体参考/);
    preview.seek(0.2);
    assert.deepEqual(rendered.at(-1), ['身体图']);
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
