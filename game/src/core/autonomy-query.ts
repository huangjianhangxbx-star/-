import type {GameState,Pos,Unit} from './types';
import {canHit} from './engine';
import {actionable} from './personal';
import {movementSpeed} from './movement-speed';
import {resolveSkill} from './skill-catalog';
import {canStop,distance,radius,segmentClear,surface} from './spatial';
import {navigate} from './navigation';
import {AUTONOMY} from './autonomy-config';

export type Contribution={point:Pos;path:Pos[];ttc:number;window:number};
export type ContributionQuery={options:Contribution[];reason:string};
export const localRadius=(s:GameState)=>s.exploration?AUTONOMY.exploreRadius:AUTONOMY.towerRadius;
export const comfortRadius=(s:GameState)=>s.exploration?AUTONOMY.exploreComfort:AUTONOMY.towerComfort;
export function localPoints(s:GameState,u:Unit){const anchor=u.ai?.anchor||u.pos,r=localRadius(s),points=[{...u.pos},{...anchor}];for(let ring=.5;ring<=r+1e-7;ring+=.5)for(let i=0;i<16;i++)points.push({x:anchor.x+Math.cos(i*Math.PI/8)*ring,y:anchor.y+Math.sin(i*Math.PI/8)*ring});return points.filter(p=>distance(p,anchor)<=r+1e-7&&surface(s,p)?.layer===surface(s,anchor)?.layer&&canStop(s,p,u));}
export function localPath(s:GameState,u:Unit,p:Pos):Pos[]|null{if(distance(u.pos,p)<.02)return [];const path=segmentClear(s,u.pos,p,false,true,radius(u))?[{...p}]:navigate(s,u.pos,p,false,true,radius(u));const anchor=u.ai?.anchor||u.pos;return path.length&&path.every(q=>distance(q,anchor)<=localRadius(s)+1e-7&&surface(s,q)?.layer===surface(s,anchor)?.layer)?path:null;}
export function estimateTimeToContribute(s:GameState,u:Unit,path:Pos[],windup=AUTONOMY.windup){let length=0,p=u.pos;for(const q of path){length+=distance(p,q);p=q;}return length>0?length/Math.max(0,movementSpeed(s,u))+windup:windup;}
function predict(s:GameState,e:Unit,seconds:number){let budget=movementSpeed(s,e)*seconds,p={...e.pos};const path=e.path.length?e.path:e.route.slice(e.routeIndex);for(const q of path){const d=distance(p,q);if(d>budget)return {x:p.x+(q.x-p.x)*budget/d,y:p.y+(q.y-p.y)*budget/d};budget-=d;p={...q};}return p;}
function moving(e:Unit){return e.speed>0&&!e.engagement&&e.enemyMotion!=='engaged'&&(e.path.length>0||e.routeIndex<e.route.length);}
function attackWindow(s:GameState,u:Unit,e:Unit,points:Pos[],horizon:number){if(!moving(e))return Infinity;for(let t=.1;t<=horizon+.1;t+=.1){const pos=predict(s,e,t);if(!points.some(p=>canHit(s,{...u,pos:p},{...e,pos})))return Math.max(0,t-.1);}return Infinity;}
export function queryAttackContribution(s:GameState,u:Unit,e:Unit):ContributionQuery{
 if(e.life!=='active')return {options:[],reason:'目标失效'};
 const points=localPoints(s,u).filter(p=>canHit(s,{...u,pos:p},e));if(!points.length)return {options:[],reason:'半径内无真实攻击位'};
 const options:Contribution[]=[];let missedWindow=false;
 for(const point of points){const path=localPath(s,u,point);if(!path)continue;const ttc=estimateTimeToContribute(s,u,path),window=attackWindow(s,u,e,points,Math.min(8,Math.max(4,ttc+.2)));
  if(!Number.isFinite(ttc)||ttc+AUTONOMY.windowMargin>window||moving(e)&&!canHit(s,{...u,pos:point},{...e,pos:predict(s,e,ttc)})){missedWindow=true;continue;}
  options.push({point,path,ttc,window});
 }
 return {options,reason:options.length?'':missedWindow?'赶不上贡献窗口':'无半径内合法路径'};
}
export function supportAt(u:Unit,target:Unit,p:Pos){const spec=resolveSkill(u),runtime=u.skillStates?.[spec.id];const available=(runtime?.cd??u.skillCd)<=0||spec.kind==='toggle'&&!!runtime?.enabled;
 const useful=target.hp<target.maxHp&&(spec.heal>0||spec.allyHeal>0||spec.regen>0||spec.shieldBase>0||spec.missingHpScale>0);
 return available&&useful&&target.life==='active'&&!target.shadowResident&&distance(p,target.pos)<=spec.range+1e-7;
}
export function querySupportContribution(s:GameState,u:Unit,target:Unit):ContributionQuery{
 if(supportAt(u,target,u.pos))return {options:[],reason:'当前已能支援'};
 const options:Contribution[]=[];for(const point of localPoints(s,u)){if(!supportAt(u,target,point))continue;const path=localPath(s,u,point);if(path)options.push({point,path,ttc:estimateTimeToContribute(s,u,path,0),window:Infinity});}
 return {options,reason:options.length?'':'无可用支援或真实覆盖改善'};
}
export function responseCoverage(s:GameState,u:Unit,e:Unit){return s.units.filter(a=>a!==u&&a.team==='ally'&&!a.cloneOf&&a.life==='active'&&!a.shadowResident&&actionable(a)&&a.ready<=0&&!a.recall&&!a.partyTask&&!a.loadout&&!a.skillLanding&&(canHit(s,a,e)||a.ai?.task?.kind==='attack'&&a.ai.task.targetId===e.id&&['commit','approach','engage'].includes(a.ai.phase||'')&&canHit(s,{...a,pos:a.ai.task.point},e))).length;}
