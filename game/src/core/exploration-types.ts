import type {Pos,Tile,Unit} from './types';
export type ExplorationEnemy={id:string;role:Unit['role'];pos:Pos;patrol?:Pos[];hp:number;damage:number;asset:string};
export type ExplorationPoint={id:string;pos:Pos;kind:'objective'|'resource'|'campfire';reward:number};
export type ExplorationDefinition={victoryCondition?:'objective'|'exit';id:number;name:string;width:number;height:number;tiles:Tile[];entry:Pos;exit:Pos;enemies:ExplorationEnemy[];points:ExplorationPoint[]};
export type ExplorationMemory={seen:string[];mechanisms:string[];objective:boolean;cleared:boolean};
export type ExplorationRun={checkpoint?:Pos;combatReason?:string;formationHeading?:number;definition:ExplorationDefinition;memory:ExplorationMemory;visible:string[];lastActivity:number;selectedId:string|null;visionAt:number};
export type EnemySense={alertedAt?:number;home:Pos;patrol:Pos[];cursor:number;lastSeen?:Pos;lostAt?:number;provoked?:string;provokedAt?:number};
export type PartyTask={kind:'recall'|'regroup';elapsed:number;repath:number};
