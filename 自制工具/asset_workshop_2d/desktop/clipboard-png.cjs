'use strict';

const path = require('node:path');
const { fileURLToPath } = require('node:url');

const MAX_PNG_BYTES = 4 * 1024 * 1024;
const MAX_CLIPBOARD_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 8;

class ClipboardReferenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ClipboardReferenceError';
    this.code = code;
  }
}

function localPngPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || /[\r\n]/u.test(value)) {
    throw new ClipboardReferenceError('invalid-clipboard-path', '剪贴板需包含单个本地 PNG 绝对路径。');
  }
  const source = value.length > 1 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1) : value;
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(source)) {
    throw new ClipboardReferenceError('remote-clipboard-url', '不支持网络 URL；请复制本地 PNG 文件或图片位图。');
  }
  if (!path.isAbsolute(source) || source.startsWith('\\\\')) {
    throw new ClipboardReferenceError('invalid-clipboard-path', '剪贴板需包含本地 PNG 绝对路径。');
  }
  if (path.extname(source).toLowerCase() !== '.png') {
    throw new ClipboardReferenceError('not-png', '剪贴板中的本地文件必须是 PNG。');
  }
  return source;
}

function fileUris(text) {
  const lines = text.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  if (!lines.length || lines.length > MAX_FILES) {
    throw new ClipboardReferenceError('clipboard-file-count', '剪贴板须包含 1 至 8 个本地 PNG 文件。');
  }
  return lines.map(line => {
    let url;
    try { url = new URL(line); }
    catch { throw new ClipboardReferenceError('invalid-clipboard-path', '剪贴板文件路径无法读取。'); }
    if (url.protocol !== 'file:') {
      throw new ClipboardReferenceError('remote-clipboard-url', '不支持网络 URL；请复制本地 PNG 文件。');
    }
    let source;
    try { source = fileURLToPath(url); }
    catch { throw new ClipboardReferenceError('invalid-clipboard-path', '剪贴板文件路径无法读取。'); }
    return localPngPath(source);
  });
}

async function clipboardBlob(item, type) {
  try {
    const blob = await item.getType(type);
    if (!blob || typeof blob.arrayBuffer !== 'function') throw Error('No clipboard Blob');
    return blob;
  } catch {
    throw new ClipboardReferenceError('clipboard-read', '无法读取剪贴板中的图片或文件数据。');
  }
}

async function blobBytes(blob) {
  try { return Buffer.from(await blob.arrayBuffer()); }
  catch { throw new ClipboardReferenceError('clipboard-read', '无法读取剪贴板中的 PNG 图片。'); }
}

async function blobText(blob) {
  if (blob.size > MAX_CLIPBOARD_TEXT_BYTES) {
    throw new ClipboardReferenceError('clipboard-text-too-large', '剪贴板文件路径文字超过 4 MB 限制。');
  }
  try { return await blob.text(); }
  catch { throw new ClipboardReferenceError('clipboard-read', '无法读取剪贴板中的文件路径。'); }
}

async function readClipboardReference(reader) {
  let items;
  try { items = await reader.read(); }
  catch { throw new ClipboardReferenceError('clipboard-read', '无法读取剪贴板，请重试。'); }
  if (!Array.isArray(items) || !items.length) {
    throw new ClipboardReferenceError('clipboard-empty', '剪贴板为空；请复制 PNG 图片或本地 PNG 文件。');
  }
  const typed = type => items.find(item => Array.isArray(item?.types) && item.types.includes(type));
  const image = typed('image/png');
  if (image) {
    const blob = await clipboardBlob(image, 'image/png');
    if (blob.size > MAX_PNG_BYTES) throw new ClipboardReferenceError('clipboard-image-too-large', '剪贴板 PNG 超过 4 MB 限制。');
    const bytes = await blobBytes(blob);
    if (!bytes.length || bytes.length > MAX_PNG_BYTES) throw new ClipboardReferenceError('clipboard-image-too-large', '剪贴板 PNG 为空或超过 4 MB 限制。');
    return { kind: 'image', bytes };
  }
  const files = typed('text/uri-list');
  if (files) {
    const text = await blobText(await clipboardBlob(files, 'text/uri-list'));
    return { kind: 'files', filePaths: fileUris(text) };
  }
  const plain = typed('text/plain');
  if (plain) {
    const text = await blobText(await clipboardBlob(plain, 'text/plain'));
    return { kind: 'files', filePaths: [localPngPath(text.trim())] };
  }
  throw new ClipboardReferenceError('clipboard-unsupported', '剪贴板没有可用的 PNG 图片或本地 PNG 文件。');
}

module.exports = { readClipboardReference, ClipboardReferenceError };
