import type {GameState,Pos} from '../core/types';
import {controlledBody} from '../core/direct-control';
import {isPartyBody} from '../core/exploration-party';
/** Logical-space focus. Projection and smoothing remain owned by BattleScene. */
export function controlFocus(s:GameState):Pos|null {
 const primary=controlledBody(s);if(!primary)return null;
 const p=primary.drawPos||primary.pos;
 const secondary=s.units.find(u=>u!==primary&&isPartyBody(s,u)&&u.life==='active'&&!u.shadowResident);
 if(!secondary)return {...p};
 const q=secondary.drawPos||secondary.pos,dx=q.x-p.x,dy=q.y-p.y;
 const factor=Math.min(.35,3/Math.max(.00001,Math.hypot(dx,dy)));
 return {x:p.x+dx*factor,y:p.y+dy*factor};
}
