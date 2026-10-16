import type {GameState,Unit} from './types';
import {queryBackpack} from './world-inventory';
import {distance,clearShot,surface} from './spatial';
import {INVENTORY_INTERACTION_RADIUS} from './inventory-operations';

export type RoleAction='shop'|'dialogue'|'gift'|'equipment';
export const ROLE_ACTIONS:ReadonlyArray<{id:RoleAction;label:string;icon:string}>= [
 {id:'shop',label:'商店',icon:'shop'}, {id:'dialogue',label:'对话',icon:'dialogue'},
 {id:'gift',label:'送礼物',icon:'gift'}, {id:'equipment',label:'角色装备',icon:'equipment'},
];
type Profile={actions:readonly RoleAction[];shopCatalog:'sample'|'empty'};
const PROFILES:Record<string,Profile>={merchant:{actions:['shop'],shopCatalog:'sample'},companion:{actions:['shop','dialogue','gift','equipment'],shopCatalog:'empty'}};
/** Identity mapping stays in the domain layer; views render capabilities only. */
export function roleProfile(s:GameState,u:Unit):Profile|undefined{
 if(u.cloneOf||u.team!=='ally'||u.id==='hunter')return;
 return u.npc?PROFILES[u.npc.kind]:u.id===(s.explorationCompanionId??'ranger')?PROFILES.companion:undefined;
}
export function roleAccess(s:GameState,id:string){
 const target=s.units.find(u=>u.id===id),actor=s.units.find(u=>u.id===s.controlledBodyId);
 if(!target||!actor||target===actor||!roleProfile(s,target)||!queryBackpack(s).ok||target.life!=='active'||actor.life!=='active'||actor.crossing||actor.forcedMotion||target.crossing||target.forcedMotion)return false;
 if(target.npc&&(target.npc.worldId!==s.world?.id||target.npc.placeId!==s.world?.visit.placeId))return false;
 return distance(actor.pos,target.pos)<=INVENTORY_INTERACTION_RADIUS&&surface(s,actor.pos)?.layer===surface(s,target.pos)?.layer&&clearShot(s,actor.pos,target.pos);
}
export function nearbyRole(s:GameState){const actor=s.units.find(u=>u.id===s.controlledBodyId);return actor?s.units.filter(u=>roleAccess(s,u.id)).sort((a,b)=>distance(actor.pos,a.pos)-distance(actor.pos,b.pos)||a.id.localeCompare(b.id))[0]:undefined;}
export function roleSession(s:GameState,id:string){return {target:id,world:s.world?.id,visit:s.world?.visit.generation,actor:s.controlledBodyId,control:s.controlRevision??0,epoch:s.inputEpoch??0};}
export function validRoleSession(s:GameState,t:ReturnType<typeof roleSession>){return roleAccess(s,t.target)&&s.world?.id===t.world&&s.world?.visit.generation===t.visit&&s.controlledBodyId===t.actor&&(s.controlRevision??0)===t.control&&(s.inputEpoch??0)===t.epoch;}
