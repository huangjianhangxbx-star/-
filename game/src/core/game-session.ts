import type {Command,GameState} from './types';
/** Session capability is core state, independent of DOM visibility or current journey. */
const retired=new Set(['start','deploy','party','collect','extract','rescue','clone','destroyClone','draw','sellCard','card','autoDraw','enter','rest','continue','enterExplorationNode','leaveExplorationNode','abandonBattle','safeExit','selectScenario']);
export function retiredCommand(s:GameState,c:Command){return s.sessionMode==='exploration'&&(retired.has(c.type)||c.type==='selectJourney'&&c.journey==='tower'||c.type==='xxExperiment');}
export function gameRoute(search:string){
 const q=new URLSearchParams(search);
 const legacy=q.get('en01')==='1'||q.get('xx')==='1';
 return {retired:q.get('legacy')==='1'||q.get('scenario')==='exploration',sessionMode:legacy?'legacy' as const:'exploration' as const,developer:legacy||q.get('enemies')==='v2',label:legacy?'历史技术夹具 · 非正式探索入口':'具名敌人验证 · 非正式怪物整合'};
}
