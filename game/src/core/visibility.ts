import {participates} from './exploration-party';
import type {GameState,Pos} from './types';
import {cell,clearShot,distance} from './spatial';
import {EXPLORE} from './exploration-content';
export const visionKey=(p:Pos)=>{const t=cell(p);return t.x+','+t.y;};
export function positionVisible(s:GameState,p:Pos){
 if(!s.exploration)return true;
 return s.units.some(u=>u.team==='ally'&&participates(s,u)&&['active','downed'].includes(u.life)&&distance(u.pos,p)<=EXPLORE.vision&&clearShot(s,u.pos,p,true))||s.lights.some(l=>l.remaining>0&&distance(l.pos,p)<=l.radius&&clearShot(s,l.pos,p,true));
}
export function positionKnown(s:GameState,p:Pos){return !s.exploration||positionVisible(s,p)||s.exploration.memory.seen.includes(visionKey(p));}
/** Presentation queries cannot expose live enemies in remembered terrain. */
export function previewState(s:GameState):GameState{return !s.exploration?s:{...s,units:s.units.filter(u=>participates(s,u)&&(u.team==='ally'||positionVisible(s,u.pos)))};}
export function updateVision(s:GameState,force=false){const r=s.exploration;if(!r||!force&&s.time-r.visionAt<.15)return;r.visionAt=s.time;r.visible=s.tiles.filter(p=>positionVisible(s,p)).map(visionKey);const seen=new Set(r.memory.seen);for(const key of r.visible)seen.add(key);r.memory.seen=[...seen];}
