import { build } from 'esbuild';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultProjectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function exists(path) {
  try { return (await stat(path)).isFile(); }
  catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function buildWorkshop({ projectDir = defaultProjectDir } = {}) {
  const project = resolve(projectDir);
  const ui = join(project, 'src', 'ui');
  const dist = join(project, 'dist');
  const spineScript = join(ui, 'spine-app.ts');
  const spinePage = join(ui, 'spine.html');
  const [hasSpineScript, hasSpinePage] = await Promise.all([exists(spineScript), exists(spinePage)]);
  if (hasSpineScript !== hasSpinePage) {
    throw new Error('Spine mode requires both src/ui/spine-app.ts and src/ui/spine.html');
  }
  await mkdir(dist, { recursive: true });
  await build({
    entryPoints: {
      app: join(ui, 'app.ts'),
      ...(hasSpineScript ? { 'spine-app': spineScript } : {}),
    },
    outdir: dist,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome132',
    sourcemap: true,
    logLevel: 'info',
  });
  await copyFile(join(ui, 'index.html'), join(dist, 'index.html'));
  if (hasSpinePage) await copyFile(spinePage, join(dist, 'spine.html'));
  await copyFile(join(ui, 'style.css'), join(dist, 'style.css'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildWorkshop().catch((error) => { console.error(error); process.exitCode = 1; });
}
