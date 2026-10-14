import type {Pos} from '../../core/types';
/** Presentation only: accumulate visible travel; collision microsteps must not restart Spine. */
export class ActorMotion {
 private anchor:Pos;private movingFor=0;
 constructor(p:Pos){this.anchor={...p};}
 sample(p:Pos,seconds:number){
  this.movingFor=Math.max(0,this.movingFor-Math.max(0,seconds));
  if(Math.hypot(p.x-this.anchor.x,p.y-this.anchor.y)>=.02){this.anchor={...p};this.movingFor=.12;}
  return this.movingFor>0;
 }
}
