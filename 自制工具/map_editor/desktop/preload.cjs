const { contextBridge, ipcRenderer } = require("electron");
const invoke = (name, ...args) =>
  ipcRenderer.invoke(name, ...args).then((r) => {
    if (!r.ok) throw Error(r.error);
    return r.value;
  });
contextBridge.exposeInMainWorld("workbench", {
  newMap: () => invoke("map:new"),
  open: () => invoke("map:open"),
  save: (doc, as) => invoke("map:save", doc, as),
  dirty: (v) => invoke("map:dirty", v),
  exportMap: (doc) => invoke("map:export", doc),
  chooseAssets: () => invoke("assets:choose"),
  reloadAssets: () => invoke("assets:reload"),
  assetData: (id) => invoke("assets:data", id),
  renameAsset: (id, name, physical) =>
    invoke("assets:rename", id, name, physical),
  locateAsset: (id, source) => invoke("assets:locate", id, source),
  setAnchor: (id, values) => invoke("assets:anchor", id, values),
});
