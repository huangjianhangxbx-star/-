const { mkdir, writeFile, readFile, stat, lstat } = require('node:fs/promises');
const { join, dirname, basename } = require('node:path');
const { randomUUID } = require('node:crypto');

const bundleFiles = new Set(['manifest.json', 'source-rig.json', 'target-rig.json', 'motion-samples.json',
  'candidates.json', 'channel-audit.json', '任务书.md', '给 Codex 的指令.txt']);
const diagnosticFiles = new Set(['diagnostics.json', 'repair-request.md']);
async function writeAiFiles(parent, kind, bundleId, files) {
  if (!['bundle', 'diagnostics'].includes(kind) || typeof bundleId !== 'string' || !/^[\w-]{1,100}$/.test(bundleId)) throw new Error('AI 分析包标识无效');
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('AI 文件清单无效');
  const entries = Object.entries(files);
  if (!entries.length || entries.length > 20) throw new Error('AI 文件数量无效');
  let bytes = 0;
  for (const [name, text] of entries) {
    const permitted = kind === 'bundle' ? bundleFiles.has(name) || /^schemas\/[a-zA-Z0-9-]+\.schema\.json$/.test(name) : diagnosticFiles.has(name);
    if (!permitted || typeof text !== 'string') throw new Error(`不允许的 AI 文件或路径：${name}`);
    const size = Buffer.byteLength(text, 'utf8'); bytes += size;
    if (size > 16 * 1024 * 1024 || bytes > 48 * 1024 * 1024) throw new Error('AI 分析文件过大，请减少参考动作');
  }
  if (!(await stat(parent)).isDirectory()) throw new Error('请选择 AI 分析包保存目录');
  const directory = join(parent, `SPW-AI-${kind === 'bundle' ? 'Analysis' : 'Diagnostics'}-${bundleId}-${randomUUID().slice(0, 8)}`);
  await mkdir(directory);
  for (const [name, text] of entries) {
    if (name.startsWith('schemas/')) await mkdir(join(directory, 'schemas'), { recursive: true });
    await writeFile(join(directory, name), text, { encoding: 'utf8', flag: 'wx' });
  }
  return { directory };
}

async function boundedText(path, optional = false) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) throw new Error(`AI 返回文件无效或过大：${basename(path)}`);
    return await readFile(path, 'utf8');
  } catch (error) {
    if (optional && error.code === 'ENOENT') return '';
    throw error;
  }
}
async function readAiReply(path) {
  if (basename(path) !== 'mapping-proposal.json') throw new Error('请选择 mapping-proposal.json');
  return { path, proposalText: await boundedText(path), hintsText: await boundedText(join(dirname(path), 'rig-hints.json')),
    reportText: await boundedText(join(dirname(path), 'analysis-report.md'), true) };
}
module.exports = { writeAiFiles, readAiReply };
