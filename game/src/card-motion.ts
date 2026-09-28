/** Hand identity survives targeting and sorting; only membership changes animate. */
export class CardMotion {
 private initialized=false;
 private exits=new Map<string,{x:number;y:number}>();
 used(id:string,target:{x:number;y:number}){this.exits.set(id,target);}
 render(host:HTMLElement,markup:string){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const old=new Map([...host.querySelectorAll<HTMLButtonElement>('[data-card]')].map(el=>[el.dataset.card!,{el,rect:el.getBoundingClientRect()}]));
  const template=document.createElement('template');template.innerHTML=markup;
  const next=[...template.content.children] as HTMLButtonElement[];
  const ids=new Set(next.map(el=>el.dataset.card!));
  for(const [id,{el,rect}] of old){
   if(ids.has(id))continue;
   if(!reduced&&this.initialized){
    const ghost=el.cloneNode(true) as HTMLElement;ghost.removeAttribute('data-card');ghost.classList.add('card-ghost');ghost.setAttribute('aria-hidden','true');
    Object.assign(ghost.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});document.body.append(ghost);
    const target=this.exits.get(id),dx=target?target.x-rect.x-rect.width/2:30,dy=target?target.y-rect.y-rect.height/2:100;
    const anim=ghost.animate([{translate:'0 0',scale:1,opacity:1},{translate:`${dx*.2}px ${dy*.2}px`,scale:1.08,opacity:1,offset:.28},{translate:`${dx}px ${dy}px`,scale:target?.28:.65,rotate:target?'8deg':'-12deg',opacity:0}],{duration:target?340:220,easing:'cubic-bezier(.4,0,.8,.4)'});
    anim.onfinish=()=>ghost.remove();anim.oncancel=()=>ghost.remove();
   }
   this.exits.delete(id);el.remove();
  }
  let entering=0;
  for(const fresh of next){
   const previous=old.get(fresh.dataset.card!),el=previous?.el||fresh;
   el.className=fresh.className;el.title=fresh.title;
   host.append(el);
  }
  for(const fresh of next){
   const previous=old.get(fresh.dataset.card!),el=host.querySelector<HTMLElement>(`[data-card="${fresh.dataset.card}"]`)!;
   if(reduced||!this.initialized)continue;
   const rect=el.getBoundingClientRect();
   if(previous){
    const dx=previous.rect.x-rect.x,dy=previous.rect.y-rect.y;
    if(Math.abs(dx)>1||Math.abs(dy)>1){el.getAnimations().filter(a=>a.id==='hand-layout').forEach(a=>a.cancel());const a=el.animate([{translate:`${dx}px ${dy}px`},{translate:'0 0'}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});a.id='hand-layout';}
   }else{
    const origin=document.querySelector('#draw-btn')!.getBoundingClientRect();
    el.animate([{translate:`${origin.x-rect.x}px ${origin.y-rect.y}px`,scale:.35,rotate:'-14deg',opacity:0},{translate:'0 -10px',scale:1.03,rotate:'1deg',opacity:1,offset:.76},{translate:'0 0',scale:1,rotate:'0deg',opacity:1}],{duration:320,delay:Math.min(entering++,3)*45,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'});
   }
  }
  this.initialized=true;
 }
}
