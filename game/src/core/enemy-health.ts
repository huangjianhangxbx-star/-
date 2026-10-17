import type {GameState,Unit} from './types';
import {positionVisible} from './visibility';
export function enemyHealth(s:GameState,u:Unit){
 if(s.phase!=='battle'||u.team!=='enemy'||u.npc||u.life!=='active'||u.hp<=0||u.maxHp<=0||!positionVisible(s,u.pos))return null;
 return {hp:u.hp,maxHp:u.maxHp,ratio:Math.max(0,Math.min(1,u.hp/u.maxHp))};
}
