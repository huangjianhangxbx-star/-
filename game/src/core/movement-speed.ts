import type {GameState,Unit} from './types';
import {weightProfile} from './combat-config';
import {COMBAT_CONFIG} from './combat-config';
import {distance} from './spatial';
export function movementSpeed(s:GameState,u:Unit,_direct=false){const idle=!!s.exploration&&s.context==='explorationIdle'&&u.team==='ally';const base=idle&&u.following?s.units.find(a=>a.id==='hunter')||u:u;const slow=Math.min(.9,Math.max(0,...base.statuses.filter(st=>st.kind==='slow'&&st.remaining>0).map(st=>st.power)));return base.speed*weightProfile(base).move*(1-slow)*(idle&&u.following&&distance(u.pos,base.pos)>2.2?COMBAT_CONFIG.followCatchup:1);}
