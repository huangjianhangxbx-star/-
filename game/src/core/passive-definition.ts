/** SK-02 SAMPLE only; fixed candidates, not a permanent skill tree. */
export const ACTIVATION_SAMPLE=Object.freeze({costs:Object.freeze([4,8,12] as const),recovery:1.1,posture:1.1,damage:1.1});
export type PassiveId='sample-recovery'|'sample-posture'|'sample-damage';
export type PreparedPassives=readonly [PassiveId,PassiveId,PassiveId];
export const DEFAULT_PASSIVES:PreparedPassives=Object.freeze(['sample-recovery','sample-posture','sample-damage']);
export const PASSIVES=Object.freeze({
 'sample-recovery':Object.freeze({name:'调息',effect:'空闲体力恢复 ×1.10'}),
 'sample-posture':Object.freeze({name:'破势专注',effect:'Q/R 样板架势 ×1.10'}),
 'sample-damage':Object.freeze({name:'技巧强化',effect:'Q/R 样板伤害 ×1.10'})
});
export const validPreparedPassives=(ids:PreparedPassives|undefined)=>!!ids&&ids.length===3&&ids.every((id,i)=>id===DEFAULT_PASSIVES[i]);
