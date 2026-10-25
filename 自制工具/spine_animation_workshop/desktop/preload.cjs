const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spw', Object.freeze({
  openSource: () => ipcRenderer.invoke('source:open'),
  openSpineSource: () => ipcRenderer.invoke('spine-source:open'),
  openTarget: () => ipcRenderer.invoke('target:open'),
  chooseOutput: () => ipcRenderer.invoke('output:choose'),
  saveOutput: (payload) => ipcRenderer.invoke('output:save', payload),
  nativeAction: (handoffId, action) => ipcRenderer.invoke('native:action', { handoffId, action }),
  openConfig: () => ipcRenderer.invoke('config:open'),
  saveConfig: (jsonText) => ipcRenderer.invoke('config:save', jsonText),
}));
