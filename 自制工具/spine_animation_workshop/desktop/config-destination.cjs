const { win32 } = require('node:path');

function comparable(path) {
  return win32.normalize(win32.resolve(path)).toLocaleLowerCase('en-US');
}

/** File-picker destinations must never replace inputs currently in use. */
function assertConfigDestination(destination, protectedPaths) {
  const chosen = comparable(destination);
  if (protectedPaths.some((path) => path && comparable(path) === chosen)) {
    throw new Error(`不能覆盖已载入的原素材：${destination}`);
  }
}

module.exports = { assertConfigDestination };
