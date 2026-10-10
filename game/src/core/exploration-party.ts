import type {CommandResult,GameState,Unit} from './types';

export const EXPLORATION_COMPANIONS=['ranger'] as const;
export const isStandaloneExploration=(s:GameState)=>s.exploration?.definition.kind==='standalone';
/** Originals remain in the account roster; this query controls membership in this run. */
export function isPartyBody(s:GameState,u:Unit){return u.team==='ally'&&!u.cloneOf&&(!isStandaloneExploration(s)||u.id==='hunter'||u.id===s.explorationCompanionId);}
/** Clones retain their existing rules and are not additional party originals. */
export function participates(s:GameState,u:Unit){return u.team==='enemy'||!!u.cloneOf||isPartyBody(s,u);}
export function queryCompanion(s:GameState,id:string|undefined=s.explorationCompanionId):CommandResult{
 const u=s.units.find(u=>u.id===id);
 if(!u||!EXPLORATION_COMPANIONS.includes(u.id as typeof EXPLORATION_COMPANIONS[number])||u.team!=='ally'||u.cloneOf||['dead','departed','downed','rescued','respawning'].includes(u.life))return {ok:false,reason:'当前同行者固定为阿尔'};
 return {ok:true};
}
