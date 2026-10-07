import type {LabEvent} from '../runtime/world';
/** Null delegates to the unchanged legacy pipeline; [] deliberately suppresses it. */
export function rmbAudioCues(event:LabEvent):string[]|null{
 if(event.actorId!=='yellow')return null;
 if(event.eventKind==='hurt'||event.eventKind==='death')return null;
 if(event.eventKind==='yellow-fire')return ['yellow.fire'];
 if(event.eventKind==='reload-start')return [];
 if(event.eventKind==='reload-complete')return ['yellow.reload'];
 if(event.executedSkillId==='小黄远程'||event.executedSkillId==='小黄远程火箭弹'){
  return event.eventKind==='damage'?['yellow.hit']:[];
 }
 return null;
}
