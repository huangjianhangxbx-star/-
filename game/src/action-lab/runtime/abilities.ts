import {m2Sample as s} from '../profiles/m2';
export type ActionKind='basic'|'enemy-attack'|'dash-strike'|'shield'|'active-prepare'|'shield-charge'|'axe'|'ice-burst'|'ranged-explosion'|'roll'|'cannon-shot'|'rocket-jump'|'rocket-explosion';
export type MotionSource='input-dodge'|'active-retreat'|'shield-charge'|'character-roll';
export interface Motion {source:MotionSource;actionId:number;facing:number;distance:number;duration:number;elapsed:number}
/** Defense is independent of motion and attack animation lifetime. */
export class LabDefense {
  private sources=new Map<number,number>();
  guardHeld=false; guardStartedAt=Infinity; guardFacing=0;
  protect(source:number,until:number):void{this.sources.set(source,until);}
  revoke(source:number):void{this.sources.delete(source);}
  invulnerable(now:number):boolean{let active=false;for(const [id,until] of this.sources){if(now<until)active=true;else this.sources.delete(id);}return active;}
  clear():void{this.sources.clear();this.guardHeld=false;this.guardStartedAt=Infinity;}
  canBlock(now:number,incomingAngle:number):boolean {
    const delta=Math.atan2(Math.sin(incomingAngle-this.guardFacing),Math.cos(incomingAngle-this.guardFacing));
    return this.guardHeld&&now-this.guardStartedAt>=s.guardStartup&&Math.abs(delta)<=s.guardHalfAngle;
  }
}
