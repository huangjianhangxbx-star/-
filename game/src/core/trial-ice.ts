import type {GameState,Unit,Pos,Weapon} from './types';
import type {ActionContext,AttackEvent} from './combat-identity';
import {allocateRuntimeAttack} from './combat-identity';
import {trialState,trialContext} from './ability-trial';
import {radius,terrainFits} from './spatial';
export type TrialIceArea={id:number;pos:Pos;expires:number;scanAt:number;members:Set<string>;context:ActionContext;weapon:Readonly<Weapon>};
export type TrialIceTrail={sourceId:string;context:ActionContext;weapon:Readonly<Weapon>;last:Pos;remainder:number;expires:number};
export type TrialIceContact={target:Unit;next:number;context:ActionContext;weapon:Readonly<Weapon>;pos:Pos};
type IceHit={id:number;pos:Pos;damage:number;context:ActionContext;attack:AttackEvent;weapon:Readonly<Weapon>;subtype:'frost';periodic:true};
const key=(u:Unit)=>'cr-ice:'+trialState(u)!.mainId;
function create(s:GameState,u:Unit,pos:Pos,c:ActionContext,w:Readonly<Weapon>){if(!terrainFits(s,pos,.08))return;(trialState(u)!.iceAreas??=[]).push({id:s.nextId++,pos:{...pos},expires:s.time+8,scanAt:s.time+.1,members:new Set(),context:trialContext(s,u,'小蓝冰地小',c),weapon:w});}
export function startTrialIce(s:GameState,u:Unit,c:ActionContext|undefined,w:Readonly<Weapon>){const t=trialState(u),source=c?.composition?.sources.find(x=>x.effect==='ice-trail');if(!t||!source||!c)return;t.iceTrail={sourceId:source.id,context:c,weapon:w,last:{...u.pos},remainder:0,expires:s.time+.2};create(s,u,u.pos,c,w);}
export function clearTrialIce(u:Unit){const t=trialState(u);if(!t)return;for(const {target} of t.iceContacts?.values()??[])target.statuses=target.statuses.filter(x=>x.source!==key(u));t.iceTrail=undefined;t.iceAreas=[];t.iceContacts?.clear();}
/** Mirrors 06003790's sampled-distance accumulator, including its frame dependence.
 * Aura uses one contact/poison clock per owner+target, regardless of patch overlap.
 */
export function advanceTrialIce(s:GameState,u:Unit,hit:(target:Unit,packet:IceHit)=>boolean){const t=trialState(u);if(!t)return;const tr=t.iceTrail;
 if(tr){if(s.time>=tr.expires||u.hunterCombat?.special?.context?.actionId!==tr.context.actionId||!t.sources.some(x=>x.id===tr.sourceId))t.iceTrail=undefined;
  else{const dx=u.pos.x-tr.last.x,dy=u.pos.y-tr.last.y,d=Math.hypot(dx,dy);if(d>1e-7){const total=d+tr.remainder,n=Math.floor(total);if(!n)tr.remainder=total;else{const origin={...tr.last};for(let i=1;i<=Math.min(64,n);i++){const distance=i-tr.remainder,pos={x:origin.x+dx/d*distance,y:origin.y+dy/d*distance};create(s,u,pos,tr.context,tr.weapon);tr.last=pos;}tr.remainder=total-n;}}}
 }
 t.iceAreas=t.iceAreas?.filter(a=>a.expires>s.time);t.iceContacts??=new Map();
 for(const area of t.iceAreas??[]){if(s.time+1e-10<area.scanAt)continue;area.scanAt+=.1;area.members=new Set(s.units.filter(target=>target.life==='active'&&!target.cloneOf&&!target.shadowResident&&Math.hypot(target.pos.x-area.pos.x,target.pos.y-area.pos.y)<=1+radius(target)).map(target=>target.id));}
 const present=new Set<string>();for(const target of s.units){if(target.life!=='active')continue;const area=t.iceAreas?.find(a=>a.members.has(target.id));if(!area)continue;present.add(target.id);
  let contact=t.iceContacts.get(target.id);if(!contact){contact={target,next:s.time,context:trialContext(s,u,'小蓝冰地掉血',area.context),weapon:area.weapon,pos:area.pos};t.iceContacts.set(target.id,contact);}
  const kind=target.team===u.team?'iceGround':'slow',prior=target.statuses.find(x=>x.kind===kind&&x.source===key(u));if(prior)prior.remaining=.15;else target.statuses.push({kind,remaining:.15,power:kind==='slow'?.35:0,source:key(u),name:kind==='slow'?'冰地减速':'主角在冰地上',origin:u});
  if(target.team!==u.team&&s.time+1e-10>=contact.next){contact.next+=.5;const packet:IceHit={id:s.nextId++,pos:contact.pos,damage:15,context:contact.context,attack:allocateRuntimeAttack(s,contact.context,s.time),weapon:contact.weapon,subtype:'frost',periodic:true};hit(target,packet);}
 }
 for(const [id,contact] of t.iceContacts)if(!present.has(id)){contact.target.statuses=contact.target.statuses.filter(x=>x.source!==key(u));t.iceContacts.delete(id);}
}
