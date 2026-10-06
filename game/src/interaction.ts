import type {Command,Pos} from './core/types';
export class Interaction {
 stage:'idle'|'select'|'deploy'='idle';selectedId:string|null=null;deploying=false;
 observing=false;
 get slow(){return this.observing;}
 direct(){this.observing=false;}
 select(id:string){if(this.selectedId===id&&this.observing){this.cancel();return;}this.cancel();this.selectedId=id;this.stage='select';this.observing=true;}
 deploy(id:string){this.cancel();this.select(id);this.deploying=true;this.stage='deploy';}
 cancel(){this.observing=false;this.stage='idle';this.selectedId=null;this.deploying=false;}
 destination(pos:Pos,_quick:boolean):Command|null{
  if(!this.selectedId)return null;
  const c:Command=this.deploying?{type:'deploy',id:this.selectedId,to:{...pos},facing:'east'}:{type:'move',id:this.selectedId,to:{...pos}};
  this.cancel();return c;
 }
}
export function simulationDelta(dt:number,paused:boolean,hidden:boolean,timeScale:number|boolean,speed=1){if(paused||hidden)return 0;const scale=typeof timeScale==='boolean'?(timeScale?.1:speed):timeScale;return Math.min(Math.max(dt,0),.05)*Math.max(0,scale);}
