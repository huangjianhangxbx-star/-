import type {ExplorationDefinition} from './exploration-types';
export const EXPLORE={node:4,vision:5,detect:5,lost:1.5,leash:8,calm:3,idleSpeed:1.25,followNear:1.2,followFar:2.2,exitRadius:1.2,partyExitRadius:3};
export function explorationDefinition():ExplorationDefinition{
 const width=28,height=20;
 const tiles=Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width);return {x,y,layer:x>=12&&x<=15&&y>=8&&y<=11?1:0,obstacle:x===0||y===0||x===27||y===19||x===8&&![5,6,14,15,16].includes(y)||x===18&&![6,7,13,14].includes(y)||y===10&&x>=20&&x<=25};});
 return {id:4,name:'雾钟庭院',width,height,tiles,entry:{x:2,y:16},exit:{x:2,y:16},
  enemies:[{id:'courtyard-a',role:'melee',pos:{x:11,y:15},hp:78,damage:6,asset:'Dustin'},{id:'courtyard-b',role:'melee',pos:{x:13,y:15},hp:90,damage:6,asset:'Verlaine_bot'},
   {id:'patrol-a',role:'melee',pos:{x:11,y:5},patrol:[{x:11,y:5},{x:16,y:5}],hp:90,damage:7,asset:'Dustin'},
   {id:'bell-a',role:'ranged',pos:{x:23,y:6},hp:70,damage:6,asset:'Verlaine_bot'},{id:'bell-b',role:'heavy',pos:{x:24,y:4},hp:135,damage:9,asset:'Dustin'}],
  points:[{id:'vitality-cache',pos:{x:10,y:17},kind:'resource',reward:10},{id:'silent-bell',pos:{x:24,y:3},kind:'objective',reward:10}]};
}
export function validateExploration(d:ExplorationDefinition){
 const ids=new Set<string>(),valid=(p:{x:number;y:number})=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&d.tiles.some(t=>t.x===p.x&&t.y===p.y&&!t.obstacle);
 if(d.width<=0||d.height<=0||d.tiles.length!==d.width*d.height||!valid(d.entry)||!valid(d.exit))throw new Error('探索地图/入口/出口无效');
 for(const item of [...d.enemies,...d.points]){if(!item.id||ids.has(item.id)||!valid(item.pos))throw new Error('探索定义无效: '+item.id);ids.add(item.id);}
 if(d.points.filter(p=>p.kind==='objective').length!==(d.victoryCondition==='exit'?0:1))throw new Error('探索必须定义唯一主要目标');
 for(const e of d.enemies)if(e.hp<=0||e.damage<0||e.patrol?.some(p=>!valid(p)))throw new Error('探索敌人定义无效: '+e.id);
}
