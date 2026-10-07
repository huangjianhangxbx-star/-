import {al02} from '../profiles/al02';
/** Actual skill attack nodes; deliberately separate from effective damage/HitEffects. */
export interface AttackEvent {
  readonly loadoutRevision?:number;readonly equipmentInstanceId?:string;
  readonly id:number;readonly generation:number;readonly casterId:string;
  readonly actionId:number;readonly rootId:number;readonly parentId:number|null;
  readonly slotSkillId:string;readonly executedSkillId:string;
  readonly isLeftMouse:boolean;readonly tags:readonly string[];
  readonly suppressBuff:boolean;readonly facing:number;
}
export class AttackEvents {
  private listeners=new Set<(event:AttackEvent)=>void>();
  get subscriberCount():number{return this.listeners.size;}
  subscribe(listener:(event:AttackEvent)=>void):()=>void {
    this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};
  }
  publish(event:AttackEvent):void {
    const snapshot=Object.freeze({...event,tags:Object.freeze([...event.tags])});
    for(const listener of [...this.listeners])listener(snapshot);
  }
}
/** CR03B T01–T05: one installed equipment owns its simulation-time cooldown. */
export class AxeEquipment {
  cooldown=0;triggerCount=0;
  private consumed=new Set<number>();private unsubscribe:()=>void;
  constructor(bus:AttackEvents,readonly generation:number,readonly casterId:string,request:(event:AttackEvent)=>void,reject?:(event:AttackEvent,reason:string)=>void) {
    this.unsubscribe=bus.subscribe(event=>{
      if(event.generation!==generation||event.casterId!==casterId||event.suppressBuff)return;
      if(!((event.isLeftMouse&&!event.tags.includes('不算左键'))||event.tags.includes('左键'))){reject?.(event,'qualification');return;}
      if(this.cooldown>0||this.consumed.has(event.id)){reject?.(event,this.consumed.has(event.id)?'duplicate':'cooldown');return;}
      this.consumed.add(event.id);this.cooldown=al02.source.axeCooldown;this.triggerCount++;
      // Commit before the independent auxiliary request; synchronous feedback sees CD.
      request(event);
    });
  }
  advance(delta:number):void {
    if(!Number.isFinite(delta)||delta<0)throw new Error('Invalid equipment simulation delta');
    this.cooldown=Math.max(0,this.cooldown-delta);
  }
  detach():void{this.unsubscribe();this.consumed.clear();}
}
