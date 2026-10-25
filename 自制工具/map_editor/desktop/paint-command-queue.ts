import {paintCount,paintSample,paintBytes} from "./paint-performance.ts";
import {layerStack,layerSource,editLayer,layerCommand,type LayerCommand} from '../core/paint-layers.ts';
import type {EdgeBandOptions} from '../core/edge-band-plan.ts';
import {
  type SurfacePaint,
  MAX_PAINT_PIXELS,
  MAX_PAINT_FACES,
} from "../core/surface-paint.ts";
export type PaintDelta = { key: string; index: string; color: string | null }[];
export const emptyPaint = (): SurfacePaint => ({
  schema: "xinghai-surface-paint-1",
  density: 64,
  faces: {},
});
export function paintDelta(
  before: SurfacePaint,
  next: SurfacePaint,
): PaintDelta {
  const out: PaintDelta = [];
  for (const key of new Set([
    ...Object.keys(before.faces),
    ...Object.keys(next.faces),
  ])) {
    if(before.faces[key]===next.faces[key])continue;
    for (const index of new Set([
      ...Object.keys(before.faces[key] ?? {}),
      ...Object.keys(next.faces[key] ?? {}),
    ]))
      if (before.faces[key]?.[index] !== next.faces[key]?.[index])
        out.push({ key, index, color: next.faces[key]?.[index] ?? null });
  }
  return out;
}
const paintCounts = new WeakMap<SurfacePaint, {faces:number; pixels:number}>();
function counts(source:SurfacePaint){let c=paintCounts.get(source);if(!c){c={faces:Object.keys(source.faces).length,pixels:Object.values(source.faces).reduce((n,f)=>n+Object.keys(f).length,0)};paintCounts.set(source,c);}return c;}
/** Immutable sparse update: only changed faces are copied; previous sources remain valid. */
export function applyPaintDelta(source: SurfacePaint, delta: PaintDelta):SurfacePaint {
 if(source.layers){const layer=[...source.layers].reverse().find(l=>l.visible&&!l.locked);if(!layer)throw Error('没有可绘制图层');return editLayer(source,layer.id,applyPaintDelta(layerSource(source,layer.id),delta));}
 paintCount("sourceCOW");
 const next={...source,faces:{...source.faces}}, tally={...counts(source)}, copied=new Set<string>();
 for(const p of delta){
   const prior=next.faces[p.key]?.[p.index];if(prior===(p.color??undefined))continue;
   if(!copied.has(p.key)){next.faces[p.key]={...next.faces[p.key]};copied.add(p.key);}
   if(p.color===null){delete next.faces[p.key][p.index];tally.pixels--;}
   else{next.faces[p.key][p.index]=p.color;if(prior===undefined)tally.pixels++;}
 }
 if(!copied.size)return source;
 for(const key of copied){const was=!!source.faces[key],has=Object.keys(next.faces[key]).length>0;if(!has)delete next.faces[key];tally.faces+=Number(has)-Number(was);}
 if(tally.faces>MAX_PAINT_FACES||tally.pixels>MAX_PAINT_PIXELS)throw Error('绘画像素预算超限');
 paintCounts.set(next,tally);return next;
}

type Item = {
  kind: string;
  delta?: PaintDelta;
  layerId?: string;
  operation?: LayerCommand;
  objectId?: string;
  outline?: {options:EdgeBandOptions;layerIds:string[];geometryFingerprint:string;replace?:{ids:string[];signature:string}};
  previewSource?: SurfacePaint;
  input?: any;
  resolve: () => void;
  reject: (e: Error) => void;
};
/** One IPC writer, bounded unsent deltas. A failed command is retained verbatim for retry. */
export class PaintCommandQueue {
  private items: Item[] = [];
  private running = false;
  failed = false;
  private snapshot: any;
  private optimistic: SurfacePaint;
  private send: (i: any) => Promise<any>;
  private changed: (snapshot: any, source: SurfacePaint) => void;
  constructor(
    snapshot: any,
    send: (i: any) => Promise<any>,
    changed: (snapshot: any, source: SurfacePaint) => void,
  ) {
    this.snapshot = snapshot;
    this.optimistic = structuredClone(this.confirmedSource());
    this.send = send;
    this.changed = changed;
  }
  get pending() {
    return this.items.length;
  }
  /** Read-only borrowed source. Writers use applyPaintDelta; never mutate this value. */
  source(): SurfacePaint { paintCount("sourceRead");return this.optimistic; }
  private apply(source:SurfacePaint,item:Pick<Item,'delta'|'layerId'|'operation'|'previewSource'>){return item.previewSource??(item.operation?layerCommand(source,item.operation):item.delta?(item.layerId?editLayer(source,item.layerId,applyPaintDelta(layerSource(source,item.layerId),item.delta)):applyPaintDelta(source,item.delta)):source);}
  private compose(){paintCount("queueCompose");let source=this.confirmedSource();if(!this.failed)for(const item of this.items)source=this.apply(source,item);this.optimistic=source;}
  layer(operation:LayerCommand){if(this.pending||this.failed)return Promise.reject(Error('请先等待笔触确认'));return this.enqueue({kind:'layer',operation});}
  target(objectId:string){if(this.pending||this.failed)return Promise.reject(Error('请先等待笔触确认'));return this.enqueue({kind:'target',objectId});}
  outline(options:EdgeBandOptions,layerIds:string[],geometryFingerprint:string,replace?:{ids:string[];signature:string},previewSource?:SurfacePaint){
    if(this.pending||this.failed)return Promise.reject(Error('请先等待笔触确认'));
    return this.enqueue({kind:'outline',outline:{options:structuredClone(options),layerIds:[...layerIds],geometryFingerprint,...(replace?{replace:structuredClone(replace)}:{})},previewSource});
  }
  paint(before: SurfacePaint, next: SurfacePaint, layerId?:string) {
    if (this.failed) return Promise.reject(Error("提交失败，先重试或放弃队列"));
    if(this.items.some(item=>item.kind==='outline'))return Promise.reject(Error('请等待结构描边确认后继续绘画'));
    if (this.items.length >= 4)
      return Promise.reject(Error("绘画队列已满，请等待确认"));
    const delta = paintDelta(before, next);
    if (
      JSON.stringify(delta).length +
        this.items.reduce(
          (n, i) => n + JSON.stringify(i.delta ?? []).length,
          0,
        ) >
      32 * 1024 * 1024
    )
      return Promise.reject(Error("排队笔触超过32MiB预算"));
    if (!delta.length) return Promise.resolve();
    this.apply(this.source(),{delta,layerId});
    return this.enqueue({ kind: "paint", delta, layerId });
  }
  command(kind: string) {
    if (this.failed) return Promise.reject(Error("提交失败，先重试或放弃队列"));
    return this.enqueue({ kind });
  }
  private enqueue(value: Pick<Item, "kind" | "delta" | "layerId" | "operation" | "objectId" | "outline" | "previewSource">) {
    const promise = new Promise<void>((resolve, reject) =>
      this.items.push({ ...value, resolve, reject }),
    );
    this.optimistic=this.apply(this.optimistic,value);
    this.changed(this.snapshot, this.source());
    void this.pump();
    return promise;
  }
  private async pump() {
    if (this.running || this.failed) return;
    this.running = true;
    while (this.items.length && !this.failed) {
      const item = this.items[0];
      try {
        item.input ??= {
          leaseId: this.snapshot.leaseId,
          commandId: crypto.randomUUID(),
          baseRevision: this.snapshot.model.revision,
          kind: item.kind,
          ...(item.operation?{operation:item.operation}:{}),
          ...(item.objectId?{objectId:item.objectId}:{}),
          ...(item.outline?{paintProtocol:1,...item.outline}:{}),
          ...(item.delta
            ? this.snapshot.paintProtocol===1?{paintProtocol:1,delta:item.delta,...(item.layerId?{layerId:item.layerId}:{})}:{ source: this.apply(this.confirmedSource(),item) }
            : {}),
        };
        paintBytes("ipcBytes",item.input);const started=performance.now();
        const reply=await this.send(item.input);
        if(reply.leaseId!==this.snapshot.leaseId||reply.model.revision<this.snapshot.model.revision||(Number.isInteger(this.snapshot.sequence)&&(!Number.isInteger(reply.sequence)||reply.sequence<=this.snapshot.sequence)))throw Error('过期或租约不符的绘画回执');
        this.snapshot = reply;paintSample("confirmation",performance.now()-started);
        this.items.shift();
        if(!item.delta||this.snapshot.change!=="paint")this.compose();
        this.changed(this.snapshot, this.source());
        item.resolve();
      } catch (e) {
        this.failed = true;
        this.compose();
        this.changed(this.snapshot, this.confirmedSource());
        item.reject(e as Error);
        for (const later of this.items.slice(1))
          later.reject(Error("前一笔失败，后续笔触尚未提交"));
      }
    }
    this.running = false;
  }
  private confirmedSource(): SurfacePaint {
    return (
      this.snapshot.source ??
      this.snapshot.model.canvases.find(
        (c: any) => c.canvasId === this.snapshot.canvasId,
      )?.paintSource ??
      emptyPaint()
    );
  }
  async retry() {
    if (!this.failed) return;
    this.failed = false;
    this.compose();
    const first = this.items[0];
    const p = new Promise<void>((resolve, reject) => {
      first.resolve = resolve;
      first.reject = reject;
    });
    void this.pump();
    await p;
    await this.drain();
  }
  discard() {
    if (this.running) throw Error("正在确认的笔触不能放弃");
    this.items = [];
    this.failed = false;
    this.compose();
    this.changed(this.snapshot, this.confirmedSource());
  }
  async drain() {
    while (this.running || this.items.length) {
      if (this.failed) throw Error("提交失败，队列已冻结");
      await new Promise((r) => setTimeout(r, 5));
    }
  }
}
