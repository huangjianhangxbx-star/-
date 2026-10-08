// Selectively copied old invoke/error bridge; only the new fixed-proof API is exposed.
const { contextBridge, ipcRenderer } = require('electron');
const invoke = (name) => ipcRenderer.invoke(name).then((result) => {
  if (!result.ok) throw Error(result.error);
  return result.value;
});
contextBridge.exposeInMainWorld('assetWorkshop', {
  info: () => invoke('2dw:info'),
  check: () => invoke('2dw:check'),
  exportProof: () => invoke('2dw:export'),
});
