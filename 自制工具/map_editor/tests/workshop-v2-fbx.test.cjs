const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { exportSavedAssetFbx } = require('../desktop/workshop-v2-export.cjs');
const core = require('../dist/workshop.cjs');
const blender = process.env.XINGHAI_BLENDER ?? 'D:/steam/steamapps/common/Blender/blender.exe';

test('single saved voxel asset exports an FBX and material sidecar without publishing a scene', async () => {
  const parent = await fs.mkdtemp(path.resolve('validation/workshop-v2-fbx-'));
  try {
    const asset = core.createAsset('stone'); asset.name = '石柱';
    asset.cells.push({ x: 0, y: 0, z: 0, color: 0 });
    const document = core.validateAsset(asset);
    const source = { document, hash: '0'.repeat(64) };
    const result = await exportSavedAssetFbx(source, parent, '石柱样本', blender, core);
    assert.equal(result.blenderVersion, '5.1.2');
    assert.equal(result.outputs.some((row) => row.path === '石柱样本.fbx'), true);
    assert.equal(result.outputs.some((row) => row.path === '石柱样本.xhmaterials.json'), true);
    assert.equal((await fs.readFile(result.file)).subarray(0, 23).equals(Buffer.from('Kaydara FBX Binary  \0\x1a\0')), true);
    const script = "import bpy,os,json; bpy.ops.import_scene.fbx(filepath=os.environ['XH_FBX_REIMPORT']); meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']; print('XH_REIMPORT '+json.dumps({'meshes':len(meshes),'materials':len(bpy.data.materials),'objects':[{'name':o.name,'dimensions':list(o.dimensions),'scale':list(o.scale)} for o in meshes]}))";
    const imported = await promisify(execFile)(blender,
      ['--background', '--factory-startup', '--python-exit-code', '1', '--python-expr', script],
      { env: { ...process.env, XH_FBX_REIMPORT: result.file }, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const line = imported.stdout.split(/\r?\n/).find((row) => row.startsWith('XH_REIMPORT '));
    const report = JSON.parse(line.slice('XH_REIMPORT '.length));
    const importedChunk = report.objects.find((row) => row.name.startsWith('stone:chunk:'));
    assert.ok(importedChunk);
    assert.ok(report.materials > 0);
    assert.ok(importedChunk.dimensions.every((value) => Math.abs(value - 0.25) < 0.0001));
    assert.equal(await fs.stat(path.join(parent, 'releases')).then(() => true, () => false), false);
    await assert.rejects(exportSavedAssetFbx(source, parent, '石柱样本', blender, core), /已存在/);
    const before = await fs.readFile(result.file);
    const replacement = await exportSavedAssetFbx(source, parent, '石柱样本', blender, core,
      { replaceExisting: true });
    assert.ok(replacement.backupDirectory);
    assert.deepEqual(await fs.readFile(path.join(replacement.backupDirectory, '石柱样本.fbx')), before);
    assert.equal((await fs.readFile(replacement.file)).subarray(0, 23).equals(Buffer.from('Kaydara FBX Binary  \0\x1a\0')), true);
    console.log(`FBX export: ${result.file}`);
  } finally { await fs.rm(parent, { recursive: true, force: true }); }
});
