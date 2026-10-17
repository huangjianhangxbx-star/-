import type {GameState} from './types';
import {navigate} from './navigation';
import {radius,terrainFits,distance} from './spatial';
/** Read-only future activity contract: never schedules work or reserves a resident. */
export function activityAnchors(s:GameState){const d=s.exploration?.definition,l=d?.sceneLayout;if(!d||!l||!s.world)return [];
 // Use the actual movement planner, including its fine-grid fallback and enemy avoidance.
 return l.activities.map(a=>({...a,mapInstance:s.world!.id+':'+d.id,layoutRevision:l.revision,reachable:Object.fromEntries(s.units.filter(u=>u.id==='hunter'||u.id==='ranger').map(u=>[u.id,terrainFits(s,a.approach,radius(u))&&(distance(u.pos,a.approach)<.01||navigate(s,u.pos,a.approach,false,true,radius(u)).length>0)]))}));
}
