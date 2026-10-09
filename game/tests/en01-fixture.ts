import {createGame,command} from '../src/core/engine';
import {aiState} from '../src/core/autonomy';
export function setup(){
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});
 s.postureRuntime=undefined;s.tiles.forEach(t=>{t.obstacle=false;t.layer=0;});s.units=s.units.filter(u=>u.team==='ally');
 const h=s.units.find(u=>u.id==='hunter')!,al=s.units.find(u=>u.id==='ranger')!;
 for(const u of [h,al]){u.pos={x:10,y:10+(u===al?.3:0)};u.drawPos={...u.pos};u.ready=0;u.ai=undefined;aiState(u).commandUntil=100;}
 const e=structuredClone(h);e.id='en01-enemy';e.name='EN01 FIXTURE';e.team='enemy';e.role='melee';e.basicProfileId=undefined;e.hunterCombat=undefined;e.alCombat=undefined;e.hp=e.maxHp=40;e.directionalProfileId='neutral';e.pos={x:11.3,y:10};e.drawPos={...e.pos};e.heading=Math.PI;e.path=[];e.ready=0;e.pursuitTargetId=undefined;s.units.push(e);
 return {s,h,al,e};
}
export const profile={id:'en01-melee',kind:'melee',source:'EN01 FIXTURE',range:1.8,minRange:0,detection:6,angle:.65,cooldown:2.5,power:5,arc:Math.PI*5/9,radius:.6,life:.1,travel:.9,spawnDelay:.35,deathPolicy:'retain',cancelPolicy:'retain',hurtSeconds:.24,events:[{kind:'prepare',at:0},{kind:'lock',at:0},{kind:'attack',at:.6},{kind:'attack-ready',at:1},{kind:'move-ready',at:1.1},{kind:'finish',at:1.2}]} as const;
export async function runtime(){const path='../src/core/enemy-action.ts';return import(/* @vite-ignore */path).catch(()=>undefined);}
