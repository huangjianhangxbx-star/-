import type {Command,Pos} from './core/types';
export class Interaction {
 stage:'idle'|'select'|'deploy'='idle';selectedId:string|null=null;deploying=false;
 get slow(){return this.stage!=='idle';}
 select(id:string){this.cancel();this.selectedId=id;this.stage='select';}
 deploy(id:string){this.select(id);this.deploying=true;this.stage='deploy';}
 cancel(){this.stage='idle';this.selectedId=null;this.deploying=false;}
 destination(pos:Pos,_quick:boolean):Command|null{
  if(!this.selectedId)return null;
  const c:Command=this.deploying?{type:'deploy',id:this.selectedId,to:{...pos},facing:'east'}:{type:'move',id:this.selectedId,to:{...pos}};
  this.cancel();return c;
 }
}
export function simulationDelta(dt:number,paused:boolean,hidden:boolean,slow:boolean,speed:number){if(paused||hidden)return 0;return Math.min(Math.max(dt,0),.05)*(slow?.1:speed);}
