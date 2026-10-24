import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import electron from 'electron';

if (!existsSync('dist/index.html') || !existsSync('dist/app.js')) {
  throw new Error('先运行 pnpm run build');
}
const child = spawn(electron, ['.', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader'], {
  cwd: process.cwd(),
  env: { ...process.env, SPW_SMOKE: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
const exitCode = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error(`Electron smoke 超时\n${output}`)); }, 30000);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (code) => { clearTimeout(timer); resolve(code); });
});
const receipt = output.split(/\r?\n/).find((line) => line.startsWith('SPW_SMOKE_RESULT='));
if (exitCode !== 0 || !receipt) throw new Error(`Electron smoke 失败（退出码 ${exitCode}）\n${output}`);
console.log(receipt);
