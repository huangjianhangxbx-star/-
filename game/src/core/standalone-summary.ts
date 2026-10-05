import type {GameState} from './types';
import {isStandaloneExploration} from './exploration-party';
import {STANDALONE_TUNING} from './standalone-tuning';
export function standaloneSummary(s:GameState){
 if(!isStandaloneExploration(s))return null;
 const r=s.exploration!,groups=r.definition.encounters||[];
 return {seed:s.explorationSeed,companion:s.explorationCompanionId,tuning:STANDALONE_TUNING,
  enemies:r.definition.enemies.length,rooms:Object.fromEntries(['safe','small','normal','strong'].map(t=>[t,groups.filter(g=>g.tier===t).length])),
  campfiresUsed:r.memory.mechanisms.filter(id=>id.startsWith('campfire-')).length,kills:s.kills,seconds:Math.round(s.time*10)/10,
  damageTaken:r.metrics?.damageTaken||0,casualties:r.metrics?.casualties||0,firstCasualtySeconds:r.metrics?.firstCasualtySeconds??null,
  outcome:s.phase==='ended'?s.result||s.economy.settled:'running'};
}
