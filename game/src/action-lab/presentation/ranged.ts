import type {Projectile} from '../runtime/projectiles';
import type {Hazard} from '../runtime/world';
import {al03} from '../profiles/al03';
/** Original skeleton arrow attachment; projection and danger rings are approved SAMPLE. */
export class NativeRanged {
 private arrow?:HTMLImageElement;
 async load():Promise<void>{this.arrow=await new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>bad(new Error('骷髅弓原箭贴图缺失'));i.src='/__al01-assets/ranged/arrow.png';});}
 draw(ctx:CanvasRenderingContext2D,entities:Projectile[],hazards:Hazard[],point:(a:{x:number;y:number})=>{x:number;y:number},scale:number,now:number):void {
  for(const p of entities){if(now<p.spawnedAt||!p.landing)continue;
   const landing=point(p.landing),position=point(p.position),t=Math.max(0,Math.min(1,(now-p.spawnedAt)/p.duration!)),radius=al03.sample.explosionRadius*scale;
   ctx.strokeStyle='#f0bc69';ctx.fillStyle='#e6a45318';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(landing.x,landing.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.beginPath();ctx.arc(landing.x,landing.y,radius*.85,-Math.PI/2,-Math.PI/2+t*Math.PI*2);ctx.stroke();
   ctx.fillStyle='#f6d8a4';ctx.font='10px monospace';ctx.fillText(`${Math.max(0,p.expiresAt-now).toFixed(1)}s`,landing.x+radius+3,landing.y);
   ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(position.x,position.y,scale*.2,scale*.1,0,0,Math.PI*2);ctx.fill();
   ctx.save();ctx.translate(position.x,position.y-p.altitude*scale*.6);ctx.rotate(-Math.atan2(p.velocity.y,p.velocity.x)+Math.PI/4);
   if(this.arrow)ctx.drawImage(this.arrow,-scale*.25,-scale*.25,scale*.5,scale*.65);
   ctx.restore();
  }
  for(const h of hazards){if(h.kind!=='ranged-explosion'||!h.origin)continue;const p=point(h.origin);
   const t=1-Math.max(0,h.expires-now)/al03.sample.explosionLifetime;
   ctx.strokeStyle='#ffe5a4';ctx.fillStyle='#ffb95766';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,h.range*scale*(.85+.15*t),0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.lineWidth=1;
 }
 dispose():void{this.arrow=undefined;}
}
