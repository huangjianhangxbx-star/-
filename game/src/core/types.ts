export type Pos={x:number;y:number};
export type Direction='north'|'east'|'south'|'west';
export type Life='reserve'|'active'|'downed'|'rescued'|'withdrawn'|'dead'|'respawning'|'departed';
export type Status={kind:'attack'|'guard'|'poison'|'defense'|'stun';remaining:number;power:number;source?:string;name?:string;duration?:number};
export type Weapon={name:string;range:number;width:number;remote:boolean;damage:number;durability:number;maxDurability:number;shadow:boolean;damageKind?:'physical'|'arcane';subtype?:'slash'|'pierce'|'impact'|'flame'|'frost'|'shadow';weight?:number;class?:'blade'|'gun'|'focus'};
export type Unit={id:string;name:string;team:'ally'|'enemy';role:'hunter'|'fiorre'|'guard'|'ranger'|'melee'|'ranged'|'heavy';asset:string;color:string;pos:Pos;drawPos:Pos;life:Life;hp:number;maxHp:number;facing:Direction;defaultFacing:Direction;speed:number;block:number;damage:number;attackPeriod:number;attackTimer:number;skillCd:number;skillMax:number;skillTime:number;skillPulse?:number;sniperMode?:boolean;autoSkill?:boolean;poisonMeter?:number;cloneOf?:string;ready:number;downTimer:number;respawnTimer:number;path:Pos[];destination:Pos|null;transition:number;moveProgress:number;intent:'move'|'extract'|'gate'|'rescue'|null;rescueTarget:string|null;route:Pos[];routeIndex:number;statuses:Status[];weapons:Weapon[];weaponIndex:number;stress:number;stressCd:number;light:number;hitFlash:number;attackFlash:number;reveal:number;attackPending?:{targetId:string;remaining:number;facing:Direction};turnCd?:number;moveFrom?:Pos;dodge?:number;defense?:{subtype:NonNullable<Weapon['subtype']>;flat:number};capacity?:number;compatibleClasses?:NonNullable<Weapon['class']>[];mental?:'steady'|'inspired'|'distressed';mentalTime?:number};
export type Tile=Pos & {layer:number;obstacle:boolean};
export type Card={id:string;kind:'dash'|'cooldown'|'power'|'barricade'|'heal';group:'scene'|'deck'|'exclusive';name:string;description:string;ownerId?:string};
export type Effect={id:number;from:Pos;to:Pos;color:string;remaining:number;kind:'shot'|'heal'|'burst'|'loot';sourceId?:string;asset?:string;action?:'attack'|'skill';amount?:number};
export type Wave={id:number;route:Pos[];startAt:number;previewAt:number;count:number;spawned:number;interval:number;hpScale?:number;damageScale?:number};
export type GameState={mode:string;phase:'briefing'|'battle'|'result'|'nodes'|'ended';result:'victory'|'defeat'|null;tiles:Tile[];width:number;height:number;units:Unit[];time:number;crystalHp:number;crystalMax:number;goal:Pos;gate:Pos;spawns:Pos[];kills:number;totalEnemies:number;spawned:number;spawnTimer:number;wave:number;waves:Wave[];cards:Card[];fragments:number;autoDraw:boolean;inventory:{heal:number;weapon:number;light:number};quickSlots:('heal'|'weapon'|'light')[];barricades:Pos[];barrierHp?:Record<string,number>;lights:{pos:Pos;radius:number;remaining:number}[];effects:Effect[];stats:Record<string,number>;log:string[];notice:string;node:number;completed:number[];retries:number;canStay:boolean;seed:number;nextId:number;reveals?:Record<string,number>};
export type Command=
|{type:'start'}|{type:'move';id:string;to:Pos;facing?:Direction}|{type:'face';id:string;facing:Direction}
|{type:'deploy';id:string;to:Pos;facing:Direction}|{type:'skill';id:string}|{type:'rescue';id:string}
|{type:'extract';id:string;via:'shadow'|'gate'}|{type:'card';cardId:string;to:Pos;targetId?:string;direction?:Direction}
|{type:'clone';id:string;to:Pos}|{type:'draw'}|{type:'autoDraw'}|{type:'item';item:'heal'|'weapon'|'light';to:Pos;targetId?:string}
|{type:'equipQuick';item:'heal'|'weapon'|'light'}|{type:'switchWeapon';id:string}
|{type:'continue'}|{type:'enter';node:number}|{type:'rest'};
export type CommandResult={ok:boolean;reason?:string};
export type UIOverlay={selectedId:string|null;hover:Pos|null;path:Pos[];range:Pos[];rangeKind?:'attack'|'skill';deployTiles:Pos[];targeting:boolean};
export const DIRS:Direction[]=['north','east','south','west'];






