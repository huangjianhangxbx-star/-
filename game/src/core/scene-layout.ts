import type {GameState,Pos} from './types';
export type SceneProp={id:string;asset:string;pos:Pos;scale?:number;ground?:boolean;base:{x:number;y:number;width:number;height:number};blocksLight?:boolean;blocksMovement:boolean;blocksSight:boolean;blocksProjectile:boolean};
export type ActivityAnchor={id:string;ownerObject:string;tags:string[];approach:Pos;facing:'north'|'south'|'east'|'west';capacity:1;mode:'anchor-only'};
export type SceneRegion={x:number;y:number;width:number;height:number};
export type GroundRegion=SceneRegion&{id:string;asset:string;variants?:string[];tileSize:number};
export type SceneDisplay={anchorY?:number;mode:'Source'|'DungeonLight'|'MaterialLight';zoom:number;ambientIntensity:number;ambientColor:string;lights:boolean;air:boolean;grade:boolean;bloom:boolean;dust:boolean;lamps:{enabled:boolean;x:number;y:number;color:string;intensity:number;radius:number}[];camera:{minX:number;maxX:number;minY:number;maxY:number}};
export type SceneLayout={revision:string;props:SceneProp[];activities:ActivityAnchor[];chest?:Pos;merchant?:Pos;size?:{width:number;height:number};buildingWalls?:Pos[];walkableRegions?:SceneRegion[];groundRegions?:GroundRegion[];entry?:Pos;returnSpawn?:Pos;resident?:Pos;frontDoor?:SceneRegion;rearDoor?:SceneRegion;wallAsset?:'home-wall';display?:SceneDisplay;assetManifests?:string[]};
/** Empty map space is not a high wall. Shared movement alone consumes this mask. */
export function sceneCellWalkable(s:GameState,p:Pos){const regions=s.exploration?.definition.sceneLayout?.walkableRegions;return !regions||regions.some(r=>p.x>=r.x&&p.x<r.x+r.width&&p.y>=r.y&&p.y<r.y+r.height);}
export function propBounds(p:SceneProp){return {left:p.pos.x+p.base.x,top:p.pos.y+p.base.y,right:p.pos.x+p.base.x+p.base.width,bottom:p.pos.y+p.base.y+p.base.height};}
export function furnitureFits(s:GameState,p:Pos,r:number){return !(s.exploration?.definition.sceneLayout?.props??[]).some(o=>{if(!o.blocksMovement)return false;const b=propBounds(o);return Math.hypot(Math.max(b.left-p.x,0,p.x-b.right),Math.max(b.top-p.y,0,p.y-b.bottom))<r-1e-7;});}
/** Slab intersection includes thin blockers without spatial sampling. Channels are independent. */
export function furnitureRayClear(s:GameState,a:Pos,b:Pos,channel:'blocksSight'|'blocksProjectile'){
 return !(s.exploration?.definition.sceneLayout?.props??[]).some(p=>{if(!p[channel])return false;const box=propBounds(p);let lo=0,hi=1;for(const [start,delta,min,max] of [[a.x,b.x-a.x,box.left,box.right],[a.y,b.y-a.y,box.top,box.bottom]]){if(Math.abs(delta)<1e-12){if(start<min||start>max)return false;}else{const t0=(min-start)/delta,t1=(max-start)/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;}}return true;});
}
