/** Entity mechanics only: selected enemy motion/contact policy belongs to its profile. */
export interface ProjectilePoint {x:number;y:number}
export interface ProjectileSpec {
  kind?:'ballistic';landing?:ProjectilePoint;duration?:number;height?:number;sourceSkillId?:string;
  id:number;generation:number;ownerId:string;sourceActionId:number;rootActionId:number;
  position:ProjectilePoint;velocity:ProjectilePoint;radius:number;damage:number;
  spawnedAt:number;expiresAt:number;ownerDeath:'retain'|'end';
}
export interface Projectile extends ProjectileSpec {hitTargets:Set<string>;updatedAt:number;start:ProjectilePoint;altitude:number}
export interface ProjectileTarget {id:string;position:ProjectilePoint;radius:number}
export interface ProjectileContact {projectile:Projectile;targetId:string}

/** Swept circle contact avoids tunnelling; has no artificial immunity or defense decision. */
export function sweptContact(start:ProjectilePoint,end:ProjectilePoint,target:ProjectilePoint,radius:number):boolean {
  const dx=end.x-start.x,dy=end.y-start.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((target.x-start.x)*dx+(target.y-start.y)*dy)/length)):0;
  return Math.hypot(start.x+dx*t-target.x,start.y+dy*t-target.y)<=radius;
}
export class ProjectileRuntime {
  entities:Projectile[]=[];
  landings:Projectile[]=[];
  spawn(spec:ProjectileSpec):Projectile {
    if(this.entities.some(p=>p.id===spec.id))throw new Error('Duplicate projectile identity');
    const entity:Projectile={...spec,landing:spec.landing?{...spec.landing}:undefined,start:{...spec.position},altitude:0,position:{...spec.position},velocity:{...spec.velocity},hitTargets:new Set(),updatedAt:spec.spawnedAt};
    this.entities.push(entity);return entity;
  }
  reset():void {this.entities=[];this.landings=[];}
  ownerDied(ownerId:string):void {this.entities=this.entities.filter(p=>p.ownerId!==ownerId||p.ownerDeath==='retain');}
  advance(now:number,generation:number,targets:readonly ProjectileTarget[]):ProjectileContact[] {
    const contacts:ProjectileContact[]=[];
    this.landings=[];
    this.entities=this.entities.filter(p=>p.generation===generation&&p.updatedAt<p.expiresAt);
    for(const p of this.entities){
      if(now<=p.updatedAt)continue;
      const start={...p.position},until=Math.min(now,p.expiresAt),dt=until-p.updatedAt;
      if(p.kind==='ballistic'){
        const t=Math.max(0,Math.min(1,(until-p.spawnedAt)/p.duration!));
        p.position={x:p.start.x+(p.landing!.x-p.start.x)*t,y:p.start.y+(p.landing!.y-p.start.y)*t};
        p.altitude=4*p.height!*t*(1-t);p.updatedAt=until;
        if(now>=p.expiresAt)this.landings.push(p);
        continue;
      }
      p.position.x+=p.velocity.x*dt;p.position.y+=p.velocity.y*dt;p.updatedAt=until;
      for(const target of targets){
        if(target.id===p.ownerId||p.hitTargets.has(target.id))continue;
        if(sweptContact(start,p.position,target.position,p.radius+target.radius)){
          p.hitTargets.add(target.id);contacts.push({projectile:p,targetId:target.id});
        }
      }
    }
    this.entities=this.entities.filter(p=>now<p.expiresAt);
    return contacts;
  }
}
