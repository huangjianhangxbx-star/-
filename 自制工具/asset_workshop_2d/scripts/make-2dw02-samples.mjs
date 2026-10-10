import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const goldDigest = '1f90a6b529c54cf3bda2fe9f1f90221fb19025b99ad113ca846aa325e663e504';
const fixture = name => path.join(root, 'tests', 'fixtures', name);

function reference(refId, role, note) {
  return { refId, role, sourcePath: fixture(`${refId}.png`), note };
}
function sampleDefinitions(choices) {
  const selection = seed => {
    const choice = choices.find(item => item.seed.id === seed);
    if (!choice) throw new Error(`Missing trusted seed: ${seed}`);
    const { label: _label, ...identity } = choice;
    return identity;
  };
  return [
    {
      id: 'A', fileName: '2dw02-A-square-zero-ref.zip', selection: selection('standalone-static-png'),
      values: { taskId: '2dw02-square-zero-ref', title: '独立静态 PNG：正方形',
        description: '人工描述：简洁、可辨的独立装饰物；无参考图。', widthPx: 384, squareLocked: true,
        alphaRequirement: 'transparent-required', references: [] },
    },
    {
      id: 'B', fileName: '2dw02-B-rectangle-two-ref.zip', selection: selection('standalone-static-png'),
      values: { taskId: '2dw02-rectangle-two-ref', title: '独立静态 PNG：长方形',
        description: '人工描述：长方形测试素材。参考图均为工坊自制夹具。', widthPx: 512, heightPx: 256,
        squareLocked: false, ppu: 200, alphaRequirement: 'opaque-required', references: [
          reference('content-01', 'content', '仅作人工指定的形态参考，不复制源图。'),
          reference('style-01', 'style', '仅作人工指定的色彩参考；未自动识别风格。'),
        ] },
    },
    {
      id: 'C', fileName: '2dw02-C-custom-one-ref.zip', selection: selection('custom'),
      values: { taskId: '2dw02-custom-one-ref', title: '自定义静态 PNG',
        description: '人工描述：单件测试素材，可在明确规格内设计细节。', widthPx: 640, heightPx: 480,
        squareLocked: false, alphaRequirement: 'alpha-allowed', references: [
          reference('content-01', 'content', '仅作形态参考，不复制源图。'),
        ], requirements: { hard: ['保留可读轮廓。'], preferences: ['使用克制的冷色。'],
          creativeFreedom: ['细部纹理可以自由设计。'] } },
    },
  ];
}

export async function makeSamples(outputDirectory = path.join(root, 'validation', '2dw02', 'samples')) {
  if (!path.isAbsolute(outputDirectory)) throw new Error('Absolute output directory required');
  const gold = await fs.readFile(path.join(root, 'samples', '2dw-proof-codex.zip'));
  if (digest(gold) !== goldDigest) throw new Error('First-round proof ZIP hash changed; stop before generating new samples');
  const { composePreset, listPresetChoices, compileTask } = require(path.join(root, 'dist', 'task.cjs'));
  const { readReferenceFacts, exportZip, validateZip } = require(path.join(root, 'archive', 'export-zip.cjs'));
  const definitions = sampleDefinitions(listPresetChoices());

  // Validate all task inputs and source images before publishing any task package.
  const prepared = [];
  for (const definition of definitions) {
    const { facts, binaries } = await readReferenceFacts(definition.values.references);
    // This generator reproduces the historical 2DW-02 v1 package, not a new
    // 2DW-05A task. Strip only the new style fields so existing samples keep
    // their original contract and archive version byte-for-byte.
    const current = composePreset(definition.selection, definition.values, facts);
    const { projectStyleContract: _contract, taskStyleDelta: _delta, ...spec } = current;
    const { projectStyleContract: _contractSource, taskStyleDelta: _deltaSource, ...legacySources } = spec.fieldSources;
    spec.fieldSources = legacySources;
    const { entries } = compileTask(spec);
    prepared.push({ ...definition, spec, entries, binaries });
  }

  const samples = [];
  for (const item of prepared) {
    const result = await exportZip({ spec: item.spec, entries: item.entries, binaries: item.binaries,
      outputDirectory, fileName: item.fileName });
    const bytes = await fs.readFile(result.path);
    const checked = validateZip(bytes);
    samples.push({ id: item.id, fileName: item.fileName, sha256: digest(bytes),
      specSha256: digest(Buffer.from(item.entries['spec/asset-spec.json'])),
      promptSha256: digest(Buffer.from(item.entries['prompts/codex.md'])),
      manifestSha256: digest(Buffer.from(JSON.stringify(checked.manifest, null, 2) + '\n')),
      schemaVersion: item.spec.schemaVersion, taskId: item.spec.taskId,
      dimensionsPx: [item.spec.output.widthPx, item.spec.output.heightPx],
      ppu: item.spec.output.ppu, worldUnits: [item.spec.output.worldWidth, item.spec.output.worldHeight],
      referenceCount: item.spec.references.length, entryCount: checked.entries.length });
  }
  const report = { schemaVersion: '2dw02-samples/1', firstRoundGoldSha256: goldDigest, samples };
  await fs.writeFile(path.join(outputDirectory, 'samples-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2 && (process.argv.length !== 4 || process.argv[2] !== '--output-dir'))
    throw new Error('Usage: node scripts/make-2dw02-samples.mjs [--output-dir ABSOLUTE_PATH]');
  console.log(JSON.stringify(await makeSamples(process.argv[3]), null, 2));
}
