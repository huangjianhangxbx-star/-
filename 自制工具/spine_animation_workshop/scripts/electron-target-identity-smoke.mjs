import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import electron from 'electron';

const root = resolve('../..');
const source = join(root, 'work', 'SPW-01', 'inputs', 'CesiumMan.glb');
const original = join(root, 'work', 'SPW-01', 'inputs', 'rozeul', 'packed');
const scratch = await mkdtemp(join(tmpdir(), 'spw-identity-'));
const badTarget = join(scratch, 'invalid.json');
const replacementTarget = join(scratch, 'replacement.json');
await writeFile(badTarget, '{"skeleton":{"spine":"4.2.00"},"bones":[{"name":"root"}]}');
await copyFile(join(original, 'rozeul.json'), replacementTarget);
await copyFile(join(original, 'rozeul.atlas'), join(scratch, 'invalid.atlas'));
await copyFile(join(original, 'rozeul.atlas'), join(scratch, 'replacement.atlas'));
for (const name of await readdir(original)) if (name.endsWith('.png')) await copyFile(join(original, name), join(scratch, name));
const child = spawn(electron, ['.', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SPW_SMOKE: '1', SPW_SMOKE_FLOW: '1', SPW_SMOKE_CASE: 'target-identity',
    SPW_SMOKE_SOURCE: source,
    SPW_SMOKE_TARGETS: JSON.stringify([join(original, 'rozeul.json'), badTarget, replacementTarget]),
    SPW_SMOKE_OUTPUT: scratch, SPW_SMOKE_CONFIG: join(scratch, 'calibration.spw.json'),
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
const code = await new Promise((resolveExit, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error(`目标身份 smoke 超时\n${output}`)); }, 120000);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (exitCode) => { clearTimeout(timer); resolveExit(exitCode); });
});
const receipt = output.split(/\r?\n/).find((line) => line.startsWith('SPW_IDENTITY_SMOKE_RESULT='));
if (code !== 0 || !receipt) throw new Error(`目标身份 smoke 失败（退出码 ${code}）\n${output}`);
const result = JSON.parse(receipt.slice('SPW_IDENTITY_SMOKE_RESULT='.length));
if (!result.disabledImmediately || !result.disabledAfterFailure || !result.disabledDuringValidLoad || !result.disabledAfterValidLoad) throw new Error(`旧生成结果仍可保存：${receipt}`);
const files = await readdir(scratch, { withFileTypes: true });
if (files.some((entry) => entry.isDirectory())) throw new Error('无效目标之后写出了旧生成结果');
const badJson = await readFile(badTarget, 'utf8');
if (!badJson.includes('4.2.00')) throw new Error('无效目标测试原件被更改');
console.log(receipt);
