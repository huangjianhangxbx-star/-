import * as THREE from "three";
import type { MapView } from "./view.ts";
import {readPreviewState,type ModelPreviewState} from './workshop-workspace-state.ts';
import type {SavedEditorView} from './editor-workspace-state.ts';
import {
  ScenePreviewLayer,
  type ScenePreviewData,
} from "./scene-preview-layer.ts";
export type PreviewSceneOptions = {
  key: string;
  scenes: { sceneId: string; name: string }[];
  selectedSceneId: string;
  modelId?: string;
};
type Deps = {
  view: MapView;
  mount: (root: THREE.Object3D | null) => void;
  options: () => PreviewSceneOptions;
  readScene: (id: string) => Promise<ScenePreviewData>;
  error?: (message: string) => void;
  fitModel?:()=>void;
  modelFrameKey?:()=>string;
  captureModelView?:()=>SavedEditorView;
  restoreModelView?:(view:SavedEditorView)=>void;
};
/** Selects read-only content for the existing right-hand model viewport. */
export class ModelScenePreview {
  private controls = document.createElement("div");
  private scope = document.createElement("select");
  private scenes = document.createElement("select");
  private status = document.createElement("span");
  private layer: ScenePreviewLayer | null = null;
  private key = "";
  private dataKey = "";
  private projectKey = "";
  private modelId = "";
  private request = 0;
  private queued:{id:string;force:boolean;request:number;promise:Promise<void>;resolve:()=>void}|null=null;
  private disposed=false;
  private modelNeedsFit=false;
  private modelFrame='';
  private worldModelCamera:SavedEditorView|null=null;
  private sceneCameras:Record<string,SavedEditorView>={};
  private camera: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    up: THREE.Vector3;
    zoom: number;
    far: number;
    near:number;
    framing:THREE.Box3|null;
  } | null = null;
  private timer: number;
  private observer: ResizeObserver;
  private actions: HTMLElement | null = null;
  private originalTop = "";
  private faceReferences=()=>{this.layer?.faceCamera(this.deps.view.camera);this.rememberSceneCamera();};
  private reset = (e: Event) => {
    if (this.scope.value !== "scene") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (this.layer) this.fit();
  };
  constructor(private deps: Deps) {
    deps.view.controls.addEventListener('change',this.faceReferences);
    this.controls.className = "model-preview-controls";
    this.scope.setAttribute("aria-label", "预览内容");
    this.scope.innerHTML =
      '<option value="model">当前模型</option><option value="scene">搭建场景</option>';
    this.scenes.setAttribute("aria-label", "预览搭建场景");
    this.scenes.hidden = true;
    this.status.className = "model-preview-status";
    this.status.setAttribute("aria-live", "polite");
    this.controls.append(this.scope, this.scenes, this.status);
    deps.view.host.parentElement!.append(this.controls);
    this.actions =
      deps.view.host.parentElement!.querySelector<HTMLElement>(".view-actions");
    if (this.actions) this.controls.append(this.actions);
    this.originalTop = deps.view.host.style.top;
    this.observer = new ResizeObserver(() => {
      deps.view.host.style.top =
        this.controls.getBoundingClientRect().height + "px";
    });
    this.observer.observe(this.controls);
    this.actions
      ?.querySelector("#previewhome")
      ?.addEventListener("click", this.reset, true);
    deps.view.host
      .parentElement!.querySelector<HTMLElement>(".view-label")
      ?.setAttribute("hidden", "");
    this.scope.onchange = () => {this.rememberSceneCamera();void this.refresh(true);};
    this.scenes.onchange = () => {this.rememberSceneCamera();void this.refresh(true);};
    this.refreshOptions();
    this.timer = window.setInterval(() => this.refreshOptions(), 500);
  }
  private refreshOptions() {
    const options = this.deps.options(),
      key = JSON.stringify(options);
    if (this.projectKey !== options.key) {
      this.projectKey = options.key;
      this.scope.value = "model";
      this.clear();
      this.sceneCameras={};
    }
    if (this.modelId !== (options.modelId ?? "")) {
      this.modelId = options.modelId ?? "";
      if (this.scope.value === "scene") {
        this.dataKey = "";
      }
    }
    if (this.key === key) return;
    this.key = key;
    const selected = this.scenes.value;
    this.scenes.replaceChildren(
      ...options.scenes.map((scene) => new Option(scene.name, scene.sceneId)),
    );
    this.scenes.value = options.scenes.some((s) => s.sceneId === selected)
      ? selected
      : options.scenes.some((s) => s.sceneId === options.selectedSceneId)
        ? options.selectedSceneId
        : (options.scenes[0]?.sceneId ?? "");
    this.scenes.disabled = !options.scenes.length;
    if (this.scope.value === "scene" && !options.scenes.length) {
      this.clear();
      this.status.textContent = "项目中尚无搭建场景";
    }
    this.scenes.hidden = this.scope.value !== "scene";
  }
  /** Coalesce synchronous refresh notifications; this is not animation-frame throttling. */
  refresh(force = false):Promise<void> {
    if(this.disposed)return Promise.resolve();
    this.refreshOptions();
    this.scenes.hidden = this.scope.value !== "scene";
    if (this.scope.value !== "scene") {
      this.clear();
      return Promise.resolve();
    }
    const id = this.scenes.value;
    if (!id) {
      this.status.textContent = "项目中尚无搭建场景";
      return Promise.resolve();
    }
    const request = ++this.request;
    this.layer?.invalidate();
    if(this.queued){this.queued.id=id;this.queued.force||=force;this.queued.request=request;return this.queued.promise;}
    let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done),queued={id,force,request,promise,resolve};this.queued=queued;
    queueMicrotask(()=>{if(this.queued===queued)this.queued=null;void this.refreshScene(queued.id,queued.force,queued.request).finally(queued.resolve);});
    return promise;
  }
  private async refreshScene(id:string,force:boolean,request:number){
    if(this.disposed||request!==this.request||this.scope.value!=='scene')return;
    this.status.textContent = "读取搭建场景…";
    try {
      const data = await this.deps.readScene(id);
      if (request !== this.request || this.scope.value !== "scene") return;
      const key = JSON.stringify([
        this.projectKey,
        data.contentKey??null,
        data.scene.sceneId,
        data.scene.revision,
        [...data.assets].map(([id, a]) => [id, a.revision]),
        [...data.binaries].map(([id, b]) => [
          id,
          b.row.revision,
          b.data.length,
        ]),
      ]);
      if (!force && key === this.dataKey) {
        this.status.textContent = "只读预览";
        return;
      }
      const fit = this.deps.view.host.dataset.previewScene !== id;
      if (!this.camera) {
        const view = this.deps.view;
        this.camera = {
          position: view.camera.position.clone(),
          target: view.controls.target.clone(),
          up: view.camera.up.clone(),
          zoom: view.camera.zoom,
          far: view.camera.far,
          near:view.camera.near,
          framing:view.framingBounds,
        };
        this.modelFrame=this.deps.modelFrameKey?.()??'';
        this.worldModelCamera??=this.deps.captureModelView?.()??null;
      }
      const layer=this.layer??=new ScenePreviewLayer();
      const applied=await layer.update(data);
      if(!applied||request!==this.request||this.scope.value!=="scene"||this.layer!==layer||this.disposed)return;
      layer.faceCamera(this.deps.view.camera);
      this.deps.mount(layer.root);
      this.deps.view.display.setProfile('assembly');
      this.dataKey = key;
      this.deps.view.host.dataset.previewSource = "scene";
      this.deps.view.host.dataset.previewScene = id;
      this.deps.view.host.dataset.previewInstances = String(
        this.layer.instanceCount,
      );
      this.deps.view.host.dataset.previewVoxels = String(this.layer.voxelCount);
      if (fit) {
        const saved=this.sceneCameras[id];
        if(saved)this.restoreSceneCamera(saved);else this.fit();
      }
      this.deps.view.requestPaintRender();
      this.status.textContent = "只读预览";
    } catch (error: any) {
      if (request !== this.request) return;
      this.status.textContent = "预览读取失败";
      this.deps.error?.(error.message);
    }
  }
  private fit() {
    const box = this.layer!.bounds();
    if (box.isEmpty()) return;
    this.deps.view.fitBounds(box);
  }
  private clear() {
    this.request++;
    if (this.layer) this.deps.mount(null);
    this.layer?.dispose();
    this.layer = null;
    this.dataKey = "";
    this.status.textContent = "";
    delete this.deps.view.host.dataset.previewScene;
    delete this.deps.view.host.dataset.previewInstances;
    delete this.deps.view.host.dataset.previewVoxels;
    this.deps.view.host.dataset.previewSource = "model";
    this.deps.view.display.setProfile('preview');
    if(this.worldModelCamera&&this.deps.restoreModelView)this.deps.restoreModelView(this.worldModelCamera);
    else if (this.camera) {
      const view = this.deps.view;
      view.camera.position.copy(this.camera.position);
      view.camera.up.copy(this.camera.up);
      view.camera.zoom = this.camera.zoom;
      view.camera.far = this.camera.far;
      view.camera.near=this.camera.near;view.restoreFraming(null);
      view.controls.target.copy(this.camera.target);
      view.camera.updateProjectionMatrix();
      view.controls.update();
    }
    this.camera=null;this.worldModelCamera=null;this.modelNeedsFit=false;this.modelFrame='';
    this.deps.view.requestPaintRender();
  }
  private rememberSceneCamera(){
    const id=this.deps.view.host.dataset.previewScene;
    if(!id||!this.layer)return;
    const view=this.deps.view;
    this.sceneCameras[id]={content:'scene',position:view.camera.position.toArray(),target:view.controls.target.toArray(),up:view.camera.up.toArray(),zoom:view.camera.zoom};
  }
  private restoreSceneCamera(saved:SavedEditorView){
    const v=this.deps.view;v.restoreFraming(null);v.camera.position.fromArray(saved.position);v.controls.target.fromArray(saved.target);v.camera.up.fromArray(saved.up);v.camera.zoom=saved.zoom;const distance=v.camera.position.distanceTo(v.controls.target);v.camera.near=Math.max(.0001,distance*1e-4);v.camera.far=Math.max(500,distance*10);v.camera.updateProjectionMatrix();v.controls.update();
  }
  captureState():ModelPreviewState{
    this.rememberSceneCamera();
    return readPreviewState({scope:this.scope.value,sceneId:this.scenes.value,modelCamera:this.scope.value==='model'?this.deps.captureModelView?.():this.worldModelCamera,sceneCameras:this.sceneCameras});
  }
  async restoreState(value:unknown){
    const state=readPreviewState(value);this.refreshOptions();
    this.worldModelCamera=state.modelCamera;this.sceneCameras=state.sceneCameras;
    this.scope.value=state.scope;
    if([...this.scenes.options].some(o=>o.value===state.sceneId))this.scenes.value=state.sceneId;
    await this.refresh(true);
  }
  dispose() {
    this.disposed=true;
    this.deps.view.controls.removeEventListener('change',this.faceReferences);
    window.clearInterval(this.timer);
    this.observer.disconnect();
    this.clear();
    this.actions
      ?.querySelector("#previewhome")
      ?.removeEventListener("click", this.reset, true);
    if (this.actions) this.deps.view.host.parentElement?.append(this.actions);
    this.deps.view.host.style.top = this.originalTop;
    this.controls.remove();
    this.deps.view.host.parentElement
      ?.querySelector<HTMLElement>(".view-label")
      ?.removeAttribute("hidden");
  }
}
