import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'samples', '2dw05a');
const outputName = '2dw05a-middle-brick-redraw.zip';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const expected = {
  'image1-hand-edited-middle-brick.png': 'b04d514cc1dc5efe64dd034d1ecffe7ff21aed4f96fe78c02256b54c2264e1ed',
  'image2-original-detailed-brick.png': '4d4d760cfdbc233a996d83e2f0e01cbe0f7afab42a01aef0a7b2d3440c3aca29',
};

export async function makeBrickSample(outputDirectory = folder) {
  if (!path.isAbsolute(outputDirectory)) throw new Error('Absolute output directory required');
  for (const [name, digest] of Object.entries(expected)) {
    const bytes = await fs.readFile(path.join(folder, name));
    if (sha256(bytes) !== digest) throw new Error(`Original user reference changed: ${name}`);
  }
  const core = require(path.join(root, 'dist', 'task.cjs'));
  const archive = require(path.join(root, 'archive', 'export-zip.cjs'));
  const selection = core.listPresetChoices().find(choice => choice.seed.id === 'standalone-static-png');
  if (!selection) throw new Error('Standalone PNG preset unavailable');
  const { label: _label, ...identity } = selection;
  const references = [
    { refId: 'image2-original', role: 'content', sourcePath: path.join(folder, 'image2-original-detailed-brick.png'),
      priority: 90, note: '原图图2：本次只重绘中间大砖。其余砖块、石缝、周边关系和整体构图保持。' },
    { refId: 'image1-hand-edited', role: 'style', sourcePath: path.join(folder, 'image1-hand-edited-middle-brick.png'),
      priority: 90, note: '用户手改图1：仅中间大砖的黑块、简化块面与少层级画法作为局部直接依据；不可把整张图当作已自动分析的结果。' },
  ];
  const { facts, binaries } = await archive.readReferenceFacts(references);
  const values = {
    taskId: '2dw05a-middle-brick-redraw', title: '中间大砖局部重绘',
    description: '以图1手工修改后的中间砖画法为依据，只重绘图2中间的大砖；保留周围石砖和构图关系。任务包只表达待执行要求，不含已重绘素材。',
    widthPx: 683, heightPx: 679, squareLocked: false, alphaRequirement: 'opaque-required', references,
    taskStyleDelta: {
      schemaVersion: '2dw-task-style-delta/1', focus: '只重绘图2中间大砖的块面语言',
      mustPreserve: ['周围石砖、石缝和整体布局关系。', '画面其他砖块不作为本次重绘对象。'],
      mustChange: ['中间大砖更概括、层级更少、黑块更明确。', '减少细碎裂纹与噪点，提高清楚的设计性块面。'],
      localReferenceNote: '以用户手工修改的图1中间砖局部效果为直接画法依据；图2提供待改位置及周边内容。',
      avoid: ['不要重绘整张图。', '不要引入写实抛光或密集 AI 材质细节。'],
    },
  };
  const spec = core.composePreset(identity, values, facts);
  const entries = core.compileWorkflowTask(spec).entries;
  const result = await archive.exportZip({ spec, entries, binaries, outputDirectory, fileName: outputName });
  const bytes = await fs.readFile(result.path);
  const checked = archive.validateZip(bytes);
  if (checked.manifest.schemaVersion !== '2dw-zip/3') throw new Error('Style-aware ZIP v3 required');
  return { path: result.path, sha256: sha256(bytes), referenceSha256: Object.fromEntries(spec.references.map(ref => [ref.refId, ref.sha256])), entries: checked.entries.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2 && (process.argv.length !== 4 || process.argv[2] !== '--output-dir'))
    throw new Error('Usage: node scripts/make-2dw05a-brick-sample.mjs [--output-dir ABSOLUTE_PATH]');
  console.log(JSON.stringify(await makeBrickSample(process.argv[3]), null, 2));
}
