import type {Unit} from './types';
import {professionOf} from './skill-catalog';

export type BasicCancelCause='move'|'direct'|'evade'|'blink'|'skill'|'stagger';
export type BasicStageDefinition={readonly id:string;readonly releaseAt:number;readonly moveReadyAt:number;readonly attackReadyAt:'period';readonly finishAt:'attack-ready';readonly recoveryScale:number;readonly cancelBeforeReleaseBy:readonly BasicCancelCause[]};
export type BasicDefinition={readonly id:string;readonly stages:readonly BasicStageDefinition[];readonly bufferSeconds:number;readonly continuationSeconds:number};
const cancels=Object.freeze(['move','direct','evade','blink','skill','stagger'] as const);
const stage=(id:string):BasicStageDefinition=>Object.freeze({id,releaseAt:.25,moveReadyAt:.25,attackReadyAt:'period',finishAt:'attack-ready',recoveryScale:1,cancelBeforeReleaseBy:cancels});
const legacy:BasicDefinition=Object.freeze({id:'legacy-main-basic',stages:Object.freeze([stage('stage0'),stage('stage1')]),bufferSeconds:.12,continuationSeconds:.45});
export const BASIC_DEFINITIONS:Readonly<Record<string,BasicDefinition>>=Object.freeze({'legacy-main-basic':legacy});
export const BASIC_DEFINITION_IDS:Readonly<Record<string,string>>=Object.freeze({default:legacy.id,hunter:legacy.id,guard:legacy.id,shieldguard:legacy.id,healer:legacy.id,cantor:legacy.id,ranger:legacy.id,scythe:legacy.id});
/** Stable ability/profile resolution, independent of requester or current DirectActor. */
export function resolveBasicDefinition(u:Unit):BasicDefinition{return BASIC_DEFINITIONS[BASIC_DEFINITION_IDS[u.basicProfileId||professionOf(u)]||'legacy-main-basic'];}

/** Stage topology belongs to the definition, not the requester. */
export function nextBasicStage(definition:BasicDefinition,previous:number|undefined,continues:boolean){return continues&&previous!==undefined?(previous+1)%definition.stages.length:0;}
