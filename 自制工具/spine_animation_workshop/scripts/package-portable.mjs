import { constants } from 'node:fs';
import { copyFile, cp, lstat, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultProjectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const desktopFiles = ['main.cjs', 'preload.cjs', 'package-store.cjs', 'config-destination.cjs', 'spine-flow-smoke.cjs', 'native-project.cjs', 'dialog-history.cjs'];
const buildFiles = ['index.html', 'app.js', 'style.css'];
const spineBuildFiles = ['spine.html', 'spine-app.js'];
const guideFiles = ['README.md', 'packaging.md'];

async function requireFile(path, label) {
  try {
    if (!(await stat(path)).isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`${label} missing: ${path}. Run the build first.`);
  }
}

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function executableName(productName) {
  const safe = productName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').trim();
  if (!safe) throw new Error('package.json productName cannot form an executable name');
  return `${safe}.exe`;
}

function isWithin(parent, child) {
  const part = relative(parent, child);
  return part === '' || (part !== '..' && !part.startsWith(`..\\`) && !part.startsWith('../') && !isAbsolute(part));
}

/** Copy the installed Electron runtime and only the built app files into a new ignored release folder. */
export async function packagePortable({
  projectDir = defaultProjectDir,
  electronDir,
  outputDirectory,
} = {}) {
  const project = resolve(projectDir);
  const runtime = resolve(electronDir ?? join(project, 'node_modules', 'electron', 'dist'));
  const packageJsonPath = join(project, 'package.json');
  await requireFile(packageJsonPath, 'Project package.json');
  const projectPackage = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  if (typeof projectPackage.name !== 'string' || typeof projectPackage.version !== 'string') {
    throw new Error('Project package.json needs name and version');
  }
  const declaredElectron = projectPackage.devDependencies?.electron;
  if (declaredElectron !== '44.5.1') {
    throw new Error(`Portable package requires locked Electron 44.5.1; found ${String(declaredElectron)}`);
  }

  // Validate every input before making the release directory. Never package source assets.
  const spineSources = await Promise.all([
    exists(join(project, 'src', 'ui', 'spine.html')),
    exists(join(project, 'src', 'ui', 'spine-app.ts')),
  ]);
  if (spineSources[0] !== spineSources[1]) {
    throw new Error('Spine mode requires both src/ui/spine.html and src/ui/spine-app.ts');
  }
  const includedBuildFiles = spineSources[0] ? [...buildFiles, ...spineBuildFiles] : buildFiles;
  for (const name of desktopFiles) await requireFile(join(project, 'desktop', name), 'Desktop entry');
  for (const name of includedBuildFiles) await requireFile(join(project, 'dist', name), 'Built UI');
  for (const name of guideFiles) await requireFile(join(project, name), 'Usage guide');
  await requireFile(join(runtime, 'electron.exe'), 'Electron executable');
  await requireFile(join(runtime, 'version'), 'Electron version');
  if (!(await stat(join(runtime, 'resources'))).isDirectory()) throw new Error('Electron resources directory missing');
  const installedElectron = (await readFile(join(runtime, 'version'), 'utf8')).trim();
  if (installedElectron !== declaredElectron) {
    throw new Error(`Electron version mismatch: expected ${declaredElectron}, found ${installedElectron}`);
  }
  const webglPackage = join(project, 'node_modules', '@esotericsoftware', 'spine-webgl');
  const runtimePackages = dirname(await realpath(webglPackage));
  const licenseFiles = [
    ['spine-webgl', join(runtimePackages, 'spine-webgl', 'LICENSE')],
    ['spine-core', join(runtimePackages, 'spine-core', 'LICENSE')],
    ['three', join(project, 'node_modules', 'three', 'LICENSE')],
  ];
  for (const [name, path] of licenseFiles) await requireFile(path, `${name} LICENSE`);

  const releaseRoot = join(project, 'release');
  if (outputDirectory !== undefined && (typeof outputDirectory !== 'string' || !isAbsolute(outputDirectory))) {
    throw new Error('Portable output must be an absolute directory path');
  }
  const output = resolve(outputDirectory ?? join(releaseRoot, `${projectPackage.name}-${projectPackage.version}-win-x64`));
  if (output === releaseRoot || (isWithin(project, output) && !isWithin(releaseRoot, output)) || isWithin(output, project)) {
    throw new Error(`Portable output must be a new folder inside release or an explicit absolute path outside the project: ${output}`);
  }
  if (await exists(output)) throw new Error(`Portable package already exists: ${output}`);

  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  for (const entry of await readdir(runtime, { withFileTypes: true })) {
    const source = join(runtime, entry.name);
    const destination = join(output, entry.name);
    if (entry.isDirectory()) await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
    else if (entry.isFile()) await copyFile(source, destination, constants.COPYFILE_EXCL);
    else throw new Error(`Unexpected Electron runtime entry: ${source}`);
  }

  const executablePath = join(output, executableName(projectPackage.productName ?? projectPackage.name));
  await rename(join(output, 'electron.exe'), executablePath);
  const appDir = join(output, 'resources', 'app');
  await mkdir(join(appDir, 'desktop'), { recursive: true });
  await mkdir(join(appDir, 'dist'));
  for (const name of desktopFiles) {
    await copyFile(join(project, 'desktop', name), join(appDir, 'desktop', name), constants.COPYFILE_EXCL);
  }
  for (const name of includedBuildFiles) {
    await copyFile(join(project, 'dist', name), join(appDir, 'dist', name), constants.COPYFILE_EXCL);
  }
  for (const name of guideFiles) {
    await copyFile(join(project, name), join(output, name), constants.COPYFILE_EXCL);
  }
  await mkdir(join(output, 'LICENSES'));
  for (const [name, path] of licenseFiles) {
    await copyFile(path, join(output, 'LICENSES', `${name}-LICENSE`), constants.COPYFILE_EXCL);
  }
  await writeFile(join(appDir, 'package.json'), JSON.stringify({
    name: projectPackage.name,
    version: projectPackage.version,
    main: 'desktop/main.cjs',
    private: true,
  }, null, 2), { encoding: 'utf8', flag: 'wx' });
  return { outputDirectory: output, executablePath, electronVersion: installedElectron };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [argument, outputPath, extra] = process.argv.slice(2);
  const external = argument === '--output';
  if (extra || (external && !outputPath) || (!external && outputPath)) {
    console.error('Usage: node scripts/package-portable.mjs [release-subdirectory] | --output <absolute-directory>');
    process.exitCode = 2;
  } else {
    packagePortable(external ? { outputDirectory: outputPath } : argument ? { outputDirectory: join(defaultProjectDir, 'release', argument) } : {})
      .then(({ executablePath }) => console.log(executablePath))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
