import type {Action,Actor,Hazard,LabWorld} from './world';
import type {LabResources} from './resources';
import type {Projectile,ProjectileContact} from './projectiles';
import {IsdaraController} from './players/isdara';
import {CannoneerController} from './players/cannoneer';
export type PlayerKind='isdara'|'cannoneer';
export interface PlayerProfile {kind:PlayerKind;characterId:string;actorId:string;label:string;family:'blue'|'yellow';hp:number;speed:number;builds:boolean}
export interface ResourceRow {name:string;value:string}
export interface PlayerController {
 readonly profile:PlayerProfile;readonly resources?:LabResources;
 secondary(held:boolean):boolean;mobility():boolean;active():boolean;releaseActive():boolean;cancel():boolean;
 step(dt:number):void;updateAction(dt:number):void;interrupted(action:Action,reason:string):void;
 resourceRows():ResourceRow[];
 projectileContact?(contact:ProjectileContact):void;landing?(projectile:Projectile):boolean;
 suspend?():void;presentationPose?():string|undefined;
 guardContact?(hazard:Hazard,owner:Actor,dx:number,dy:number,distance:number):boolean;
}
/** Finite registry, selected only at construction / safe Reset. */
export function createPlayerController(kind:PlayerKind,world:LabWorld):PlayerController {
 return kind==='isdara'?new IsdaraController(world):new CannoneerController(world);
}
