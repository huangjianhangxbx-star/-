import {m2Reference as r,m2Sample as s} from '../profiles/m2';

/** Independent pools owned by an actor. All regeneration uses simulation time. */
export class LabResources {
  mp=s.mpInitial; frost=s.frostInitial; dashCharges=s.dashMax;
  activeCharge=r.activeMaxCharge; activeCooldown=0; dashCooldown=0;
  private frostDamagedAt=-Infinity;
  spendDodge():boolean {
    if(this.dashCharges<1)return false;
    this.dashCharges--;if(this.dashCooldown<=0)this.dashCooldown=s.dashCooldown;return true;
  }
  spendBlock(now:number):boolean {
    if(this.frost<r.frostBlockCost)return false;
    this.frost-=r.frostBlockCost;this.frostDamagedAt=now;return true;
  }
  /** CR03 U03: independent release payment, same damaged-time notification. */
  spendIce(now:number):boolean {if(this.frost<1)return false;this.frost-=1;this.frostDamagedAt=now;return true;}
  activeReady():boolean{return this.activeCharge>0&&this.mp>=r.activeCost;}
  payActive():boolean {
    if(!this.activeReady())return false;
    this.mp-=r.activeCost;this.activeCharge--;this.activeCooldown=r.activeCooldown;return true;
  }
  restoreFrost(amount:number):number {const before=this.frost;this.frost=Math.min(r.frostBaseMax,this.frost+amount);return this.frost-before;}
  advance(dt:number,now:number,guarding:boolean):void {
    if(this.activeCharge<r.activeMaxCharge){this.activeCooldown=Math.max(0,this.activeCooldown-dt);if(this.activeCooldown<=0)this.activeCharge++;}
    if(this.dashCharges<s.dashMax){this.dashCooldown=Math.max(0,this.dashCooldown-dt);if(this.dashCooldown<=0){this.dashCharges++;if(this.dashCharges<s.dashMax)this.dashCooldown=s.dashCooldown;}}
    if(!guarding&&now-this.frostDamagedAt>s.frostDelay)this.restoreFrost(r.frostBaseRecovery*dt);
  }
}
