import type {LabResources} from './resources';
import {m2Reference} from '../profiles/m2';
export interface EffectiveHit {generation:number;casterId:string;actionId:number;rootId:number;waveId:number;targetId:string;kind:string;damage:number}
/** Every consumer receives identity-rich effective hits, never animation Hit. */
export class HitEffects {
  private listeners=new Set<(hit:EffectiveHit)=>void>();
  subscribe(listener:(hit:EffectiveHit)=>void):()=>void {this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  publish(hit:EffectiveHit):void{for(const listener of this.listeners)listener(hit);}
}
export function energyReturn(bus:HitEffects,generation:number,resources:(caster:string)=>LabResources|undefined,onReturn:(hit:EffectiveHit,delta:number)=>void,liveWave?:(waveId:number)=>boolean):()=>void {
  const paid=new Map<string,number>();
  const off=bus.subscribe(hit=>{
    if(liveWave)for(const [key,wave] of paid)if(!liveWave(wave))paid.delete(key);
    if(hit.generation!==generation||hit.kind!=='shield-charge'||hit.damage<=0)return;
    const key=`${hit.casterId}/${hit.rootId}/${hit.waveId}`;
    const owner=resources(hit.casterId);if(paid.has(key)||!owner)return;
    paid.set(key,hit.waveId);onReturn(hit,owner.restoreFrost(m2Reference.growthFrost));
  });
  return()=>{off();paid.clear();};
}
