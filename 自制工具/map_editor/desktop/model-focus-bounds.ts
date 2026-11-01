import {Box3,Vector3} from 'three';import {CANVAS_TICK,type CanvasSession} from '../core/workshop-canvases.ts';
/** Bounds in the active editor frame. Selection wins; unselected opening focuses the active canvas. */
export function modelFocusBounds(session:CanvasSession,all=false){
 const active=session.active,scale=.25/active.voxelStepM,ids=new Set(session.editObjectId?[session.editObjectId]:session.selectedObjectIds),selected=all?[]:session.model.objects!.filter(o=>ids.has(o.objectId)),keys=new Map<string,Set<string>>();
 for(const object of selected)for(const id of object.canvasIds){let set=keys.get(id);if(!set)keys.set(id,set=new Set());for(const key of object.cellKeys??[])set.add(key);}
 const box=new Box3();for(const canvas of session.model.canvases!){if(!canvas.visible||!all&&!selected.length&&canvas.canvasId!==active.canvasId||selected.length&&!keys.has(canvas.canvasId))continue;
  const offset=canvas.originTicks.map((n,i)=>(n-active.originTicks[i])*CANVAS_TICK*scale),step=canvas.voxelStepM*scale;
  for(const cell of canvas.cells){if(selected.length&&!keys.get(canvas.canvasId)!.has([cell.x,cell.y,cell.z].join(',')))continue;
   box.expandByPoint(new Vector3(offset[0]+cell.x*step,offset[2]+cell.z*step,-offset[1]-(cell.y+1)*step));box.expandByPoint(new Vector3(offset[0]+(cell.x+1)*step,offset[2]+(cell.z+1)*step,-offset[1]-cell.y*step));
  }
 }return box;
}
