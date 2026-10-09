import {intentTargets} from './attack-intent';
import {positionVisible} from './visibility';
import type {GameState} from './types';
import {isStandaloneExploration} from './exploration-party';
import {STANDALONE_TUNING} from './standalone-tuning';
export function standaloneSummary(s:GameState){
 if(!isStandaloneExploration(s))return null;
 const r=s.exploration!,groups=r.definition.encounters||[];
 return {weakpoints:(s.weakpointEvents||[]).filter(e=>{const u=s.units.find(u=>u.id===e.targetId);return !!u&&positionVisible(s,u.pos);}),seed:s.explorationSeed,companion:s.explorationCompanionId,tuning:STANDALONE_TUNING,
  telegraphs:s.units.filter(u=>u.attackIntent&&u.life==='active'&&positionVisible(s,u.pos)).map(u=>({source:u.id,kind:u.attackIntent!.kind,label:u.attackIntent!.label,shape:u.attackIntent!.area.kind,inside:intentTargets(s,u.attackIntent!).length,phase:u.attackIntent!.phase,lockIn:Math.max(0,u.attackIntent!.lockAt-s.time),resolveIn:Math.max(0,u.attackIntent!.resolveAt-s.time)})),
  enemies:r.definition.enemies.length,rooms:Object.fromEntries(['safe','small','normal','strong'].map(t=>[t,groups.filter(g=>g.tier===t).length])),
  campfiresUsed:r.memory.mechanisms.filter(id=>id.startsWith('campfire-')).length,kills:s.kills,seconds:Math.round(s.time*10)/10,
  damageTaken:r.metrics?.damageTaken||0,casualties:r.metrics?.casualties||0,firstCasualtySeconds:r.metrics?.firstCasualtySeconds??null,
  actions:Object.fromEntries(['frontHits','sideHits','backHits','weakpointHits','weakpointDamage','break','wallImpact','wallPin','telegraphsStarted','telegraphsCancelled','telegraphHits','telegraphPositionAvoids','evadeUses','activeEvades','windupsCancelledByMove','windupsCancelledByEvade','basicAttacksReleased'].map(key=>[key,s.stats[key]||0])),
  outcome:s.phase==='ended'?s.result||s.economy.settled:'running'};
}
