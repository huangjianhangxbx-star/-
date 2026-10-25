import { PaintLeaseAuthority } from "./paint-session-contract.ts";
import type { AssetSession } from "./workshop-session.ts";
import { moduleEditor } from "./renderer.ts";
/** Single authority adapter: no project/file access is exposed to the painting client. */
export class PaintWindowController {
  private authority: PaintLeaseAuthority | null = null;
  private oldEdit: string | null = null;
  readonly button = document.createElement("button");
  readonly banner = document.createElement("div");
  constructor(
    private deps: {
      session: () => AssetSession | null;
      save: () => Promise<void>;
      changed: () => void;
      message: (s: string, error?: boolean) => void;
    },
  ) {
    this.button.id = "open-paint-window";
    this.button.textContent = "贴图绘制 ↗";
    this.button.onclick = () => void this.open();
    this.banner.id = "paint-lease-banner";
    this.banner.hidden = true;
    this.banner.innerHTML =
      "<span>该资产正在独立贴图窗口中编辑；主窗口可查看，修改请先返回建模。</span>";
    const focus = document.createElement("button");
    focus.textContent = "聚焦绘画窗口";
    focus.onclick = () => void (window.workbench.workshop as any).paintFocus();
    this.banner.append(focus);
    document.querySelector("#module-workspace")!.prepend(this.banner);
    (window.workbench.workshop as any).onPaintAuthority(async (event: any) => {
      if (event.type === "released") {
        if (event.data?.leaseId !== this.authority?.leaseId) return;
        this.release();
        deps.message("已返回建模，已提交笔触保留；请保存项目");
        return;
      }
      if (event.type !== "command") return;
      const { id, command } = event.data;
      try {
        if (!this.authority) throw Error("绘画权威会话已失效");
        const snapshot = await this.authority.dispatch(command);
        deps.changed();
        moduleEditor.refreshPaint();
        await (window.workbench.workshop as any).paintReply({ id, snapshot });
      } catch (e: any) {
        await (window.workbench.workshop as any)
          .paintReply({ id, error: e.message })
          .catch(() => {});
      }
    });
    const block = (e: Event) => {
      if (!this.active || !(e.target instanceof Element)) return;
      const projectAction = e.target.closest("button");
      if (
        projectAction?.closest("#project-workspace") &&
        ["打开项目", "新建项目"].includes(projectAction.textContent ?? "")
      )
        return;
      const allowed = e.target.closest(
        "#paint-lease-banner,#shortcut-map-open,.shortcut-dialog,#open-paint-window,.viewport-display-menu,#save-draft,#home,#previewhome,[data-shell-layout],#paint-view,[data-workspace=project],[data-workspace=module],.project-switch-dialog",
      );
      if (allowed) return;
      if (
        e instanceof PointerEvent &&
        e.target.tagName === "CANVAS" &&
        e.button !== 0
      )
        return;
      if (
        e.target.closest(
          "button,input,select,summary,[data-model-object],canvas",
        )
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        deps.message("该资产正在绘画；请先返回建模", true);
      }
    };
    document.addEventListener("pointerdown", block, true);
    document.addEventListener("click", block, true);
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          !this.active ||
          (e.target instanceof Element &&
            e.target.closest(
              "input,textarea,select,.viewport-display-menu,.project-switch-dialog",
            ))
        )
          return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          e.stopImmediatePropagation();
          void this.deps.save();
          return;
        }
        if (!["Control", "Shift", "Alt", "Meta", "F11"].includes(e.key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          deps.message("绘画期间请在绘画窗口使用撤销和绘画命令");
        }
      },
      true,
    );
  }
  get active() {
    return !!this.authority;
  }
  async open() {
    try {
      if (this.active) {
        await (window.workbench.workshop as any).paintFocus();
        return;
      }
      if (!(await moduleEditor.resolveDraft("贴图绘制"))) return;
      moduleEditor.cancel();
      const asset = this.deps.session();
      if (!asset?.canvases) throw Error("先打开原生体素资产");
      const s = asset.canvases;
      s.sync();
      const eligible = s.model.objects!.filter((o) => {
        const c = s.model.canvases!.find((c) => c.canvasId === o.canvasIds[0]);
        return c?.visible && !c.locked && o.cellKeys?.length;
      });
      if (!eligible.length)
        throw Error("没有可绘制物体，请先创建体素或解锁画布");
      let object =
        eligible.find((o) => o.objectId === s.editObjectId) ??
        (s.selectedObjectIds.length === 1
          ? eligible.find((o) => o.objectId === s.selectedObjectIds[0])
          : undefined);
      if (!object) {
        const id = await this.pick(
          eligible.map((o) => ({
            id: o.objectId,
            name: o.name + " · " + o.cellKeys!.length + " 格",
          })),
        );
        if (!id) return;
        object = eligible.find((o) => o.objectId === id)!;
      }
      this.oldEdit = s.editObjectId;
      s.setEditObject(object.objectId);
      this.authority = new PaintLeaseAuthority(
        s,
        asset.sessionId,
        object.objectId,
        this.deps.save,
      );
      await (window.workbench.workshop as any).paintOpen(
        this.authority.snapshot(),
      );
      moduleEditor.paintLeaseRendering(true);
      this.banner.hidden = false;
      document.body.classList.add("paint-writing");
      moduleEditor.refresh();
    } catch (e: any) {
      this.release();
      this.deps.message(e.message, true);
    }
  }
  private pick(items: { id: string; name: string }[]): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog"),
        title = document.createElement("h3"),
        select = document.createElement("select");
      title.textContent = "选择绘画目标";
      select.id = "paint-target";
      for (const i of items) select.append(new Option(i.name, i.id));
      const confirm = document.createElement("button"),
        cancel = document.createElement("button");
      confirm.textContent = "开始绘画";
      cancel.textContent = "取消";
      confirm.onclick = () => {
        resolve(select.value);
        dialog.close();
      };
      cancel.onclick = () => dialog.close();
      dialog.onclose = () => {
        resolve(null);
        dialog.remove();
      };
      dialog.append(title, select, confirm, cancel);
      document.body.append(dialog);
      dialog.showModal();
    });
  }
  release() {
    if (!this.authority) return;
    const s = this.authority.session;
    this.authority.release();
    this.authority = null;
    s.setEditObject(this.oldEdit);
    moduleEditor.paintLeaseRendering(false);
    this.banner.hidden = true;
    document.body.classList.remove("paint-writing");
    moduleEditor.refresh();
  }
  async close() {
    await (window.workbench.workshop as any).paintClose();
    this.release();
  }
  requireClosed() {
    if (this.active)
      throw Error("请先关闭贴图绘制窗口，已提交修改会保留在主会话");
  }
}
