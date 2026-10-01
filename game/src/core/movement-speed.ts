import type {GameState,Unit} from './types';
import {weightProfile} from './combat-config';
import {EXPLORE} from './exploration-content';
export function movementSpeed(s:GameState,u:Unit,direct=false){const idle=!!s.exploration&&s.context==='explorationIdle'&&u.team==='ally';const base=idle?s.units.find(a=>a.id==='hunter')||u:u;const slow=direct&&!idle?0:Math.min(.9,Math.max(0,...base.statuses.filter(st=>st.kind==='slow'&&st.remaining>0).map(st=>st.power)));return base.speed*weightProfile(base).move*(1-slow)*(idle?EXPLORE.idleSpeed:1);}
