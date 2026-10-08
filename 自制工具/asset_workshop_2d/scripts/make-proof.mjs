import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const baseDefault = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function proofDraft(base) {
  return {
    schemaVersion: '1.0.0', taskId: 'underground-stone-wall',
    title: '地下石墙独立素材',
    description: '灰色洞穴石墙单件素材；借鉴内容图形态，不复制参考图。',
    styleDescription: '人工测试描述：冷灰石色、低饱和暗部与左上受光；风格图仅供色彩参考。',
    presetId: 'standalone-static-png', presetVersion: '1', adapterId: 'codex', adapterVersion: '1',
    output: { format: 'png', widthPx: 384, heightPx: 384, alphaRequirement: 'transparent-required', relativePath: 'output/asset.png' },
    requirements: {
      hard: ['保持透明背景，不以文字或占位文件冒充 PNG。'],
      preferences: ['保持轮廓清晰。'], creativeFreedom: ['石块裂纹和纹理可发挥，但不能改变画布尺寸与 PPU。'],
    },
    references: [
      { refId: 'content-01', role: 'content', sourcePath: path.join(base, 'tests', 'fixtures', 'content-01.png'), note: '借鉴石墙的形态，不复制原图。', priority: 1 },
      { refId: 'style-01', role: 'style', sourcePath: path.join(base, 'tests', 'fixtures', 'style-01.png'), note: '借鉴配色与阴影方向，不改变上述尺寸。', priority: 1 },
    ],
  };
}

async function prepare(base) {
  const { resolveSpec, compileTask } = require(path.join(base, 'dist', 'task.cjs'));
  const { readReferenceFacts } = require(path.join(base, 'archive', 'export-zip.cjs'));
  const draft = proofDraft(base);
  const { facts, binaries } = await readReferenceFacts(draft.references);
  const spec = resolveSpec(draft, facts);
  const { entries } = compileTask(spec);
  return { spec, entries, binaries };
}

export async function checkProof(base = baseDefault) {
  const { spec, entries } = await prepare(base);
  return { spec, prompt: entries['prompts/codex.md'], referenceCount: spec.references.length };
}

export async function makeProof(base = baseDefault) {
  const { exportZip } = require(path.join(base, 'archive', 'export-zip.cjs'));
  const payload = await prepare(base);
  const result = await exportZip({ ...payload, outputDirectory: path.join(base, 'validation', 'proof-output'), fileName: '2dw-proof-codex.zip' });
  const report = { ...result, taskId: payload.spec.taskId, widthPx: 384, heightPx: 384, ppu: 100, worldWidth: 3.84, worldHeight: 3.84, targetImageGenerated: false };
  await fs.writeFile(path.join(base, 'validation', 'proof-output', 'proof-validation.json'), JSON.stringify(report, null, 2) + '\n');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await makeProof(), null, 2));
}
