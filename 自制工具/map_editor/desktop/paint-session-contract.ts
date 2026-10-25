import {paintSample} from "./paint-performance.ts";
import {editLayer,layerSource,layerCommand,layerStack} from '../core/paint-layers.ts';
import {validateEdgeBandOptions,applyEdgeBands,edgeBandLayerSignature} from '../core/edge-band-plan.ts';
import {computeEdgeBandPlan} from './edge-band-computer.ts';
import {applyPaintDelta,emptyPaint} from "./paint-command-queue.ts";
import {parsePaintFaceKey,paintResolution} from "../core/surface-paint.ts";
import type { CanvasSession } from "../core/workshop-canvases.ts";
import {
  validateSurfacePaint,
  type SurfacePaint,
} from "../core/surface-paint.ts";
/** Main renderer is the only asset authority. Clients receive snapshots, never write files. */
export class PaintLeaseAuthority {
  readonly leaseId = crypto.randomUUID();
  private live = true;
  private busy = false;
  private receipts = new Map<string, string>();
  private sequence = 0;
  private ownHistory = new WeakSet<object>();
  private undone = 0;
  private scope: Set<string>;
  readonly session: CanvasSession;
  readonly sessionId: string;
  objectId: string;
  private save: () => unknown | Promise<unknown>;
  constructor(
    session: CanvasSession,
    sessionId: string,
    objectId: string,
    save: () => unknown | Promise<unknown>,
  ) {
    this.session = session;
    this.sessionId = sessionId;
    this.objectId = objectId;
    this.save = save;
    const o = session.model.objects?.find((o) => o.objectId === objectId);
    if (
      !o ||
      o.canvasIds[0] !== session.activeId ||
      session.editObjectId !== objectId
    )
      throw Error("请选择可绘画物体");
    session.editable();
    this.scope = new Set(o.cellKeys);

    session.acquireWriter(this.leaseId);
  }
  snapshot() {
    const start=performance.now(),model=structuredClone(this.session.model);paintSample("authoritySnapshot",performance.now()-start);
    return {
      paintProtocol:1,
      leaseId: this.leaseId,
      sessionId: this.sessionId,
      objectId: this.objectId,
      canvasId: this.session.activeId,
      model,
      sequence: this.sequence,
    };
  }
  async dispatch(input: any) {
    if (!this.live) throw Error("绘画会话已失效");
    if (
      !input ||
      input.leaseId !== this.leaseId ||
      typeof input.commandId !== "string" ||
      !/^[\w-]{1,100}$/.test(input.commandId) ||
      !["paint", "undo", "redo", "save", "layer", "target", "outline"].includes(input.kind) ||
      !Number.isSafeInteger(input.baseRevision) ||
      Object.keys(input).some(
        (k) =>
          !["leaseId", "commandId", "baseRevision", "kind", "source", "paintProtocol", "delta", "layerId", "operation", "objectId", "options", "layerIds", "geometryFingerprint", "replace"].includes(
            k,
          ),
      )
    )
      throw Error("绘画命令无效");
    const serialized = JSON.stringify(input);
    if (serialized.length > 32 * 1024 * 1024) throw Error("绘画消息超过32MiB");
    // Freeze the exact parameter command that was signed, including its replace precondition.
    if(input.kind==='outline')input=JSON.parse(serialized);
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(serialized),
      ),
      signature = Array.from(new Uint8Array(digest), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
    if (!this.live) throw Error("绘画会话已失效");
    const seen = this.receipts.get(input.commandId);
    if (seen) {
      if (seen !== signature) throw Error("重复命令内容冲突");
      return {...this.snapshot(),change:"paint"};
    }
    if (
      input.kind === "undo" &&
      (!this.session.past.length ||
        !this.ownHistory.has(this.session.past.at(-1)!))
    )
      throw Error("请返回建模撤销进入绘画前的操作");
    if (input.kind === "redo" && this.undone === 0)
      throw Error("没有本次绘画可重做的笔触");
    if (this.busy) throw Error("上一绘画命令尚未完成");
    if (this.receipts.size >= 4096) throw Error("请保存并重新打开绘画窗口");
    if (input.baseRevision !== this.session.model.revision)
      throw Error("绘画来源修订已过期");
    this.busy = true;
    try {
      if(input.kind==='outline'){
        await this.outline(input);
      }else if(input.kind==='target'){
        const owner=this.session.model.objects?.find(o=>o.objectId===input.objectId),canvas=this.session.model.canvases?.find(c=>c.canvasId===owner?.canvasIds[0]);
        if(!owner||!canvas?.visible||canvas.locked||!owner.cellKeys?.length)throw Error('绘画目标不可用');
        this.session.withWriter(this.leaseId,()=>this.session.setEditObject(owner.objectId));this.objectId=owner.objectId;this.scope=new Set(owner.cellKeys);
      }else if(input.kind==='layer'){
        const source=layerCommand(this.session.active.paintSource,input.operation);
        const before=this.session.model.revision;
        this.session.withWriter(this.leaseId,()=>this.session.paint(source,true));
        if(before!==this.session.model.revision){this.undone=0;this.ownHistory.add(this.session.past.at(-1)!);}
      }else if (input.kind === "paint") {
        const started=performance.now();
        let source=input.source;
        if(input.paintProtocol!==undefined){
          if(input.paintProtocol!==1||input.source!==undefined||!Array.isArray(input.delta)||input.delta.length>262144)throw Error('绘画差量无效');
          const n=paintResolution(this.session.active.voxelStepM),cells=new Set(this.session.active.cells.map(c=>[c.x,c.y,c.z].join(',')));
          for(const p of input.delta){
            if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['key','index','color'].includes(k))||typeof p.key!=='string'||typeof p.index!=='string'||!/^(0|[1-9]\d*)$/.test(p.index)||!Number.isSafeInteger(Number(p.index))||Number(p.index)>=n*n||(p.color!==null&&(typeof p.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(p.color))))throw Error('绘画像素差量无效');
            const [x,y,z,face]=parsePaintFaceKey(p.key),key=[x,y,z].join(',');if(!this.scope.has(key)||!cells.has(key))throw Error('绘画超出目标物体范围');const neighbor=[x,y,z];neighbor[face>>1]+=face%2?-1:1;if(cells.has(neighbor.join(',')))throw Error('绘画面不可见');
          }
          const base=this.session.active.paintSource??emptyPaint();
          source=input.layerId?editLayer(base,input.layerId,applyPaintDelta(layerSource(base,input.layerId),input.delta)):applyPaintDelta(base,input.delta);
        }
        validateSurfacePaint(source, this.session.active.voxelStepM);
        const old = this.session.active.paintSource?.faces ?? {},
          next = source.faces as SurfacePaint["faces"];
        for (const key of new Set([...Object.keys(old), ...Object.keys(next)]))
          if (
            old[key] !== next[key] && JSON.stringify(old[key]) !== JSON.stringify(next[key]) &&
            !this.scope.has(key.split(",").slice(0, 3).join(","))
          )
            throw Error("绘画超出目标物体范围");
        const before = this.session.model.revision;
        this.session.withWriter(this.leaseId, () =>
          this.session.paint(source),
        );
        paintSample("authorityCommit",performance.now()-started);
        if (this.session.model.revision !== before) {
          this.undone = 0;
          this.ownHistory.add(this.session.past.at(-1)!);
        }
      } else if (input.kind === "save") await this.save();
      else {
        this.session.withWriter(this.leaseId, () =>
          this.session[input.kind as "undo" | "redo"](),
        );
        this.undone += input.kind === "undo" ? 1 : -1;
        this.objectId=this.session.editObjectId!;this.scope=new Set(this.session.model.objects!.find(o=>o.objectId===this.objectId)!.cellKeys);
        if (input.kind === "redo")
          this.ownHistory.add(this.session.past.at(-1)!);
      }
      this.receipts.set(input.commandId, signature);
      this.sequence++;
      return {...this.snapshot(),change:input.kind==='target'||input.kind==='undo'||input.kind==='redo'?"target":"paint"};
    } finally {
      this.busy = false;
    }
  }
  private async outline(input:any){
    if(input.paintProtocol!==1||Object.keys(input).some(k=>!['leaseId','commandId','baseRevision','kind','paintProtocol','options','layerIds','geometryFingerprint','replace'].includes(k)))throw Error('结构描边命令无效');
    const validIds=(ids:unknown):ids is string[]=>Array.isArray(ids)&&ids.length>0&&ids.length<=32&&ids.every(id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id))&&new Set(ids).size===ids.length;
    if(!validIds(input.layerIds)||typeof input.geometryFingerprint!=='string'||!input.geometryFingerprint||input.geometryFingerprint.length>512)throw Error('结构描边标识无效');
    const options=validateEdgeBandOptions(input.options),model=this.session.model,canvas=this.session.active,objectId=this.objectId,canvasId=canvas.canvasId;
    this.session.editable();
    if(this.session.editObjectId!==objectId)throw Error('结构描边目标已变化');
    const cells=new Set(canvas.cells.map(c=>[c.x,c.y,c.z].join(','))),n=paintResolution(canvas.voxelStepM);
    const checkPixel=(key:string,index:string)=>{
      const [x,y,z,face]=parsePaintFaceKey(key),cell=[x,y,z].join(',');
      if(!this.scope.has(cell)||!cells.has(cell))throw Error('结构描边超出目标物体范围');
      if(!/^(0|[1-9]\d*)$/.test(index)||!Number.isSafeInteger(Number(index))||Number(index)>=n*n)throw Error('结构描边选区像素无效');
      const adjacent=[x,y,z];adjacent[face>>1]+=face%2?-1:1;if(cells.has(adjacent.join(',')))throw Error('结构描边选区面不可见');
    };
    const mask=options.scope==='selection'?new Set(options.selection):null;
    if(mask)for(const pixel of mask){const split=pixel.lastIndexOf(':');if(split<0)throw Error('结构描边选区无效');checkPixel(pixel.slice(0,split),pixel.slice(split+1));}
    const source=canvas.paintSource;
    if(input.replace!==undefined){
      const replacement=input.replace;
      if(!replacement||typeof replacement!=='object'||Object.keys(replacement).some(k=>!['ids','signature'].includes(k))||!validIds(replacement.ids)||typeof replacement.signature!=='string')throw Error('结构描边替换条件无效');
      if(edgeBandLayerSignature(source,replacement.ids)!==replacement.signature)throw Error('生成图层已修改，请新建一组或返回检查');
      for(const id of replacement.ids){const layer=layerStack(source).find(l=>l.id===id);if(!layer||layer.locked||!layer.visible)throw Error('生成图层已锁定、隐藏或删除');for(const [key,pixels] of Object.entries(layer.faces))for(const index of Object.keys(pixels))checkPixel(key,index);}
    }
    const plan=await computeEdgeBandPlan(model,objectId,options);
    if(!this.live)throw Error('绘画会话已失效');
    if(this.session.model!==model||this.session.model.revision!==input.baseRevision)throw Error('结构描边来源修订已过期');
    if(this.session.editObjectId!==objectId||this.session.activeId!==canvasId)throw Error('结构描边目标已变化');
    this.session.editable();
    if(plan.geometryFingerprint!==input.geometryFingerprint||plan.objectId!==objectId||plan.canvasId!==canvasId||plan.revision!==input.baseRevision)throw Error('结构描边几何已变化，预览已过期');
    if(!plan.pixelCount||!plan.bands.length)throw Error('结构描边没有可写像素结果');
    for(const band of plan.bands)for(const [key,pixels] of Object.entries(band.faces))for(const index of Object.keys(pixels)){checkPixel(key,index);if(mask&&!mask.has(key+':'+index))throw Error('结构描边超出冻结选区');}
    const next=applyEdgeBands(source,plan,{ids:input.layerIds,...(input.replace?{replace:input.replace}:{})});
    const removed=new Set<string>(input.replace?.ids??[]),added=new Set<string>(input.layerIds),beforeLayers=layerStack(source).filter(l=>!removed.has(l.id)),afterLayers=layerStack(next).filter(l=>!added.has(l.id));
    if(JSON.stringify(beforeLayers)!==JSON.stringify(afterLayers))throw Error('结构描边不能修改已有绘图层');
    const before=this.session.model.revision;
    this.session.withWriter(this.leaseId,()=>this.session.paint(next,true));
    if(before!==this.session.model.revision){this.undone=0;this.ownHistory.add(this.session.past.at(-1)!);}
  }
  release() {
    if (!this.live) return;
    this.live = false;
    this.session.releaseWriter(this.leaseId);
  }
}
