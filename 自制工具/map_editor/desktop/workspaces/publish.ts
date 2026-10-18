export type PublishContext = {
  key: () => string;
  targets: () => { id: string; name: string }[];
  publish: (assetId: string, id: string, recipe: string) => Promise<{directory:string;canonicalDirectory:string;exportError?:string|null}>;
  history: () => Promise<any[]>;
  location: () => Promise<{defaultRoot:string;selectedRoot:string}|null>;
  chooseOutput: () => Promise<{defaultRoot:string;selectedRoot:string}|null>;
  resetOutput: () => Promise<{defaultRoot:string;selectedRoot:string}>;
  openOutput: (id:string,preferChosen:boolean) => Promise<string>;
  cancel: () => Promise<void>;
  configureBlender: () => Promise<void>;
  editSource: (assetId: string) => Promise<void>;
  run: (fn: () => Promise<void> | void) => Promise<void>;
};
export class PublishWorkspace {
  private selected = "";
  private key = "";
  private busy = false;
  private location:{defaultRoot:string;selectedRoot:string}|null=null;
  constructor(
    private host: HTMLElement,
    private ctx: PublishContext,
  ) {
    host.innerHTML = `<h1>发布冻结版本</h1><p class="hint">先保存草稿，再发布独立版本。后续编辑源文件不会修改旧版本。</p><div class="actions"><label>目标 <select id="publish-target"></select></label><label>版本身份 <input id="publish-id" maxlength="80"></label><label>格式 <select id="publish-recipe"><option value="glb-only">GLB</option><option value="glb-fbx">GLB + FBX</option></select></label><button id="publish-blender">配置Blender</button><button id="publish-commit">检查并发布</button><button id="publish-cancel" disabled>取消发布</button></div><div class="publish-destination"><div class="publish-destination-heading"><strong>发布输出位置</strong><button id="publish-output-choose">选择文件夹…</button><button id="publish-output-reset">使用项目内默认</button></div><p class="hint" id="publish-location-note"></p><div class="publish-path"><span>本次完整路径</span><code id="publish-target-path"></code></div></div><p id="publish-status" aria-live="polite"></p><div id="publish-result" class="publish-result" hidden><strong>发布包已生成</strong><code id="publish-result-path"></code><button id="publish-open-output">打开输出文件夹</button></div><h2>已发布版本</h2><div id="publish-history"></div>`;
    this.el<HTMLSelectElement>("publish-target").onchange = () => {
      this.selected = this.el<HTMLSelectElement>("publish-target").value;
    };
    this.el<HTMLInputElement>("publish-id").value = crypto.randomUUID();
    this.el<HTMLInputElement>("publish-id").addEventListener('input',()=>this.showLocation());
    this.el<HTMLButtonElement>('publish-output-choose').onclick=()=>void ctx.run(async()=>{const chosen=await ctx.chooseOutput();if(chosen){this.location=chosen;this.showLocation();}});
    this.el<HTMLButtonElement>('publish-output-reset').onclick=()=>void ctx.run(async()=>{this.location=await ctx.resetOutput();this.showLocation();});
    this.el<HTMLButtonElement>("publish-commit").onclick = () =>
      void ctx.run(async () => {
        this.busy = true;
        this.controls();
        this.el("publish-status").textContent = "正在校验依赖并冻结输出…";
        try {
          const publishId=this.el<HTMLInputElement>('publish-id').value;
          const result=await ctx.publish(
            this.selected,
            publishId,
            this.el<HTMLSelectElement>("publish-recipe").value,
          );
          this.el("publish-status").textContent =result.exportError?`项目内发布成功；复制到自选目录失败：${result.exportError}`:'发布已完成，输出与依赖已冻结';
          this.el('publish-result-path').textContent=result.directory;
          this.el('publish-result').hidden=false;
          this.el<HTMLButtonElement>('publish-open-output').onclick=()=>void ctx.run(async()=>{await ctx.openOutput(publishId,true);});
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
    this.el<HTMLButtonElement>('publish-output-choose').disabled=this.busy||!this.ctx.key();
    this.el<HTMLButtonElement>('publish-output-reset').disabled=this.busy||!this.ctx.key()||!this.location||this.location.selectedRoot===this.location.defaultRoot;
  }
  private showLocation(){
    const id=this.el<HTMLInputElement>('publish-id').value,base=this.location?.selectedRoot;
    this.el('publish-target-path').textContent=base?(id?base.replace(/[\\/]$/,'')+'\\'+id:base+'\\〈版本身份〉'):'先打开项目并选择场景';
    this.el('publish-location-note').textContent=!this.location?'打开项目后可选择输出文件夹。':this.location.selectedRoot===this.location.defaultRoot?'默认保存在当前项目的 releases 文件夹。':'所选文件夹会收到完整发布包；项目内仍保留冻结版本用于历史记录。';
    this.controls();
  }
  async render() {
    const key = this.ctx.key();
    if (key !== this.key) {
      this.selected = "";
      this.key = key;
      this.el('publish-result').hidden=true;
    }
    this.location=await this.ctx.location();
    if(key!==this.ctx.key())return;
    this.showLocation();
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
      const row = document.createElement("div");
      row.dataset.publish = item.publishId;
      row.className='publish-history-row';
      const title=document.createElement('span');
      title.textContent = `${item.publishId} · ${item.manifest.kind === "scene" ? "场景" : "模块"} · ${item.manifest.recipe} · r${item.manifest.sourceRevision}`;
      const path=document.createElement('code');path.textContent=item.directory;
      const open=document.createElement('button');open.textContent='打开项目内版本';open.onclick=()=>void this.ctx.run(async()=>{await this.ctx.openOutput(item.publishId,false);});
      row.append(title,path,open);
      host.append(row);
    }
    if (!items.length) host.textContent = "尚无已验证的发布版本";
  }
}
