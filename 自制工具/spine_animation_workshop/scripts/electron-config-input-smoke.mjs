import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import electron from 'electron';

const root = resolve('../..');
const original = join(root, 'work', 'SPW-01', 'inputs', 'rozeul', 'packed');
const scratch = await mkdtemp(join(tmpdir(), 'spw-config-guard-'));
const target = join(scratch, 'rozeul.json');
await copyFile(join(original, 'rozeul.json'), target);
await copyFile(join(original, 'rozeul.atlas'), join(scratch, 'rozeul.atlas'));
for (const name of await readdir(original)) if (name.endsWith('.png')) await copyFile(join(original, name), join(scratch, name));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originalHash = hash(await readFile(target));
const child = spawn(electron, ['.', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SPW_SMOKE: '1', SPW_SMOKE_FLOW: '1', SPW_SMOKE_CASE: 'protect-config-input',
    SPW_SMOKE_SOURCE: join(root, 'work', 'SPW-01', 'inputs', 'CesiumMan.glb'),
    SPW_SMOKE_TARGET: target, SPW_SMOKE_OUTPUT: scratch, SPW_SMOKE_CONFIG: target,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
const code = await new Promise((resolveExit, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error(`配置原件保护 smoke 超时\n${output}`)); }, 120000);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (exitCode) => { clearTimeout(timer); resolveExit(exitCode); });
});
const receipt = output.split(/\r?\n/).find((line) => line.startsWith('SPW_CONFIG_INPUT_SMOKE_RESULT='));
if (code !== 0 || !receipt) throw new Error(`配置原件保护 smoke 失败（退出码 ${code}）\n${output}`);
if (hash(await readFile(target)) !== originalHash) throw new Error('已载入目标 JSON 被配置保存覆盖');
console.log(receipt);
