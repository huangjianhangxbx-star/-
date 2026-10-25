const { BrowserWindow, ipcMain, screen, dialog } = require("electron");
const path = require("node:path"),
  { pathToFileURL } = require("node:url"),
  { randomUUID } = require("node:crypto");
/** Registered-frame broker only. No child gets the workbench preload or a filesystem API. */
exports.createPaintWindow = (parent, entryFile) => {
  let child = null,
    snapshot = null,
    leaseId = null,
    opening = false,
    clientApprovedClose = false;
  const pending = new Map();
  let parentClose = null;
  let inFlight = false;
  const url = (name) => pathToFileURL(path.join(__dirname, name)).href;
  const parentEvent = (e) =>
    e.sender === parent.webContents &&
    e.senderFrame === parent.webContents.mainFrame &&
    e.senderFrame.url === url(entryFile);
  const childEvent = (e) =>
    child &&
    !child.isDestroyed() &&
    e.sender === child.webContents &&
    e.senderFrame === child.webContents.mainFrame &&
    e.senderFrame.url === url("paint-workspace.html");
  const notify = (type, data) => {
    if (!parent.isDestroyed() && !parent.webContents.isDestroyed())
      parent.webContents.send("paint:authority", { type, data });
  };
  function finishParentClose(allow) {
    const current=parentClose;if(!current)return;
    parentClose=null;
    if(current.loaded&&child&&!child.isDestroyed())child.webContents.removeListener('did-finish-load',current.loaded);
    current.resolve(allow);
  }
  function requestParentClose() {
    if(!leaseId||!child||child.isDestroyed())return Promise.resolve(true);
    if(parentClose)return parentClose.promise;
    const id=randomUUID(),current={id,leaseId,resolve:null,promise:null,loaded:null};
    current.promise=new Promise(resolve=>current.resolve=resolve);parentClose=current;
    const send=()=>{if(parentClose!==current||!child||child.isDestroyed())return;child.webContents.send('paint:menu',{kind:'parent-close',requestId:id});};
    child.show();child.focus();
    if(child.webContents.isLoadingMainFrame()){current.loaded=send;child.webContents.once('did-finish-load',send);}else send();
    return current.promise;
  }
  function invalidate(reason) {
    finishParentClose(false);
    const releasedLease = leaseId;
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(Error(reason));
    }
    pending.clear();
    inFlight = false;
    leaseId = null;
    snapshot = null;
    if (child && !child.isDestroyed())
      child.webContents.send("paint:invalid", reason);
    notify("released", { reason, leaseId: releasedLease });
  }
  const request = (command) =>
    new Promise((resolve, reject) => {
      if (!leaseId || parent.isDestroyed())
        return reject(Error("主绘画会话已失效"));
      if (inFlight) return reject(Error("上一笔尚未确认"));
      const id = randomUUID();
      inFlight = true;
      const timer = setTimeout(() => {
        pending.delete(id);
        inFlight = false;
        invalidate("主会话响应超时，请返回主窗口检查");
        reject(Error("绘画请求超时"));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      notify("command", { id, command });
    });
  const handle = (name, check, fn) =>
    ipcMain.handle(name, async (e, ...args) => {
      try {
        if (!check(e)) throw Error("拒绝未知绘画调用");
        return { ok: true, value: await fn(...args) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    });
  handle("paint:open", parentEvent, async (next) => {
    if (child && !child.isDestroyed()) {
      if (leaseId) {
        child.show();
        child.focus();
        return false;
      }
      child.destroy();
    }
    if (opening) throw Error("绘画窗口正在打开");
    if (
      !next ||
      typeof next.leaseId !== "string" ||
      JSON.stringify(next).length > 32 * 1024 * 1024
    )
      throw Error("绘画快照无效或超过32MiB");
    opening = true;
    try {
      snapshot = next;
      leaseId = next.leaseId;
      clientApprovedClose = false;
      child = new BrowserWindow({
        parent,
        width: 1200,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        show: !process.argv.includes("--test-hidden"),
        backgroundColor: "#20262c",
        webPreferences: {
          preload: path.join(__dirname, "paint-preload.cjs"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          offscreen: process.argv.includes("--test-hidden"),
        },
      });
      child.on("close", (e) => {
        if (leaseId && !clientApprovedClose) {
          e.preventDefault();
          child.webContents.send("paint:menu", "close");
        }
      });
      child.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      child.webContents.on("will-navigate", (e) => e.preventDefault());
      child.webContents.on("render-process-gone", () => {
        invalidate("绘画窗口已退出；已确认的笔触保留在主窗口");
        child?.destroy();
      });
      child.on("closed", () => {
        finishParentClose(false);
        child = null;
        if (inFlight) {
          Promise.allSettled(
            [...pending.values()].map(
              (p) =>
                new Promise((r) => {
                  const done = p.resolve,
                    fail = p.reject;
                  p.resolve = (v) => {
                    done(v);
                    r(v);
                  };
                  p.reject = (e) => {
                    fail(e);
                    r(null);
                  };
                }),
            ),
          ).finally(() => invalidate("绘画窗口已关闭，修改仍在主会话"));
        } else invalidate("绘画窗口已关闭，修改仍在主会话");
      });
      await child.loadFile(path.join(__dirname, "paint-workspace.html"));
      return true;
    } catch (error) {
      child?.destroy();
      invalidate("绘画窗口无法打开");
      throw error;
    } finally {
      opening = false;
    }
  });
  handle("paint:ready", childEvent, () => {
    if (!leaseId) throw Error("绘画会话已失效");
    return snapshot;
  });
  handle('paint:parent-close-decision',childEvent,(requestId,allow)=>{
    if(typeof requestId!=='string'||typeof allow!=='boolean'||!parentClose||parentClose.id!==requestId||parentClose.leaseId!==leaseId)throw Error('主窗口关闭请求已失效');
    finishParentClose(allow);return true;
  });
  handle("paint:command", childEvent, async (command) => {
    if (
      !command ||
      command.leaseId !== leaseId ||
      !["paint", "undo", "redo", "save", "layer", "target", "outline"].includes(command.kind) ||
      JSON.stringify(command).length > 32 * 1024 * 1024
    )
      throw Error("绘画消息无效");
    return request(command);
  });
  handle("paint:reply", parentEvent, (reply) => {
    if (!reply || typeof reply.id !== "string") throw Error("绘画回执无效");
    const p = pending.get(reply.id);
    if (!p) throw Error("绘画请求已失效");
    pending.delete(reply.id);
    clearTimeout(p.timer);
    inFlight = false;
    if (reply.error) p.reject(Error(reply.error));
    else {
      if (reply.snapshot?.leaseId !== leaseId) {
        p.reject(Error("绘画回执租约不符"));
        throw Error("绘画回执租约不符");
      }
      snapshot = reply.snapshot;
      p.resolve(snapshot);
    }
    return true;
  });
  handle("paint:close", parentEvent, async () => {
    const closing = child;
    if (!closing) return;
    while (inFlight) await new Promise((r) => setTimeout(r, 20));
    if (closing.isDestroyed()) return;
    await new Promise((resolve) => {
      closing.once("closed", resolve);
      closing.close();
    });
  });
  handle('paint:request-save',parentEvent,()=>{
    if(!leaseId||!child||child.isDestroyed())throw Error('绘画窗口已关闭');
    child.show();child.focus();child.webContents.send('paint:menu','save');
  });
  handle("paint:focus", parentEvent, () => {
    if (child && !child.isDestroyed()) {
      child.show();
      child.focus();
    }
  });
  handle("paint:return", childEvent, () => {
    clientApprovedClose = true;
    child?.close();
  });
  parent.webContents.on("did-start-loading", () =>
    invalidate("主窗口已重新载入，未保存数据无法从子窗口恢复"),
  );
  parent.webContents.on("render-process-gone", () =>
    invalidate("主资产会话已失效，请关闭绘画窗口"),
  );
  screen.on("display-removed", () => {
    if (child && !child.isDestroyed())
      child.setBounds(screen.getPrimaryDisplay().workArea);
  });
  return {
    get active() {
      return !!leaseId;
    },
    save() {
      if (!snapshot) throw Error("绘画会话已失效");
      return request({
        leaseId,
        commandId: randomUUID(),
        baseRevision: snapshot.model.revision,
        kind: "save",
      });
    },
    async settle() {
      while (inFlight) await new Promise((r) => setTimeout(r, 20));
    },
    requestParentClose,
    focus() {
      child?.focus();
    },
    menu(action) {
      if (child && !child.isDestroyed())
        child.webContents.send("paint:menu", action);
    },
    close() {
      finishParentClose(false);
      child?.destroy();
    },
    get child() {
      return child;
    },
  };
};
