import type {CommandResult,GameState,Pos} from './types';
import type {ExplorationDefinition} from './exploration-types';
import {queryBackpack,inventoryQuantity,type InventoryVisit} from './world-inventory';
import {isPartyBody} from './exploration-party';
import {distance,surface,terrainFits,segmentClear} from './spatial';
import {positionVisible} from './visibility';
import {rightSkillAction} from './right-skill-state';

/** FARM01 experimental values, not a finalized farming/economy contract. */
export const FARM_SAMPLE=Object.freeze({growthSeconds:6,reach:1.4});
export type FarmPlot={id:string;pos:Pos&{layer:number};state:'raw'|'tilled'|'planted';plantedAt?:number;matureAt?:number;revision:number;harvestCount:number};
export type FarmActionRequest=InventoryVisit&{plotId:string;expectedRevision:number;actorId:string;slot:number;itemId:string};
const reject=(reason:string):CommandResult=>({ok:false,reason});
/** Fixed, audited entry-room floor. No terrain mutation or fallback through an illegal tile. */
export function createFarmPlots(d:ExplorationDefinition):FarmPlot[]{
 if(d.kind!=='standalone'||d.id!==18)return [];
 const candidates=[{x:6,y:6,layer:0},{x:4,y:8,layer:0}];
 const legal=candidates.every(p=>distance(p,d.entry)>=1.6&&distance(p,d.entry)<=3&&distance(p,d.exit)>=1.6&&d.points.every(e=>distance(p,e.pos)>=1.6)&&d.enemies.every(e=>distance(p,e.pos)>=3)&&[-1,0,1].every(dx=>[-1,0,1].every(dy=>d.tiles.some(t=>t.x===p.x+dx&&t.y===p.y+dy&&!t.obstacle&&t.layer===p.layer))));
 return legal?candidates.map((pos,i)=>({id:`farm-${i+1}`,pos,state:'raw',revision:0,harvestCount:0})):[];
}
function plots(s:GameState){const w=s.world,r=s.exploration;return w&&r&&s.sessionMode==='exploration'&&!s.xxExperiment&&r.definition.kind==='standalone'&&s.phase==='battle'&&w.visit.active&&w.visit.placeId===r.definition.id&&w.places[w.visit.placeId]?.definition===r.definition?w.places[w.visit.placeId].farmPlots??[]:[];}
export function farmView(s:GameState){return plots(s).map(p=>({id:p.id,pos:{...p.pos},revision:p.revision,harvestCount:p.harvestCount,state:p.state==='planted'&&Number.isFinite(p.matureAt)&&s.time>=p.matureAt!?'mature' as const:p.state,remaining:p.state==='planted'?Math.max(0,(p.matureAt??Infinity)-s.time):0}));}
export function farmAt(s:GameState,p:Pos|null|undefined){return p?farmView(s).find(f=>Math.abs(f.pos.x-p.x)<=.48&&Math.abs(f.pos.y-p.y)<=.48):undefined;}
/** Includes zero and absent rows for refunds; duplicates and invalid counts never auto-repair. */
function creditable(s:GameState,itemId:string){const rows=s.world!.backpack!.stacks.filter(x=>x.itemId===itemId);return rows.length===0||rows.length===1&&Number.isSafeInteger(rows[0].quantity)&&rows[0].quantity>=0&&rows[0].quantity<Number.MAX_SAFE_INTEGER;}
export function queryFarmAction(s:GameState,r:FarmActionRequest):CommandResult{
 const check=queryBackpack(s);if(!check.ok)return check;
 const w=s.world!,b=w.backpack!,rows=plots(s).filter(p=>p.id===r.plotId),p=rows.length===1?rows[0]:undefined;
 if(r.worldId!==w.id||r.visit!==w.visit.generation||!p||!Number.isSafeInteger(p.revision)||p.revision<0||p.revision>=Number.MAX_SAFE_INTEGER||r.expectedRevision!==p.revision)return reject('农田请求已失效，请重新操作');
 const u=s.units.find(u=>u.id===r.actorId);
 if(!u||!['hunter','ranger'].includes(r.actorId)||r.actorId!==s.controlledBodyId||!isPartyBody(s,u)||u.cloneOf||u.shadowResident||u.life!=='active'||u.hp<=0||s.units.filter(x=>x.id===r.actorId).length!==1)return reject('需要存活的当前实控本体');
 const n=u.hunterCombat??u.alCombat;
 if(s.context!=='explorationIdle'||u.ready>0||u.stagger>0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||u.forcedMotion||u.crossing||u.skillLanding||u.transition||u.destination||u.attackIntent||u.attackPending||u.basicAction||u.evasion?.action||u.offhand?.pending||u.offhand?.held||rightSkillAction(u)||u.loadout||Object.values(u.skillStates??{}).some(x=>x.run)||u.recall||u.partyTask||u.rescueTarget||n?.held||u.alCombat?.shotHeld||n?.special||n?.motion||s.time<(n?.hurtUntil??0)||s.time<(n?.finalRecoveryUntil??0))return reject('请在探索空闲、动作结束后操作农田');
 if(!Number.isInteger(r.slot)||r.slot<0||r.slot>=10||b.selectedSlot!==r.slot||b.hotbar[r.slot]!==r.itemId||inventoryQuantity(b,r.itemId)<=0)return reject('请先用数字栏选择有库存的农具或种子');
 if(!Number.isFinite(s.time)||surface(s,u.pos)?.layer!==p.pos.layer||surface(s,p.pos)?.layer!==p.pos.layer||!terrainFits(s,p.pos,.42,true,true)||distance(u.pos,p.pos)>FARM_SAMPLE.reach+1e-7||!segmentClear(s,u.pos,p.pos,true,true,.18)||!positionVisible(s,p.pos))return reject('靠近同层可见的农田（1.4米），不能隔墙操作');
 if(p.state==='raw')return r.itemId==='sample-tool'?{ok:true}:reject('原始地需要实验农具开垦');
 if(p.state==='tilled')return r.itemId==='sample-seed'?{ok:true}:reject('已开垦土地需要实验种子播种');
 if(p.state!=='planted'||!Number.isFinite(p.matureAt)||!Number.isFinite(p.plantedAt)||p.matureAt!<p.plantedAt!)return reject('农田记录无效');
 if(s.time<p.matureAt!)return reject(`尚未成熟 · 还需 ${(p.matureAt!-s.time).toFixed(1)} 模拟秒（SAMPLE）`);
 if(r.itemId!=='sample-tool')return reject('成熟作物需要实验农具收获');
 if(!Number.isSafeInteger(p.harvestCount)||p.harvestCount<0||p.harvestCount>=Number.MAX_SAFE_INTEGER||!creditable(s,'sample-seed')||!creditable(s,'sample-crop'))return reject('收获库存记录损坏或数量溢出，未作任何变更');
 return {ok:true};
}
export function commitFarmAction(s:GameState,r:FarmActionRequest):CommandResult{
 const check=queryFarmAction(s,r);if(!check.ok)return check;
 const b=s.world!.backpack!,p=plots(s).find(p=>p.id===r.plotId)!;
 if(p.state==='raw'){p.state='tilled';s.notice='开垦完成 · 选择实验种子播种';}
 else if(p.state==='tilled'){b.stacks.find(x=>x.itemId==='sample-seed')!.quantity--;p.state='planted';p.plantedAt=s.time;p.matureAt=s.time+FARM_SAMPLE.growthSeconds;s.notice='播种完成 · 种子 -1 · 6 模拟秒成熟（SAMPLE）';}
 else {for(const id of ['sample-crop','sample-seed']){const row=b.stacks.find(x=>x.itemId===id);if(row)row.quantity++;else b.stacks.push({itemId:id,quantity:1});}p.state='tilled';p.plantedAt=p.matureAt=undefined;p.harvestCount++;s.notice='收获完成 · 实验收成 +1，实验种子 +1（SAMPLE）';}
 p.revision++;return {ok:true};
}
