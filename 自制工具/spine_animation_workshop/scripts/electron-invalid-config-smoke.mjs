import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import electron from 'electron';

const root = resolve('../..');
const scratch = await mkdtemp(join(tmpdir(), 'spw-invalid-config-'));
const config = join(scratch, 'invalid.spw.json');
await writeFile(config, JSON.stringify({ schemaVersion: 1, source: { clipId: 'clip:0' }, target: { file: 'wrong' }, mappings: [] }));
const child = spawn(electron, ['.', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SPW_SMOKE: '1', SPW_SMOKE_FLOW: '1', SPW_SMOKE_CASE: 'invalid-config',
    SPW_SMOKE_SOURCE: join(root, 'work', 'SPW-01', 'inputs', 'CesiumMan.glb'),
    SPW_SMOKE_TARGET: join(root, 'work', 'SPW-01', 'inputs', 'rozeul', 'packed', 'rozeul.json'),
    SPW_SMOKE_OUTPUT: scratch, SPW_SMOKE_CONFIG: config,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
const code = await new Promise((resolveExit, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error(`无效配置 smoke 超时\n${output}`)); }, 120000);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (exitCode) => { clearTimeout(timer); resolveExit(exitCode); });
});
const receipt = output.split(/\r?\n/).find((line) => line.startsWith('SPW_CONFIG_SMOKE_RESULT='));
if (code !== 0 || !receipt) throw new Error(`无效配置 smoke 失败（退出码 ${code}）\n${output}`);
console.log(receipt);
