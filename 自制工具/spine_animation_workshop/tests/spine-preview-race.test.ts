import assert from 'node:assert/strict';
import test from 'node:test';
import { ManagedWebGLRenderingContext } from '@esotericsoftware/spine-webgl';
import { Spine43Preview } from '../src/preview/spine43-preview.ts';

test('a late older image decode cannot replace the newer rendered preview and releases its texture', async () => {
  const savedImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const savedWebGl = Object.getOwnPropertyDescriptor(globalThis, 'WebGLRenderingContext');
  let releaseOldSecondPage!: () => void;
  let oldSecondPageStarted!: () => void;
  const oldSecondPage = new Promise<void>((resolve) => { releaseOldSecondPage = resolve; });
  const oldWaiting = new Promise<void>((resolve) => { oldSecondPageStarted = resolve; });
  let decodeCount = 0;
  const created: number[] = [];
  const deleted: number[] = [];
  const rendered: string[] = [];

  class FakeImage {
    width = 2;
    height = 2;
    src = '';
    decode(): Promise<void> {
      decodeCount++;
      if (decodeCount === 2) { oldSecondPageStarted(); return oldSecondPage; }
      return Promise.resolve();
    }
  }
  class FakeWebGl {
    canvas = { width: 200, height: 200 };
    createTexture(): { id: number } { const id = created.length + 1; created.push(id); return { id }; }
    deleteTexture(texture: { id: number }): void { deleted.push(texture.id); }
    getParameter(): boolean { return false; }
  }
  const gl = new Proxy(new FakeWebGl(), {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      if (typeof key === 'string' && key === key.toUpperCase()) return 1;
      return () => undefined;
    },
  });
  const canvas = { clientWidth: 200, clientHeight: 200, width: 200, height: 200 };
  const json = (rootName: string) => JSON.stringify({ skeleton: { spine: '4.3.26' }, bones: [{ name: rootName }] });
  const bytes = new ArrayBuffer(1);

  try {
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { devicePixelRatio: 1 } });
    Object.defineProperty(globalThis, 'WebGLRenderingContext', { configurable: true, value: FakeWebGl });
    const renderer = {
      context: new ManagedWebGLRenderingContext(gl as unknown as WebGLRenderingContext),
      camera: { setViewport() {}, position: { set() {} } },
      begin() {}, drawSkeleton(skeleton: { data: { bones: { name: string }[] } }) { rendered.push(skeleton.data.bones[0].name); }, end() {},
    };
    const preview = Object.create(Spine43Preview.prototype) as Spine43Preview;
    Object.assign(preview, { canvas, renderer, loadRevision: 0, bounds: { x: 0, y: 0, width: 600, height: 600 } });
    const oldLoad = preview.load(json('old-root'), {
      atlasText: 'old-a.png\nsize: 2,2\n\nold-b.png\nsize: 2,2\n',
      pages: [{ name: 'old-a.png', bytes }, { name: 'old-b.png', bytes }],
    }, '');
    await oldWaiting;
    assert.deepEqual(created, [1]);

    await preview.load(json('new-root'), {
      atlasText: 'new.png\nsize: 2,2\n', pages: [{ name: 'new.png', bytes }],
    }, '');
    assert.equal(rendered.at(-1), 'new-root');
    releaseOldSecondPage();
    await oldLoad;
    assert.equal(rendered.at(-1), 'new-root');
    assert.ok(deleted.includes(1), 'stale atlas texture must be disposed');
    assert.ok(!deleted.includes(2), 'current preview texture must remain alive');
  } finally {
    for (const [name, descriptor] of [
      ['Image', savedImage], ['window', savedWindow], ['WebGLRenderingContext', savedWebGl],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
