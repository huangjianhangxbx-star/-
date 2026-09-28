import type {GameState,Pos} from './core/types';
/** Cosmetic collection flight; currency is credited exactly once by the simulation. */
export class LootFeedback{
 private state:GameState|null=null;private seen=new Set<number>();private layer:HTMLElement;
 constructor(host:HTMLElement){this.layer=document.createElement('div');this.layer.id='loot-feedback';this.layer.setAttribute('aria-hidden','true');host.append(this.layer);}
 update(s:GameState,project:(p:Pos)=>{x:number;y:number}){
  if(this.state!==s){this.state=s;this.seen.clear();this.layer.replaceChildren();}
  const target=document.querySelector<HTMLElement>('#fragments');if(!target)return;
  for(const effect of s.effects){if(effect.kind!=='loot'||this.seen.has(effect.id))continue;this.seen.add(effect.id);if(this.seen.size>512)this.seen.delete(this.seen.values().next().value!);
   const from=project(effect.from),r=target.getBoundingClientRect(),to={x:r.x+r.width/2,y:r.y+r.height/2};const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   for(let i=0;i<3;i++){const el=document.createElement('i');el.className='loot-particle';el.style.left=from.x+'px';el.style.top=(from.y-24)+'px';this.layer.append(el);const dx=to.x-from.x,dy=to.y-from.y+24;
    const animation=el.animate([{transform:'translate(-50%,-50%) rotate(45deg) scale(.6)',opacity:0},{transform:`translate(${dx*.22+(i-1)*22}px,${dy*.16-55}px) rotate(130deg) scale(1.15)`,opacity:1,offset:.28},{transform:`translate(${dx}px,${dy}px) rotate(225deg) scale(.3)`,opacity:.2}],{duration:reduced?180:880+i*70,easing:'cubic-bezier(.35,0,.75,.35)',fill:'forwards'});
    animation.onfinish=()=>{el.remove();if(i===2){target.animate([{color:'#fff7bb',transform:'scale(1.4)'},{color:'#d8d4c7',transform:'scale(1)'}],{duration:240,easing:'ease-out'});}};
   }
  }
 }
}
