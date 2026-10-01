import {createGame} from './economy-fixtures';
import * as engine from '../src/core/engine';
import type {GameState,Unit} from '../src/core/types';
export function arena(){const s=createGame();s.phase='battle';s.waves=[];s.totalEnemies=999;s.width=20;s.height=12;s.tiles=Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),layer:0,obstacle:false}));s.units.forEach(u=>{u.life='reserve';u.ready=0;u.attackTimer=999;u.dodge=0;u.defense={subtype:'impact',flat:0};});s.fragments=1000;return s;}
export function foe(s:GameState,x=6,y=5){const e:Unit={...structuredClone(s.units[0]),id:'target-'+s.nextId++,team:'enemy',role:'melee',life:'active',hp:10000,maxHp:10000,pos:{x,y},drawPos:{x,y},speed:0,attackTimer:999,dodge:0,defense:{subtype:'pierce',flat:0},statuses:[],skillStates:undefined};s.units.push(e);return e;}
