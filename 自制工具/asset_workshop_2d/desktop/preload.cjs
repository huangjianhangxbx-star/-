// Selectively copied old invoke/error bridge; only the new fixed-proof API is exposed.
const { contextBridge, ipcRenderer } = require('electron');
const invoke = (name, ...payload) => ipcRenderer.invoke(name, ...payload).then((result) => {
  if (!result.ok) {
    // Context isolation strips custom properties from Error instances; a plain
    // rejection record preserves the structured code and field for the form.
    throw { name: 'TaskSessionError', message: result.error,
      ...(result.code ? { code: result.code } : {}),
      ...(result.field ? { field: result.field } : {}) };
  }
  return result.value;
});
contextBridge.exposeInMainWorld('tileWorkshop', {
  catalog: () => invoke('2dw:tile-catalog'),
  configure: options => invoke('2dw:tile-configure', options),
  importMaster: (method, phase) => ipcRenderer.invoke('2dw:tile-import', method, phase).then(result => { if (!result.ok) throw Error(result.error); return result.value; }),
  scene: input => invoke('2dw:tile-scene', input),
  exportTask: () => invoke('2dw:tile-export-task'),
  exportCompiled: () => invoke('2dw:tile-export-compiled'),
});
contextBridge.exposeInMainWorld('tilePipeline', {
  state: () => invoke('2dw:pipeline-state'),
  action: (name, payload) => invoke('2dw:pipeline-action', name, payload),
});
contextBridge.exposeInMainWorld('dualGrid', {
  state: () => invoke('2dw:dualgrid-state'),
  action: (name, payload) => invoke('2dw:dualgrid-action', name, payload),
});
contextBridge.exposeInMainWorld('assetWorkshop', {
  info: () => invoke('2dw:info'),
  check: () => invoke('2dw:check'),
  exportProof: () => invoke('2dw:export'),
  choices: () => invoke('2dw:choices'),
  taskInfo: () => invoke('2dw:task-info'),
  saveProjectStyleContract: contract => invoke('2dw:save-project-style-contract', contract),
  beginTask: payload => invoke('2dw:begin-task', payload),
  copyTaskId: () => invoke('2dw:copy-task-id'),
  saveEnvironmentProposal: text => invoke('2dw:save-environment-proposal', text),
  describeForm: payload => invoke('2dw:describe-form', payload),
  chooseReferences: () => invoke('2dw:choose-references'),
  pasteReference: () => invoke('2dw:paste-reference'),
  updateReference: payload => invoke('2dw:update-reference', payload),
  removeReference: payload => invoke('2dw:remove-reference', payload),
  previewTask: payload => invoke('2dw:preview-task', payload),
  exportTask: payload => invoke('2dw:export-task', payload),
});
