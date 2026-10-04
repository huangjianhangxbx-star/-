export type PublishContext = {
  key: () => string;
  targets: () => { id: string; name: string }[];
  publish: (assetId: string, id: string, recipe: string) => Promise<void>;
  history: () => Promise<any[]>;
  cancel: () => Promise<void>;
  configureBlender: () => Promise<void>;
  editSource: (assetId: string) => Promise<void>;
  run: (fn: () => Promise<void> | void) => Promise<void>;
};
export class PublishWorkspace {
  private selected = "";
  private key = "";
  private busy = false;
  constructor(
    private host: HTMLElement,
    private ctx: PublishContext,
  ) {
    host.innerHTML = `<h1>发布冻结版本</h1><p class="hint">先保存草稿，再发布独立版本。后续编辑源文件不会修改旧版本。</p><div class="actions"><label>目标 <select id="publish-target"></select></label><label>版本身份 <input id="publish-id" maxlength="80"></label><label>格式 <select id="publish-recipe"><option value="glb-only">GLB</option><option value="glb-fbx">GLB + FBX</option></select></label><button id="publish-blender">配置Blender</button><button id="publish-commit">检查并发布</button><button id="publish-cancel" disabled>取消发布</button></div><p id="publish-status" aria-live="polite"></p><h2>已发布版本</h2><div id="publish-history"></div>`;
    this.el<HTMLSelectElement>("publish-target").onchange = () => {
      this.selected = this.el<HTMLSelectElement>("publish-target").value;
    };
    this.el<HTMLInputElement>("publish-id").value = crypto.randomUUID();
    this.el<HTMLButtonElement>("publish-commit").onclick = () =>
      void ctx.run(async () => {
        this.busy = true;
        this.controls();
        this.el("publish-status").textContent = "正在校验依赖并冻结输出…";
        try {
          await ctx.publish(
            this.selected,
            this.el<HTMLInputElement>("publish-id").value,
            this.el<HTMLSelectElement>("publish-recipe").value,
          );
          this.el("publish-status").textContent =
            "发布已完成，输出与依赖已冻结";
          await this.renderHistory();
        } catch (e) {
          this.el("publish-status").textContent = (e as Error).message;
          throw e;
        } finally {
          this.busy = false;
          this.controls();
        }
      });
    this.el<HTMLButtonElement>("publish-cancel").onclick = () =>
      void ctx.run(ctx.cancel);
    this.el<HTMLButtonElement>("publish-blender").onclick = () =>
      void ctx.run(ctx.configureBlender);
    const source = document.createElement("button");
    source.id = "publish-source";
    source.textContent = "返回编辑";
    source.onclick = () => void ctx.run(() => ctx.editSource(this.selected));
    this.el("publish-status").insertAdjacentElement("afterend", source);
  }
  private el<T extends HTMLElement = HTMLElement>(id: string) {
    return this.host.querySelector<T>("#" + id)!;
  }
  private controls() {
    this.el<HTMLButtonElement>("publish-source").disabled =
      this.busy || !this.ctx.key();
    this.el<HTMLButtonElement>("publish-commit").disabled =
      this.busy || !this.ctx.key();
    this.el<HTMLButtonElement>("publish-cancel").disabled = !this.busy;
    this.el<HTMLSelectElement>("publish-target").disabled = this.busy;
    this.el<HTMLInputElement>("publish-id").disabled = this.busy;
    this.el<HTMLButtonElement>("publish-blender").disabled = this.busy;
    this.el<HTMLSelectElement>("publish-recipe").disabled = this.busy;
  }
  async render() {
    const key = this.ctx.key();
    if (key !== this.key) {
      this.selected = "";
      this.key = key;
    }
    const options = this.el<HTMLSelectElement>("publish-target");
    options.replaceChildren();
    for (const row of this.ctx.targets()) {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.name;
      options.append(option);
    }
    if (!this.ctx.targets().some((row) => row.id === this.selected))
      this.selected = "";
    options.value = this.selected;
    this.controls();
    await this.renderHistory();
  }
  private async renderHistory() {
    const key = this.ctx.key(),
      items = key ? await this.ctx.history() : [];
    if (key !== this.ctx.key()) return;
    const host = this.el("publish-history");
    host.replaceChildren();
    for (const item of items) {
      const row = document.createElement("p");
      row.dataset.publish = item.publishId;
      row.textContent = `${item.publishId} · ${item.manifest.kind === "scene" ? "场景" : "模块"} · ${item.manifest.recipe} · r${item.manifest.sourceRevision}`;
      host.append(row);
    }
    if (!items.length) host.textContent = "尚无已验证的发布版本";
  }
}
