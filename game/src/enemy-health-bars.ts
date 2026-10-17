import {enemyHealth} from './core/enemy-health';
import type {GameState,Pos} from './core/types';
/** Read-only, screen-sized labels. Sprite canvases include transparent margins, so use a body anchor. */
export class EnemyHealthBars{
 readonly host=document.createElement('div');private nodes=new Map<string,HTMLElement>();
 constructor(root:HTMLElement){this.host.id='enemy-health-bars';this.host.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:22';root.append(this.host);}
 get count(){return this.nodes.size;}
 update(s:GameState,project:(p:Pos)=>Pos){
  const keep=new Set<string>(),rect=this.host.getBoundingClientRect();
  for(const u of s.units){const value=enemyHealth(s,u);if(!value)continue;const p=project({x:u.pos.x,y:u.pos.y-(u.enemyVisualProfileId==='ranged'?1.15:1.1)});
   if(p.x<rect.left-50||p.x>rect.right+50||p.y<rect.top||p.y>rect.bottom)continue;
   keep.add(u.id);let el=this.nodes.get(u.id);if(!el){el=document.createElement('div');el.dataset.enemyHp=u.id;el.style.cssText='position:absolute;width:66px;height:8px;background:#070a0e;border:1px solid #c2bca7;box-shadow:0 1px 2px #000;transform:translate(-50%,-100%);pointer-events:none';el.innerHTML='<i style="display:block;height:100%;background:#b95663"></i>';this.host.append(el);this.nodes.set(u.id,el);}
   el.style.left=p.x-rect.left+'px';el.style.top=p.y-rect.top+'px';el.firstElementChild!.setAttribute('style',`display:block;height:100%;background:#b95663;width:${value.ratio*100}%`);el.setAttribute('role','meter');el.setAttribute('aria-label',u.name+'生命');el.setAttribute('aria-valuenow',String(value.hp));el.setAttribute('aria-valuemax',String(value.maxHp));
  }
  for(const [id,el]of this.nodes)if(!keep.has(id)){el.remove();this.nodes.delete(id);}
 }
 dispose(){this.host.remove();this.nodes.clear();}
}
