import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const bridge = () => require('../desktop/native-project.cjs');
const document = { skeleton: { spine: '4.3.26', images: './images/' }, bones: [{ name: 'root' }], animations: { idle: {} } };
async function fixture(multiple = false) {
  const root = await mkdtemp(join(tmpdir(), 'spw-native-'));
  const input = join(root, '角色.spine');
  await writeFile(input, 'original bytes');
  const calls: string[][] = [];
  const run = async (args: string[]) => {
    calls.push(args);
    const output = args[args.indexOf('-o') + 1];
    if (args.includes('-e')) {
      await mkdir(output, { recursive: true });
      await writeFile(join(output, 'actor.json'), JSON.stringify(document));
      if (multiple) await writeFile(join(output, 'other.json'), JSON.stringify(document));
      await writeFile(join(output, 'project.atlas'), 'project.png\nsize: 1,1\n');
      await writeFile(join(output, 'project.png'), 'pixels');
    }
  };
  return { root, input, calls, options: { cacheRoot: join(root, 'cache'), executable: 'Spine.com', run } };
}
test('native load runs official export, keeps original identity and byte snapshot, supports nonmatching atlas stem', async () => {
  const f = await fixture();
  const result = await bridge().loadNativeProject(f.input, '目标', f.options);
  assert.equal(result.path, f.input);
  assert.equal(result.name, '角色.spine');
  assert.equal(result.native.projectBytes.toString(), 'original bytes');
  assert.ok(result.protectedPaths.includes(f.input));
  assert.equal(result.pages.length, 1);
  assert.equal(await readFile(f.input, 'utf8'), 'original bytes');
  assert.ok(f.calls[0].includes('json+pack'));
});
test('multiple skeletons require selection and cancellation returns no loaded resource', async () => {
  const f = await fixture(true);
  await assert.rejects(bridge().loadNativeProject(f.input, '目标', f.options), /多个骨架/);
  const result = await bridge().loadNativeProject(f.input, '目标', { ...f.options, chooseSkeleton: async () => null });
  assert.equal(result, null);
});
test('conversion failure and original changes during export are rejected', async () => {
  const f = await fixture();
  await assert.rejects(bridge().loadNativeProject(f.input, '来源', { ...f.options, run: async () => { throw new Error('missing images'); } }), /missing images/);
  await assert.rejects(bridge().loadNativeProject(f.input, '来源', { ...f.options, run: async (args: string[]) => { await f.options.run(args); await writeFile(f.input, 'changed'); } }), /已变化/);
});
test('roundtrip check ignores metadata and omitted zero times but rejects lost old animations or bones', () => {
  const expected = { ...document, animations: { old: {}, added: { bones: { root: { rotate: [{ time: 0, value: 20 }] } } } } };
  const actual = structuredClone(expected);
  (actual.skeleton as any).hash = 'new';
  actual.skeleton.images = './other';
  delete (actual.animations.added.bones.root.rotate[0] as any).time;
  assert.doesNotThrow(() => bridge().assertRoundtrip(expected, actual));
  delete (actual.animations as any).old;
  assert.throws(() => bridge().assertRoundtrip(expected, actual), /校验/);
});

test('handoff keeps exact target project bytes and prepares only one animation for editor import', async () => {
  const f = await fixture();
  await mkdir(join(f.root, 'images'));
  await writeFile(join(f.root, 'images', 'body.png'), 'original image');
  const resource = await bridge().loadNativeProject(f.input, '目标', f.options);
  const output = join(f.root, 'output');
  await mkdir(output);
  const candidate = { ...document, animations: { idle: {}, migrated: { bones: { root: { rotate: [{ value: 20 }] } } } } };
  const importCalls: string[][] = [];
  const job = await bridge().prepareNativeHandoff({ directory: output, target: resource, jsonText: JSON.stringify(candidate), animationName: 'migrated',
    run: async (args: string[]) => { importCalls.push(args); await writeFile(args[args.indexOf('-o') + 1], 'carrier bytes'); } });
  assert.equal(await readFile(job.projectPath, 'utf8'), 'original bytes');
  assert.equal(await readFile(join(job.projectDirectory, 'images', 'body.png'), 'utf8'), 'original image');
  assert.equal(await readFile(f.input, 'utf8'), 'original bytes');
  assert.deepEqual(Object.keys(JSON.parse(await readFile(job.carrierJsonPath, 'utf8')).animations), ['migrated']);
  assert.ok(importCalls[0].includes('-r'));
  assert.notEqual(importCalls[0][importCalls[0].indexOf('-o') + 1], job.projectPath);
  assert.equal(job.state, 'awaiting-editor-import');
});

test('handoff refuses a changed target and candidates that change preexisting animations', async () => {
  const f = await fixture();
  const resource = await bridge().loadNativeProject(f.input, '目标', f.options);
  const output = join(f.root, 'output'); await mkdir(output);
  const payload = { directory: output, target: resource, jsonText: JSON.stringify({ ...document, animations: { migrated: {} } }), animationName: 'migrated' };
  await assert.rejects(bridge().prepareNativeHandoff(payload), /原有|校验/);
  await writeFile(f.input, 'modified');
  await assert.rejects(bridge().prepareNativeHandoff(payload), /已变化/);
});

test('handoff verification rejects unimported or extra skeletons and accepts exactly the expected saved result', async () => {
  const f = await fixture();
  await mkdir(join(f.root, 'images'));
  const resource = await bridge().loadNativeProject(f.input, '目标', f.options);
  const output = join(f.root, 'output'); await mkdir(output);
  const expected = { ...document, animations: { idle: {}, migrated: { bones: { root: { rotate: [{ value: 20 }] } } } } };
  const job = await bridge().prepareNativeHandoff({ directory: output, target: resource, jsonText: JSON.stringify(expected), animationName: 'migrated',
    run: async (args: string[]) => { await writeFile(args[args.indexOf('-o') + 1], 'carrier'); } });
  const exportDocument = (doc: unknown, extra = false) => async (args: string[]) => {
    const directory = args[args.indexOf('-o') + 1];
    await writeFile(join(directory, 'actor.json'), JSON.stringify(doc));
    if (extra) await writeFile(join(directory, 'unwanted.json'), JSON.stringify(doc));
  };
  await assert.rejects(bridge().verifyNativeHandoff(job, exportDocument(document)), /尚未检测/);
  await assert.rejects(bridge().verifyNativeHandoff(job, exportDocument(expected, true)), /骨架数量/);
  assert.equal((await bridge().verifyNativeHandoff(job, exportDocument(expected))).passed, true);
});

test('handoff fills an existing strictly empty animation and requires editor replacement before verification passes', async () => {
  const f = await fixture();
  await mkdir(join(f.root, 'images'));
  const resource = await bridge().loadNativeProject(f.input, '目标', f.options);
  const baseline = { ...document, animations: { idle: {}, old: { bones: { root: { rotate: [{ value: 5 }] } } } } };
  resource.jsonText = JSON.stringify(baseline);
  resource.native.documents.actor = baseline;
  const output = join(f.root, 'output'); await mkdir(output);
  const animation = { bones: { root: { rotate: [{ value: 20 }] } } };
  const expected = { ...baseline, animations: { ...baseline.animations, idle: animation } };
  const job = await bridge().prepareNativeHandoff({ directory: output, target: resource, jsonText: JSON.stringify(expected), animationName: 'idle',
    run: async (args: string[]) => { await writeFile(args[args.indexOf('-o') + 1], 'carrier'); } });
  assert.equal(job.replaceEmpty, true);
  assert.deepEqual(baseline.animations.idle, {});
  assert.deepEqual(job.expectedDocuments.actor.animations.old, baseline.animations.old);
  assert.equal(await readFile(job.projectPath, 'utf8'), 'original bytes');
  const instructions = await readFile(join(output, '导入说明.txt'), 'utf8');
  assert.match(instructions, /Replace existing animations/);
  const exported = (doc: unknown) => async (args: string[]) => {
    await writeFile(join(args[args.indexOf('-o') + 1], 'actor.json'), JSON.stringify(doc));
  };
  await assert.rejects(bridge().verifyNativeHandoff(job, exported(baseline)), /校验/);
  assert.equal((await bridge().verifyNativeHandoff(job, exported(expected))).passed, true);
});

test('handoff still rejects nonempty collisions and unrelated changes when filling an empty animation', async () => {
  const f = await fixture();
  const resource = await bridge().loadNativeProject(f.input, '目标', f.options);
  const baseline = { ...document, animations: { idle: {}, old: { bones: { root: { rotate: [{ time: 0, value: 5 }] } } } } };
  resource.jsonText = JSON.stringify(baseline);
  resource.native.documents.actor = baseline;
  const output = join(f.root, 'output'); await mkdir(output);
  const animation = { bones: { root: { rotate: [{ value: 20 }] } } };
  await assert.rejects(bridge().prepareNativeHandoff({ directory: output, target: resource,
    jsonText: JSON.stringify({ ...baseline, animations: { ...baseline.animations, old: animation } }), animationName: 'old' }), /同名|空动画/);
  await assert.rejects(bridge().prepareNativeHandoff({ directory: output, target: resource,
    jsonText: JSON.stringify({ ...baseline, animations: { idle: animation } }), animationName: 'idle' }), /校验/);
  for (const existing of [{ bones: {} }, [], null]) {
    resource.jsonText = JSON.stringify({ ...document, animations: { idle: existing } });
    await assert.rejects(bridge().prepareNativeHandoff({ directory: output, target: resource,
      jsonText: JSON.stringify({ ...document, animations: { idle: animation } }), animationName: 'idle' }), /同名|空动画/);
  }
});

test('handoff refuses a no-op empty placeholder fill but still allows a brand-new empty animation', async () => {
  const f = await fixture();
  await mkdir(join(f.root, 'images'));
  const resource = await bridge().loadNativeProject(f.input, '目标', f.options);
  const output = join(f.root, 'output'); await mkdir(output);
  await assert.rejects(bridge().prepareNativeHandoff({ directory: output, target: resource,
    jsonText: resource.jsonText, animationName: 'idle',
    run: async (args: string[]) => { await writeFile(args[args.indexOf('-o') + 1], 'carrier'); } }),
  /选中的空动画还没有新内容，请先映射身体骨骼/);
  const candidate = { ...document, animations: { ...document.animations, brandNew: {} } };
  const job = await bridge().prepareNativeHandoff({ directory: output, target: resource,
    jsonText: JSON.stringify(candidate), animationName: 'brandNew',
    run: async (args: string[]) => { await writeFile(args[args.indexOf('-o') + 1], 'carrier'); } });
  assert.equal(job.replaceEmpty, false);
  assert.deepEqual(job.expectedDocuments.actor.animations.brandNew, {});
});
