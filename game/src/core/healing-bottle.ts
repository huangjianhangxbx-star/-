import type {CommandResult,GameState,Unit} from './types';
import {isStandaloneExploration,isPartyBody} from './exploration-party';
import {healHealth} from './pressure';

/** ITEM-Y01 approved SAMPLE: one shared charge, 100 absolute HP per living original. */
export const HEALING_BOTTLE_SAMPLE=Object.freeze({capacity:1,health:100});
export type HealingBottleState={count:0|1;uses:number;refills:number};
function activeWorld(s:GameState){
 const w=s.world,r=s.exploration;
 return s.sessionMode==='exploration'&&!s.xxExperiment&&isStandaloneExploration(s)&&s.phase==='battle'&&w?.visit.active&&r&&w.visit.placeId===r.definition.id&&w.places[w.visit.placeId]?.definition===r.definition?w:undefined;
}
function originals(s:GameState):Unit[]{
 return s.units.filter(u=>isPartyBody(s,u)&&u.team==='ally'&&!u.cloneOf&&!u.shadowResident&&u.life==='active'&&u.hp>0&&s.units.filter(other=>other.id===u.id).length===1);
}
/** Pure availability query: healing remains legal during an accepted combat action. */
export function queryHealingBottle(s:GameState):CommandResult&{count:number}{
 const w=activeWorld(s),count=w?.healingBottle.count??0,fail=(reason:string)=>({ok:false,reason,count});
 if(!w)return fail('仅当前正式探索世界可使用回血瓶');
 const living=originals(s);
 if(!living.some(u=>u.id===s.controlledBodyId))return fail('需要存活的实控本体');
 if(s.explorationControl?.aim||s.explorationControl?.commandFocusId)return fail('先结束瞄准或指令操作');
 if(count!==1)return fail('回血瓶已耗尽 · 未用篝火休息后补充');
 if(!living.some(u=>u.hp<u.maxHp))return fail('存活队员生命已满');
 return {ok:true,count};
}
/** Sole atomic item consumer; neither legacy inventory nor attack/payment state is touched. */
export function useHealingBottle(s:GameState):CommandResult{
 const q=queryHealingBottle(s);if(!q.ok)return {ok:false,reason:q.reason};
 const bottle=s.world!.healingBottle;bottle.count=0;bottle.uses++;
 for(const u of originals(s))healHealth(u,HEALING_BOTTLE_SAMPLE.health);
 s.notice='Y 回血瓶 · 存活本体各瞬回100生命（SAMPLE，上限截断）';
 return {ok:true};
}
/** Called only by the existing successful, unused campfire transaction. Set, never stack. */
export function refillHealingBottle(s:GameState):boolean{
 const w=activeWorld(s);if(!w)return false;w.healingBottle.count=1;w.healingBottle.refills++;return true;
}
