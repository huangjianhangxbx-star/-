import type {IceColumn,DerivedEffect} from '../runtime/world';
/** Selected original sprite pixels; display motion is explicitly AL02 SAMPLE. */
export class NativeColumns {
 private column?:HTMLImageElement;private axe?:HTMLImageElement;
 async load():Promise<{column:boolean;axe:boolean}>{
  const load=(name:string)=>new Promise<HTMLImageElement>((ok,bad)=>{const image=new Image();image.onload=()=>ok(image);image.onerror=()=>bad(new Error(`${name} resource missing`));image.src=`/__al01-assets/effects/${name}.png`;});
  const results=await Promise.allSettled([load('column'),load('axe')]);
  this.column=results[0].status==='fulfilled'?results[0].value:undefined;this.axe=results[1].status==='fulfilled'?results[1].value:undefined;
  return {column:!!this.column,axe:!!this.axe};
 }
 draw(ctx:CanvasRenderingContext2D,columns:readonly IceColumn[],effects:readonly DerivedEffect[],width:number,height:number,scale:number,sim:number):void {
  if(this.column)for(const column of columns){const h=scale*1.6,w=h*this.column.width/this.column.height;ctx.drawImage(this.column,width/2+column.x*scale-w/2,height/2-column.y*scale-h*.9,w,h);}
  if(this.axe)for(const effect of effects){if(effect.kind!=='axe')continue;
   const phase=Math.min(1,Math.max(0,1-(effect.expires-sim)/.2));
   ctx.save();ctx.translate(width/2+effect.x*scale,height/2-effect.y*scale);ctx.rotate(-effect.facing+(phase-.5)*1.5);
   const w=scale*2,h=w*this.axe.height/this.axe.width;ctx.drawImage(this.axe,scale*.4,-h/2,w,h);ctx.restore();
  }
 }
 dispose():void{this.column=this.axe=undefined;}
}
