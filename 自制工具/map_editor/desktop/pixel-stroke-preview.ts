import {Group} from 'three';
import {meshMap} from '../core/mesher.ts';
import type {MapView} from './view.ts';
/** Only the new stroke is meshed; existing terrain and document remain unchanged. */
export class PixelStrokePreview {
 private groups=new Map<MapView,Group>();
 update(views:MapView[],doc:any,cells:any[]){
  this.clear();if(!cells.length)return;
  const source={...doc,cells},faces=meshMap(source);
  for(const view of views){const group=new Group();view.fillTerrain(group,source,faces);view.scene.add(group);this.groups.set(view,group);}
 }
 clear(){for(const [view,group]of this.groups){view.disposeGeometry(group);view.scene.remove(group);}this.groups.clear();}
}
