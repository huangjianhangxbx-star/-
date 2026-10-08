// Adapted from old esbuild invocation, with independent entries/output and no mesh pipeline.
import { build } from 'esbuild';
import fs from 'node:fs/promises';
await fs.mkdir('dist', { recursive: true });
await build({ entryPoints: ['core/task.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/task.cjs' });
await build({ entryPoints: ['desktop/app.ts'], bundle: true, platform: 'browser', format: 'iife', outfile: 'dist/app.js' });
console.log('2DW core and desktop built in own dist/');
