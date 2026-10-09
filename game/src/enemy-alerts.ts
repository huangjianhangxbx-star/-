import type {GameState,Pos,Unit} from './core/types';
import {positionVisible} from './core/visibility';
export function enemyAlert(s:GameState,u:Unit):'!'|'?'|'○'|null{
 if(!s.exploration||u.team!=='enemy'||u.life!=='active'||!u.pursuitTargetId||!positionVisible(s,u.pos))return null;
 const b=u.enemyV2?.brain;if(b){if(!b.known)return null;if(b.decision==='search')return s.time-b.known.at<1.5?'?':null;return s.time-(b.chosenAt??-10)<.65?'!':'○';}
 const sense=u.enemySense;if(!sense)return null;
 if(sense.lostAt!==undefined)return s.time-sense.lostAt<1.5?'?':null;
 return s.time-(sense.alertedAt??-10)<.65?'!':'○';
}
export class EnemyAlerts{
 private host:HTMLElement;private nodes=new Map<string,HTMLElement>();
 constructor(root:HTMLElement){this.host=document.createElement('div');this.host.id='enemy-alerts';root.append(this.host);}
 update(s:GameState,project:(p:Pos)=>Pos){const keep=new Set<string>();if(s.phase==='battle')for(const u of s.units){const symbol=enemyAlert(s,u);if(!symbol)continue;keep.add(u.id);let el=this.nodes.get(u.id);if(!el){el=document.createElement('span');this.nodes.set(u.id,el);this.host.append(el);}el.textContent=symbol;el.dataset.state=symbol==='?'?'lost':'found';el.setAttribute('aria-label',symbol==='?'?'敌人失去目标':symbol==='!'?'敌人发现目标':'敌人正在追踪');const p=project(u.drawPos||u.pos);el.style.left=p.x+'px';el.style.top=p.y-74+'px';}for(const [id,el]of this.nodes)if(!keep.has(id)){el.remove();this.nodes.delete(id);}}
}
