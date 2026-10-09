import type {Unit} from './types';
import {professionOf} from './skill-catalog';
import {HUNTER_V2} from './hunter-combat-profile';

export type BasicCancelCause='move'|'direct'|'evade'|'blink'|'skill'|'stagger';
export type BasicStageDefinition={readonly id:string;readonly presentationId?:string;readonly releaseAt:number;readonly moveReadyAt:number;readonly attackReadyAt:'period'|number;readonly finishAt:'attack-ready'|number;readonly dashAt?:number;readonly dashDistance?:number;readonly dashDuration?:number;readonly damage?:number;readonly range?:number;readonly halfAngle?:number;readonly recoveryScale:number;readonly cancelBeforeReleaseBy:readonly BasicCancelCause[]};
export type BasicDefinition={readonly id:string;readonly clock?:'real';readonly stages:readonly BasicStageDefinition[];readonly bufferSeconds:number;readonly continuationSeconds:number;readonly fullComboRecovery?:number};
const cancels=Object.freeze(['move','direct','evade','blink','skill','stagger'] as const);
const stage=(id:string):BasicStageDefinition=>Object.freeze({id,releaseAt:.25,moveReadyAt:.25,attackReadyAt:'period',finishAt:'attack-ready',recoveryScale:1,cancelBeforeReleaseBy:cancels});
const legacy:BasicDefinition=Object.freeze({id:'legacy-main-basic',stages:Object.freeze([stage('stage0'),stage('stage1')]),bufferSeconds:.12,continuationSeconds:.45});
// SAMPLE logical release: no confirmed ordinary shot/muzzle event.
const hunterStage=(id:string,presentationId:string):BasicStageDefinition=>Object.freeze({...stage(id),presentationId,releaseAt:.4,moveReadyAt:.4});
const hunter:BasicDefinition=Object.freeze({id:'hunter-basic-v1',stages:Object.freeze([hunterStage('Shot01','hunter-shot-01'),hunterStage('Shot02','hunter-shot-02')]),bufferSeconds:.12,continuationSeconds:.45});
const al:BasicDefinition=Object.freeze({id:'al-basic-v1',clock:'real',stages:Object.freeze([
 {id:'A1',presentationId:'a1',dashAt:.0119,releaseAt:.0333,attackReadyAt:.1333,moveReadyAt:.2,finishAt:.8,damage:15,range:1.8,halfAngle:1},
 {id:'A2',presentationId:'a2',dashAt:.0333,releaseAt:.0667,attackReadyAt:.1667,moveReadyAt:.2667,finishAt:.8,damage:20,range:1.8,halfAngle:1},
 {id:'A3',presentationId:'a3',dashAt:.1667,releaseAt:.1667,attackReadyAt:.3,moveReadyAt:.4,finishAt:1.2667,damage:30,range:1.8,halfAngle:1}
].map(s=>Object.freeze({...s,recoveryScale:1,cancelBeforeReleaseBy:cancels}))),bufferSeconds:.25,continuationSeconds:.5,fullComboRecovery:.25});
// EN06-G01 SAMPLE: only the next full Basic chain waits beyond terminal Finish.
const hunterV2:BasicDefinition=Object.freeze({id:HUNTER_V2.id,clock:'real',stages:Object.freeze(HUNTER_V2.stages.map(s=>Object.freeze({...s,recoveryScale:1,cancelBeforeReleaseBy:cancels}))),bufferSeconds:.25,continuationSeconds:.625,fullComboRecovery:.25});
export const BASIC_DEFINITIONS:Readonly<Record<string,BasicDefinition>>=Object.freeze({'legacy-main-basic':legacy,'hunter-basic-v1':hunter,'hunter-v2':hunterV2,'al-basic-v1':al});
export const BASIC_DEFINITION_IDS:Readonly<Record<string,string>>=Object.freeze({default:legacy.id,hunter:hunter.id,guard:legacy.id,shieldguard:legacy.id,healer:legacy.id,cantor:legacy.id,ranger:legacy.id,scythe:legacy.id});
/** Stable ability/profile resolution, independent of requester or current DirectActor. */
export function resolveBasicDefinition(u:Unit):BasicDefinition{return BASIC_DEFINITIONS[u.basicProfileId||'']??BASIC_DEFINITIONS[BASIC_DEFINITION_IDS[professionOf(u)]||'legacy-main-basic'];}

/** Stage topology belongs to the definition, not the requester. */
export function nextBasicStage(definition:BasicDefinition,previous:number|undefined,continues:boolean){return continues&&previous!==undefined?(previous+1)%definition.stages.length:0;}
