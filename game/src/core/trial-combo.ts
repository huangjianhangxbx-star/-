import type {BasicStageDefinition} from './basic-definition';
/** R2 skill rows640–646 and already available blue Spine event timelines.
 * Range/arc and .1s dash duration reuse the explicit AL port SAMPLE.
 */
const native=[
 ['小蓝快速a1','a快速+1',0,.0333,.1,.2,.4,.1],
 ['小蓝快速a2','a快速+2',.0667,.1,.1667,.2333,.4,.1],
 ['小蓝快速a3','a快速+3',.1,.1333,.2,.3,.4667,.4],
 ['小蓝快速a1+','a快速++1',0,.0333,.1,.1667,.3667,.1],
 ['小蓝快速a2+','a快速++2',.0333,.0667,.1333,.2,.3667,.1],
 ['小蓝快速a3+','a快速++3',.0333,.0667,.1333,.2333,.4,.4],
 ['小蓝快速a4+','a快速++2',.0333,.0667,.1333,.2,.3667,.1],
] as const;
export function applyTrialCombo(stages:BasicStageDefinition[],kind:'rapid'|'rapid-plus'){
 const rows=kind==='rapid'?native.slice(0,3):native.slice(3);
 const quick=rows.map(([id,presentationId,dashAt,releaseAt,attackReadyAt,moveReadyAt,finishAt,dashDistance])=>Object.freeze({...stages[0],id,presentationId,dashAt,releaseAt,attackReadyAt,moveReadyAt,finishAt,dashDistance,dashDuration:.1,damage:18}));
 return [...quick,...stages.filter(s=>s.id!=='A1'&&s.id!=='A2')];
}
