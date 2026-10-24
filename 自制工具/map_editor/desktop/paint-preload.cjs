const { contextBridge, ipcRenderer } = require("electron");
const call = (name, ...args) =>
  ipcRenderer.invoke(name, ...args).then((r) => {
    if (!r.ok) throw Error(r.error);
    return r.value;
  });
const on = (name, fn) => {
  const handler = (_e, data) => fn(data);
  ipcRenderer.on(name, handler);
  return () => ipcRenderer.removeListener(name, handler);
};
contextBridge.exposeInMainWorld("paintClient", {
  ready: () => call("paint:ready"),
  command: (command) => call("paint:command", command),
  return: () => call("paint:return"),
  onInvalid: (fn) => on("paint:invalid", fn),
  onMenu: (fn) => on("paint:menu", fn),
});
