const { contextBridge, ipcRenderer } = require("electron");
const invoke = (name, ...args) =>
  ipcRenderer.invoke(name, ...args).then((r) => {
    if (!r.ok) throw Error(r.error);
    return r.value;
  });
contextBridge.exposeInMainWorld("workbench", {
  workshop: {
    choose: (mode,document) => invoke("workshop:choose",mode,document),
    importLegacy: (token) => invoke('workshop:import-legacy',token),
    copyScene: (token,sceneId) => invoke('workshop:copy-scene',token,sceneId),
    publish: (token,sceneId,assetId,id,recipe)=>invoke('workshop:publish',token,sceneId,assetId,id,recipe),
    publishes: (token)=>invoke('workshop:publishes',token),
    cancelPublish: (token)=>invoke('workshop:publish-cancel',token),
    chooseBlender: ()=>invoke('workshop:blender-choose'),
    load: (token,file,kind,id) => invoke("workshop:load",token,file,kind,id),
    stage: (token,file,kind,id) => invoke("workshop:stage",token,file,kind,id),
    readBinary: (token,sceneId,assetId)=>invoke('workshop:read-binary',token,sceneId,assetId),
    importBinary: (token,sceneId,libraryId)=>invoke('workshop:import-binary',token,sceneId,libraryId),
    commit: (token,intents) => invoke("workshop:commit",token,intents),
    dirty: (token,value) => invoke("workshop:dirty",token,value),
    librarySource: (id) => invoke('workshop:library-source',id),
    libraryRegister: (asset) => invoke('workshop:library-register',asset),
  },
  openNative: () => invoke("native:open"),
  saveNative: (doc,bounds,options,update) => invoke("native:save",doc,bounds,options,update),
  exportModel: (doc,fbx) => invoke("model:export",doc,fbx),
  importReference: () => invoke("reference:import"),
  info: () => invoke("app:info"),
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
  previewRename: (ids, options, physical) => invoke("assets:rename-preview", ids, options, physical),
  renameBatch: (ids, options, physical) => invoke("assets:rename-batch", ids, options, physical),
  locateAsset: (id, source) => invoke("assets:locate", id, source),
  setAnchor: (id, values) => invoke("assets:anchor", id, values),
});
