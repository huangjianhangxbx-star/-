import {
  type SurfacePixel,
  pixelKey,
  PaintSurfaceDomain,
} from "./paint-surface-domain.ts";
export class PaintSelection {
  chart: string | null = null;
  keys = new Set<string>();
  active = false;
  revision = 0;
  clear() {
    this.revision++;
    this.active = false;
    this.chart = null;
    this.keys.clear();
  }
  change(
    chart: string,
    pixels: SurfacePixel[],
    mode: "replace" | "add" | "subtract",
  ) {
    if (this.active && this.chart !== chart && mode !== "replace")
      throw Error("选区仅限同一平面，请先清除");
    this.revision++;
    if (mode === "replace") this.keys.clear();
    this.active = true;
    this.chart = chart;
    for (const p of pixels)
      if (mode === "subtract") this.keys.delete(pixelKey(p));
      else this.keys.add(pixelKey(p));
  }
  pixels(domain:PaintSurfaceDomain):SurfacePixel[]{
    if(!this.active||!this.chart)return [];
    const [face,plane]=this.chart.split(':').map(Number),chart={face,plane},t=[0,1,2].filter(a=>a!==(face>>1)),out:SurfacePixel[]=[];
    for(const id of this.keys){const [key,index]=id.split(':'),c=key.split(',').map(Number),i=Number(index);
      const p=domain.pixel(chart,c[t[0]]*domain.n+i%domain.n,c[t[1]]*domain.n+Math.floor(i/domain.n));
      if(p&&pixelKey(p)===id)out.push(p);
    }
    return out;
  }
  allows(p: SurfacePixel) {
    return !this.active || this.keys.has(pixelKey(p));
  }
  invert(pixels: SurfacePixel[]) {
    this.revision++;
    this.keys = new Set(
      pixels.filter((p) => !this.keys.has(pixelKey(p))).map(pixelKey),
    );
    this.active = true;
  }
}
export function colorDistance(a: string, b: string) {
  return Math.max(
    ...[1, 3, 5].map((i) =>
      Math.abs(
        parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16),
      ),
    ),
  );
}
export function fillPixels(
  domain: PaintSurfaceDomain,
  start: SurfacePixel,
  range: string,
  selection: PaintSelection,
  sample: (p: SurfacePixel) => string,
  tolerance: number,
  visible: (p: SurfacePixel) => boolean,
) {
  if (range === "selection") {
    if (!selection.active || !selection.keys.size) throw Error("贴图选区为空");
    return domain
      .chartPixels(domain.chart(start))
      .filter((p) => selection.allows(p) && visible(p));
  }
  const target = sample(start);
  return domain.connected(
    start,
    (p) =>
      (range !== "face" || p.key === start.key) &&
      selection.allows(p) &&
      visible(p) &&
      colorDistance(sample(p), target) <= tolerance,
  );
}

/** Cooperative counterpart of fillPixels. No author write until the complete mask is accepted. */
export async function fillPixelsChunked(domain:PaintSurfaceDomain,start:SurfacePixel,range:string,selection:PaintSelection,sample:(p:SurfacePixel)=>string,tolerance:number,visible:(p:SurfacePixel)=>boolean,cancelled:()=>boolean,yieldControl:()=>Promise<void>,progress:(n:number)=>void=()=>{}) {
 const chart=domain.chart(start),target=sample(start),out:SurfacePixel[]=[],seen=new Set<string>(),pending=[domain.uv(start)];let since=performance.now();
 const checkpoint=async()=>{if(cancelled())return false;if(performance.now()-since>=5){progress(out.length);await yieldControl();since=performance.now();}return !cancelled();};
 if(range==='selection'){
   if(!selection.active||!selection.keys.size)throw Error('贴图选区为空');
   for(const id of selection.keys){if(!await checkpoint())return null;const [key,index]=id.split(':'),coords=key.split(',').map(Number),face=coords[3],axis=face>>1;if(face!==chart.face||coords[axis]+(face%2?0:1)!==chart.plane)continue;const t=[0,1,2].filter(a=>a!==axis),i=Number(index),p=domain.pixel(chart,coords[t[0]]*domain.n+i%domain.n,coords[t[1]]*domain.n+Math.floor(i/domain.n));if(p&&visible(p))out.push(p);}
 }else while(pending.length){
   if(!await checkpoint())return null;
   const uv=pending.pop()!,key=uv.join(',');if(seen.has(key))continue;seen.add(key);const p=domain.pixel(chart,...uv);
   if(!p||(range==='face'&&p.key!==start.key)||!selection.allows(p)||!visible(p)||colorDistance(sample(p),target)>tolerance)continue;
   out.push(p);if(out.length>262144)throw Error('填充超过像素预算');
   pending.push([uv[0]-1,uv[1]],[uv[0]+1,uv[1]],[uv[0],uv[1]-1],[uv[0],uv[1]+1]);
 }
 if(out.length>262144)throw Error('填充超过像素预算');return cancelled()?null:out;
}
