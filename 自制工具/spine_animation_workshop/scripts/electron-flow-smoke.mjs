import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import electron from 'electron';

const root = resolve('../..');
const source = join(root, 'work', 'SPW-01', 'inputs', 'CesiumMan.glb');
const target = join(root, 'work', 'SPW-01', 'inputs', 'rozeul', 'packed', 'rozeul.json');
const scratch = await mkdtemp(join(tmpdir(), 'spw-electron-flow-'));
const config = join(scratch, 'calibration.spw.json');
const child = spawn(electron, ['.', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SPW_SMOKE: '1', SPW_SMOKE_FLOW: '1', SPW_SMOKE_SOURCE: source,
    SPW_SMOKE_TARGET: target, SPW_SMOKE_OUTPUT: scratch, SPW_SMOKE_CONFIG: config,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
const exitCode = await new Promise((resolveExit, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error(`Electron flow smoke 超时\n${output}`)); }, 120000);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (code) => { clearTimeout(timer); resolveExit(code); });
});
const receipt = output.split(/\r?\n/).find((line) => line.startsWith('SPW_FLOW_SMOKE_RESULT='));
if (exitCode !== 0 || !receipt) throw new Error(`Electron flow smoke 失败（退出码 ${exitCode}）\n${output}`);
const saved = await readdir(scratch, { withFileTypes: true });
const packages = saved.filter((entry) => entry.isDirectory());
if (packages.length !== 1) throw new Error(`预期一个完整输出副本，实得 ${packages.length} 个`);
const packageFiles = await readdir(join(scratch, packages[0].name));
if (!packageFiles.some((name) => name.endsWith('.json')) || !packageFiles.some((name) => name.endsWith('.atlas')) || !packageFiles.some((name) => name.endsWith('.png'))) {
  throw new Error('完整输出副本缺少 JSON、atlas 或 PNG');
}
const restored = JSON.parse(await readFile(config, 'utf8'));
if (restored.view.yawDegrees !== 45) throw new Error('配置回读内容与 UI 恢复角度不符');
console.log(receipt);
console.log(`SPW_FLOW_PACKAGE=${join(scratch, packages[0].name)}`);
