import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/ui/app.ts'],
  outfile: 'dist/app.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome132',
  sourcemap: true,
  logLevel: 'info',
});
await copyFile('src/ui/index.html', 'dist/index.html');
await copyFile('src/ui/style.css', 'dist/style.css');
