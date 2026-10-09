import {isAlV2} from './al-state';
import {controlledBody} from './direct-control';
import {isStandaloneExploration} from './exploration-party';
import {STANDALONE_TUNING} from './standalone-tuning';
import type {GameState,Unit} from './types';
import {weightProfile} from './combat-config';
import {COMBAT_CONFIG} from './combat-config';
import {distance} from './spatial';
export function movementSpeed(s:GameState,u:Unit,_direct=false){const idle=!!s.exploration&&s.context==='explorationIdle'&&u.team==='ally';const base=idle&&u.following?(isStandaloneExploration(s)?controlledBody(s):s.units.find(a=>a.id==='hunter'))||u:u;const slow=Math.min(.9,Math.max(0,...base.statuses.filter(st=>st.kind==='slow'&&st.remaining>0).map(st=>st.power)));const speed=isAlV2(s,base)?6:isStandaloneExploration(s)?(base.team==='ally'?STANDALONE_TUNING.allySpeed:STANDALONE_TUNING.enemySpeed):base.speed;return speed*weightProfile(base).move*(1-slow)*(idle&&u.following?(isStandaloneExploration(s)?distance(u.pos,base.pos)>5.5?1.7:distance(u.pos,base.pos)>3.5?1.45:distance(u.pos,base.pos)>2.2?1.2:1:distance(u.pos,base.pos)>2.2?COMBAT_CONFIG.followCatchup:1):1);}
