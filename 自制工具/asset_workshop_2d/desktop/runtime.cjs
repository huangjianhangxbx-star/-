const path = require('node:path');

// Adapted from map_editor bootstrap: a new profile and fixed output, no old routes.
function runtimePaths(base) {
  return {
    base: path.resolve(base),
    userData: path.resolve(base, '.cache', 'asset-task-2d-profile'),
    outputDirectory: path.resolve(base, 'validation', 'proof-output'),
  };
}

// Same sender/main-frame/file-URL boundary as the copied old bootstrap fragment.
function isTrustedSender(event, contents, entryUrl) {
  return event.sender === contents &&
    event.senderFrame === contents.mainFrame &&
    event.senderFrame.url === entryUrl;
}
module.exports = { runtimePaths, isTrustedSender };
