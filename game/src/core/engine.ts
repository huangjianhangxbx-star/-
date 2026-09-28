import {createMapTiles,createWaves,MAP_WIDTH,MAP_HEIGHT,MAP_GOAL,MAP_SPAWNS,ALLY_START} from './map';
import { DIRS, type GameState, type Command, type CommandResult, type Pos, type Unit, type Direction, type Weapon, type Card, type Wave } from './types';
import {COMBAT_CONFIG,weightProfile,damageAfterDefense,compatibleWeapon} from './combat-config';
export {weightProfile} from './combat-config';
export const cloneCost=COMBAT_CONFIG.cloneCost;
const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const dist = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const copy = (p: Pos) => ({ x: p.x, y: p.y });
const tile = (s: GameState, p: Pos) => s.tiles.find(t => same(t, p));
const active = (u: Unit) => u.life === 'active';
const weapon = (u: Unit):Weapon => u.weapons[u.weaponIndex] || {name:'无武器',range:0,width:0,remote:false,damage:0,durability:0,maxDurability:0,shadow:true};
const warmup=(u:Unit)=>COMBAT_CONFIG.warmup[u.role as keyof typeof COMBAT_CONFIG.warmup]||0;
const initialCooldown=(u:Unit)=>COMBAT_CONFIG.initialSkillCharge&&['hunter','fiorre'].includes(u.role)?u.skillMax:0;
const hunter = (s: GameState) => s.units.find(u => u.id === 'hunter' && active(u));
const walkable = (s: GameState, p: Pos) => !!tile(s, p) && !tile(s, p)!.obstacle && !s.barricades.some(b => same(b, p));
const occupied = (s: GameState, p: Pos, id = '') => s.units.some(u => u.id !== id && u.team === 'ally' && (active(u) || u.life === 'downed') && (same(u.pos, p) || !!u.destination && same(u.destination, p)));
function note(s: GameState, msg: string) { s.notice = msg; s.log.unshift(msg); s.log = s.log.slice(0, 40); }
function rng(s: GameState) { s.seed = (s.seed * 1664525 + 1013904223) >>> 0; return s.seed / 4294967296; }
function makeUnit(id: string, name: string, role: Unit['role'], pos: Pos, team: Unit['team'] = 'ally'): Unit {
    const remote = ['hunter', 'ranger', 'ranged', 'guard'].includes(role);
    const w: Weapon = { name: role==='guard'?'淬毒飞刀':role==='fiorre'?'短杖':'巡夜长铳', range: role === 'ranger'?7:['hunter','guard'].includes(role)?5:role==='fiorre'?1:4, width:0, remote:role!=='fiorre'&&remote, damage:COMBAT_CONFIG.allyAttack[role as keyof typeof COMBAT_CONFIG.allyAttack]||18, durability: 60, maxDurability: 60, shadow: false };
    return { id, name, role, team, asset: role === 'hunter' ? 'Galore' : role === 'guard' ? 'Arina' : role === 'ranger' ? 'Cynthia' : 'Livia', color: team === 'enemy' ? '#b65559' : '#74b9c7', pos: copy(pos), drawPos: copy(pos), life: team === 'enemy' || role === 'hunter' ? 'active' : 'reserve', hp: COMBAT_CONFIG.allyHp[role as keyof typeof COMBAT_CONFIG.allyHp]||120, maxHp: COMBAT_CONFIG.allyHp[role as keyof typeof COMBAT_CONFIG.allyHp]||120, facing: team === 'ally' ? 'east' : 'west', defaultFacing: team === 'ally' ? 'east' : 'west', speed: COMBAT_CONFIG.baseMoveSpeed, block: role === 'guard' ? 3 : 1, damage: w.damage, attackPeriod: role === 'guard' ? 1.4 : 1.1, attackTimer: 0, skillCd: 0, skillMax: 18, skillTime: 0, ready: 0, downTimer: 0, respawnTimer: 0, path: [], destination: null, transition: 0, moveProgress: 0, intent: null, rescueTarget: null, route: [], routeIndex: 0, statuses: [], weapons: [w, { ...w, name: '影武器', damage: Math.round(w.damage * .65), durability: 1, maxDurability: 1, shadow: true }], weaponIndex: 0, stress: 0, stressCd: 0, light: role === 'hunter' ? 4 : 2, hitFlash: 0, attackFlash: 0, reveal: 0 };
}
function configureCombat(u:Unit){
    const arcane=u.role==='fiorre',gun=['hunter','ranger','ranged'].includes(u.role);
    const cls=arcane?'focus':gun?'gun':'blade';
    u.compatibleClasses=[cls];u.capacity=u.role==='ranger'?7:10;
    u.defense={subtype:u.role==='guard'?'impact':u.role==='heavy'?'pierce':arcane?'flame':'slash',flat:u.role==='guard'||u.role==='heavy'?8:3};
    u.dodge=u.role==='ranger'?.12:u.role==='hunter'?.05:0;
    u.mental='steady';u.mentalTime=0;
    u.autoSkill=u.role==='guard';u.sniperMode=false;u.poisonMeter=0;
    for(const w of u.weapons){w.class=cls;w.damageKind=arcane?'arcane':'physical';w.subtype=arcane?'shadow':gun||u.role==='guard'?'pierce':'slash';w.weight=w.shadow?1:gun?5:4;}
}
function gainStress(s:GameState,u:Unit,event:'lowHealth'|'allyDown'){
    if(u.team!=='ally'||!active(u)||u.stressCd>0)return;
    const role=u.role as 'hunter'|'fiorre'|'guard'|'ranger';
    u.stress=Math.min(100,u.stress+(COMBAT_CONFIG.mental[event][role]||12));
    u.stressCd=COMBAT_CONFIG.mental.cooldown;
    note(s,u.name+(event==='allyDown'?'目睹同伴倒下':'在重伤中承受压力'));
}
function applyAttackDamage(s:GameState,target:Unit,w:Weapon,power:number,attacker?:Unit){
    if(!active(target))return;
    const dodge=weightProfile(target).dodge;
    if(dodge>0&&rng(s)<dodge){s.stats.dodges=(s.stats.dodges||0)+1;return}
    hurt(s,target,damageAfterDefense(w,target,power));
    if(target.life==='dead'&&attacker?.team==='ally'&&attacker.role==='hunter'){
        s.stats.hunterKills=(s.stats.hunterKills||0)+1;
        if(s.stats.hunterKills%COMBAT_CONFIG.exclusive.hunterKills===0&&!s.cards.some(c=>c.group==='exclusive'&&c.id.startsWith('exclusive-hunter-'))){
            const reward=card(s,'power','exclusive');reward.id='exclusive-hunter-'+reward.id;reward.name='猎人·余烬';s.cards.push(reward);
            note(s,'猎人击杀触发专属牌：余烬（最多持有 1 张）');
        }
    }
}
function card(s: GameState, kind: Card['kind'], group: Card['group'] = 'deck'): Card { const names = { dash: '疾行', cooldown: '余响', power: '锋芒', barricade: '铁栅', heal: '急救' }; return { id: 'card-' + s.nextId++, kind, group, name: names[kind], description: { dash: '角色沿默认方向急速位移一格，并短暂闪避', cooldown: '清除目标技能冷却', power: '目标攻击强化 10 秒', barricade: '放置不能封死通路的路障', heal: '恢复目标 45 点生命' }[kind] }; }
export function createGame(mode = 'standard'): GameState {
    const tiles = createMapTiles();
    const waves=createWaves();
    const s: GameState = { mode, phase: 'briefing', result: null, tiles, width: MAP_WIDTH, height: MAP_HEIGHT, units: [makeUnit('hunter', '猎人', 'hunter', ALLY_START), makeUnit('fiorre', '菲奥蕾', 'fiorre', { x: 5, y: 3 }), makeUnit('guard', '守卫', 'guard', { x: 5, y: 4 }), makeUnit('ranger', '游侠', 'ranger', { x: 5, y: 5 })], time: 0, crystalHp: COMBAT_CONFIG.crystalHp, crystalMax: COMBAT_CONFIG.crystalHp, goal: copy(MAP_GOAL), gate: copy(MAP_GOAL), spawns: MAP_SPAWNS.map(copy), kills: 0, totalEnemies: waves.reduce((n,w)=>n+w.count,0), spawned: 0, spawnTimer: waves[0].startAt, wave: 0, waves, cards: [], fragments: 40, autoDraw: false, inventory: { heal: 3, weapon: 2, light: 2 }, quickSlots: ['heal', 'weapon', 'light'], barricades: [], lights: [], effects: [], stats: { moves: 0, reroutes: 0, manualTurns: 0, autoTurns: 0, rescues: 0, invalid: 0, cancels: 0, slowTime: 0 }, log: [], notice: '部署伙伴，守住长夜中的水晶。', node: 1, completed: [], retries: 2, canStay: true, seed: 2739, nextId: 1 };
    s.cards = [card(s, 'dash', 'scene'), card(s, 'heal'), card(s, 'barricade'), card(s, 'power'), card(s, 'cooldown')];
    for(const u of s.units){u.ready=warmup(u);u.skillCd=initialCooldown(u);configureCombat(u)}
    return s;
}
export function pathTo(s:GameState,from:Pos,to:Pos):Pos[]{return findPath(s,from,to,false)}
export function enemyPathTo(s:GameState,from:Pos,to:Pos):Pos[]{return findPath(s,from,to,true)}
function findPath(s: GameState, from: Pos, to: Pos,groundOnly:boolean): Pos[] {
    const passable=(p:Pos)=>walkable(s,p)&&(!groundOnly||tile(s,p)?.layer===0);
    if (!passable(to) || same(from, to)||groundOnly&&tile(s,from)?.layer!==0)
        return [];
    const key = (p: Pos) => p.x + ',' + p.y;
    const queue = [copy(from)], prev = new Map<string, Pos | null>([[key(from), null]]);
    for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        for (const n of [{ x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 },{x:p.x-1,y:p.y-1},{x:p.x+1,y:p.y-1},{x:p.x-1,y:p.y+1},{x:p.x+1,y:p.y+1}]) {
            if (!passable(n) || prev.has(key(n)))
                continue;
            if(n.x!==p.x&&n.y!==p.y){
                const a={x:n.x,y:p.y},b={x:p.x,y:n.y},layer=tile(s,p)?.layer;
                if(!passable(a)||!passable(b)||[n,a,b].some(t=>tile(s,t)?.layer!==layer))continue;
            }
            prev.set(key(n), p);
            if (same(n, to)) {
                const out = [n];
                let q = prev.get(key(n));
                while (q && !same(q, from)) {
                    out.unshift(q);
                    q = prev.get(key(q));
                }
                return out;
            }
            queue.push(n);
        }
    }
    return [];
}
export function deployTiles(s: GameState): Pos[] { const h = hunter(s); return s.tiles.filter(t => walkable(s, t) && !occupied(s, t) && (s.mode === 'standard' || t.x <= 2 || !!h && dist(h.pos, t) <= 3)).map(copy); }
export function cloneTiles(s:GameState,id:string):Pos[]{const source=s.units.find(u=>u.id===id&&u.team==='ally'&&active(u)&&!u.cloneOf);if(!source)return[];return s.tiles.filter(t=>walkable(s,t)&&t.layer===tile(s,source.pos)?.layer&&dist(t,source.pos)<=3&&!occupied(s,t)&&!s.units.some(u=>u.team==='enemy'&&active(u)&&same(u.pos,t))).map(copy);}
export function visible(s: GameState, u: Unit): boolean { return s.mode !== 'dark' && s.node !== 3 || u.team === 'ally' || s.units.some(a => a.team === 'ally' && active(a) && dist(a.pos, u.pos) <= a.light) || s.lights.some(l => dist(l.pos, u.pos) <= l.radius); }
function geometry(s:GameState,u:Unit,p:Pos,d:Direction){
    if(!compatibleWeapon(u,u.weapons[u.weaponIndex]))return false;
    return templateGeometry(s,u,p,d,weapon(u));
}
function templateGeometry(s: GameState, u: Unit, p: Pos, d: Direction,w:Pick<Weapon,'range'|'width'|'remote'>) { const dx = p.x - u.pos.x, dy = p.y - u.pos.y; const forward = d === 'east' ? dx : d === 'west' ? -dx : d === 'south' ? dy : -dy, side = d === 'east' || d === 'west' ? Math.abs(dy) : Math.abs(dx); if (forward < 0 || forward > w.range || side > w.width)
    return false; const a = tile(s, u.pos), b = tile(s, p); if (!a || !b || b.obstacle || (!w.remote && a.layer !== b.layer))
    return false; if (w.remote && a.layer === 0) {
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i < steps; i++) {
        const t = tile(s, { x: Math.round(u.pos.x + dx * i / steps), y: Math.round(u.pos.y + dy * i / steps) });
        if (t && (t.obstacle || t.layer > 0))
            return false;
    }
} return true; }
export function rangeTiles(s: GameState, u: Unit, d: Direction = u.facing): Pos[] { return s.tiles.filter(t => geometry(s, u, t, d) && (u.team === 'enemy' || visible(s, { ...u, team: 'enemy', pos: t, reveal: 0 }) || s.units.some(e => same(e.pos, t) && (s.reveals?.[e.id + ':' + u.id] || 0) > s.time))).map(copy); }
export function canHit(s: GameState, u: Unit, target: Unit, d: Direction = u.facing) { return active(target) && u.team !== target.team && (u.team === 'enemy' || visible(s, target) || (s.reveals?.[target.id + ':' + u.id] || 0) > s.time) && geometry(s, u, target.pos, d); }
export function skillRangeTiles(s:GameState,u:Unit,d:Direction=u.facing):Pos[]{
    if(u.role==='guard'){
        const poisoned=s.units.filter(t=>t.team==='enemy'&&active(t)&&(t.poisonMeter||0)>0);
        if(poisoned.length)return s.tiles.filter(t=>!t.obstacle&&poisoned.some(center=>Math.hypot(t.x-center.pos.x,t.y-center.pos.y)<=COMBAT_CONFIG.skills.poisonRadius)).map(copy);
        return rangeTiles(s,u,d);
    }
    if(u.role==='fiorre')return s.tiles.filter(t=>!t.obstacle&&Math.hypot(t.x-u.pos.x,t.y-u.pos.y)<=COMBAT_CONFIG.skills.fiorreRadius).map(copy);
    const spec={range:u.role==='hunter'?COMBAT_CONFIG.skills.hunterRange:COMBAT_CONFIG.skills.rangerRange,width:u.role==='hunter'?COMBAT_CONFIG.skills.hunterWidth:COMBAT_CONFIG.skills.rangerWidth,remote:true};
    return s.tiles.filter(t=>templateGeometry(s,u,t,d,spec)&&(u.team==='enemy'||visible(s,{...u,team:'enemy',pos:t,reveal:0})||s.units.some(e=>same(e.pos,t)&&(s.reveals?.[e.id+':'+u.id]||0)>s.time))).map(copy);
}
function move(s: GameState, u: Unit, to: Pos, facing?: Direction): CommandResult { if (!active(u) || !walkable(s, to) || occupied(s, to, u.id))
    return { ok: false, reason: '目标格不可用' }; const path = pathTo(s, u.pos, to); if (!path.length && !same(u.pos, to))
    return { ok: false, reason: '无法抵达' }; if (u.path.length)
    s.stats.reroutes++; u.path = path; u.destination = copy(to); u.intent = 'move'; u.moveProgress = 0; u.moveFrom=undefined;u.attackPending=undefined;u.drawPos = copy(u.pos); if (u.skillTime > 0) {
    u.skillTime = 0;
    u.skillCd = u.skillMax;
} u.defaultFacing=awayFromCrystal(s,u);u.facing=u.defaultFacing;s.stats.moves++; return { ok: true }; }
function awayFromCrystal(s:GameState,u:Unit):Direction{
    const dx=u.pos.x-s.goal.x,dy=u.pos.y-s.goal.y;
    return Math.abs(dx)>=Math.abs(dy)?(dx>=0?'east':'west'):(dy>=0?'south':'north');
}
function finish(s: GameState, victory: boolean) { s.result = victory ? 'victory' : 'defeat'; s.phase = 'result';s.units=s.units.filter(u=>!u.cloneOf); for (const u of s.units.filter(u => u.team === 'ally')) {
    if (u.life === 'downed' && u.downTimer > 0) {
        u.life = 'rescued';
        u.hp = 1;
    }
    u.path = [];
    u.destination = null;
    u.intent = null;
    u.statuses = [];
    u.skillTime = 0;
    u.attackPending=undefined;u.moveFrom=undefined;
} if (victory) {
    if (!s.completed.includes(s.node))
        s.completed.push(s.node);
    note(s, '节点净化完成。未超时的濒死角色已自动救回。');
}
else {
    if (s.retries > 0)
        s.retries--;
    else
        s.canStay = false;
    note(s, s.canStay ? '水晶失守，退出节点。损耗保留，可重新进入。' : '水晶失守，已无重置机会，本次远征结束。');
} s.cards = s.cards.filter(c => c.group !== 'scene'); s.effects = s.effects.filter(e=>e.kind==='loot'); s.lights = [];s.reveals={}; }
function enter(s: GameState, node: number) { s.node = node; s.phase = 'briefing'; s.result = null; s.crystalHp = s.crystalMax; s.units = s.units.filter(u => u.team === 'ally'&&!u.cloneOf); for (const u of s.units) {
    if (u.life === 'dead')
        continue;
    u.life = u.role === 'hunter' ? 'active' : 'reserve';
    u.pos = copy(ALLY_START);
    u.drawPos = copy(u.pos);
    u.path = [];
    u.destination = null;
    u.intent = null;
    u.ready = warmup(u);
    u.attackTimer = 0;
    u.skillTime = 0;
    u.skillCd=initialCooldown(u);u.sniperMode=false;u.autoSkill=u.role==='guard';u.poisonMeter=0;
    u.attackPending=undefined;u.moveFrom=undefined;u.moveProgress=0;u.turnCd=0;
    if (u.hp <= 0)
        u.hp = 1;
} s.kills = 0; s.spawned = 0;s.waves=createWaves(node);s.totalEnemies=s.waves.reduce((n,w)=>n+w.count,0);s.spawnTimer=s.waves[0].startAt;s.time = 0; s.barricades = [];s.barrierHp={};s.wave=0;s.effects=[]; s.lights = []; s.cards.push(card(s, 'dash', 'scene')); note(s, '进入节点 ' + node + '：水晶满血，远征损耗保留；技能从空条重新充能。'); }
export function command(s: GameState, c: Command): CommandResult {
    const fail = (reason: string) => { s.stats.invalid++; note(s, reason); return { ok: false, reason }; };
    const ok = (msg?: string) => { if (msg)
        note(s, msg); return { ok: true }; };
    if (c.type === 'start') {
        if (s.phase !== 'briefing')
            return fail('当前不能开始');
        s.phase = 'battle';
        return ok('战斗开始。敌群即将抵达。');
    }
    if (c.type === 'continue') {
        if (s.phase !== 'result')
            return fail('战斗尚未结束');
        s.phase = s.canStay ? 'nodes' : 'ended';
        return ok();
    }
    if (c.type === 'enter') {
        if (s.phase !== 'nodes' || !s.canStay || ![1, 3].includes(c.node) || c.node === 3 && !s.completed.includes(2))
            return fail('该节点尚未开放');
        enter(s, c.node);
        return ok();
    }
    if (c.type === 'rest') {
        if (s.phase !== 'nodes' || !s.completed.includes(1) || s.completed.includes(2))
            return fail('休息节点尚不可用');
        for (const u of s.units) {
            if (u.team === 'ally' && u.life !== 'dead') {
                u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * .5));
                u.stress = Math.max(0, u.stress - 40);
                u.skillCd = 0;
            }
        }
        s.completed.push(2);
        s.node = 2;
        return ok('休息完成：恢复半数最大生命，精神压力下降。');
    }
    if (c.type === 'equipQuick') {
        s.quickSlots = [...s.quickSlots.filter(v => v !== c.item), c.item].slice(-3);
        return ok();
    }
    if (s.phase !== 'battle' && s.phase !== 'briefing')
        return fail('当前不在战场');
    if (c.type === 'autoDraw') {
        s.autoDraw = !s.autoDraw;
        return ok();
    }
    if (c.type === 'draw') {
        if (s.fragments < 20)
            return fail('需要 20 碎片');
        s.fragments -= 20;
        s.cards = s.cards.filter(c => c.group !== 'deck');
        const kinds: Card['kind'][] = ['heal', 'barricade', 'power', 'cooldown', 'dash'];
        for (let i = 0; i < 4; i++)
            s.cards.push(card(s, kinds[Math.floor(rng(s) * kinds.length)]));
        return ok('背包牌已刷新，临场与专属牌保留。');
    }
    if (c.type === 'card' || c.type === 'item') {
        const selected = c.type === 'card' ? s.cards.find(a => a.id === c.cardId) : null;
        if (c.type === 'card' && !selected)
            return fail('卡牌已不存在');
        if (!tile(s, c.to))
            return fail('请选择有效格');
        const h = hunter(s);
        if (c.type === 'item' && (!h || dist(h.pos, c.to) > 3 || s.inventory[c.item] <= 0))
            return fail('道具需在猎人周围 3 格使用且库存充足');
        const kind = c.type === 'item' ? c.item : selected!.kind;
        const target = s.units.find(u => u.id === c.targetId) || s.units.find(u => u.team === 'ally' && active(u) && same(u.pos, c.to));
        if(c.type==='card'&&target&&target.statuses.some(st=>st.source==='card:'+kind&&st.remaining>0))return fail('同一卡牌效果仍在持续，不能叠加；卡牌未消耗');
        if(c.type==='item'&&target&&(!h||dist(h.pos,target.pos)>3))return fail('目标超出猎人道具范围');
        if (kind === 'barricade') {
            if (!walkable(s, c.to) || s.units.some(u => active(u) && same(u.pos, c.to)) || same(c.to, s.goal) || s.spawns.some(p => same(p, c.to)))
                return fail('此处无法放置路障');
            s.barricades.push(copy(c.to));
            if ([...s.spawns, ...s.units.filter(u => u.team === 'enemy' && active(u)).map(u => u.pos)].some(p => !same(p, s.goal) && !enemyPathTo(s, p, s.goal).length)) {
                s.barricades.pop();
                return fail('路障不能封死敌人通路');
            }
            (s.barrierHp??={})[c.to.x+','+c.to.y]=COMBAT_CONFIG.barrierHp;
        }
        else if (kind === 'light') {
            s.lights.push({ pos: copy(c.to), radius: 4, remaining: 35 });
        }
        else {
            if (!target || target.team !== 'ally' || !active(target))
                return fail('需要一个在场友方目标');
            if(c.type==='card'&&target.cloneOf&&selected!.ownerId&&selected!.ownerId!==target.id)return fail('该卡牌属于另一名复制体');
            if (kind === 'heal') {
                if (target.hp >= target.maxHp)
                    return fail('目标生命已满');
                target.hp = Math.min(target.maxHp, target.hp + 45);
            }
            else if (kind === 'weapon') {
                if(!compatibleWeapon(target,target.weapons[0]))return fail('角色职业不兼容该武器');
                target.weapons[0].durability = target.weapons[0].maxDurability;
                target.weaponIndex = 0;
            }
            else if (kind === 'cooldown')
                target.skillCd = 0;
            else if (kind === 'power')
                target.statuses.push({ kind: 'attack', remaining: 10,duration:10,source:'card:power',name:'锋芒', power: .5 });
            else if (kind === 'dash') {
                if(target.cloneOf)return fail('复制体不可使用位移卡');
                const d=c.type==='card'?c.direction:undefined;
                if(!d)return fail('请选择疾行方向');
                const to={x:target.pos.x+(d==='east'?1:d==='west'?-1:0),y:target.pos.y+(d==='south'?1:d==='north'?-1:0)};
                if(dist(to,target.pos)!==1||!walkable(s,to)||occupied(s,to,target.id)||s.units.some(e=>e.team==='enemy'&&active(e)&&same(e.pos,to)))return fail('疾行需要一个可用的相邻格');
                const path=pathTo(s,target.pos,to);if(!path.length)return fail('疾行方向被阻挡');
                target.path=[];target.destination=null;target.intent=null;target.attackPending=undefined;target.moveProgress=0;target.moveFrom=undefined;target.drawPos=copy(to);target.pos=copy(to);
                target.statuses.push({ kind: 'guard', remaining: .35,duration:.35,source:'card:dash',name:'疾行闪避', power: 1 });
            }
        }
        if (c.type === 'card')
            s.cards = s.cards.filter(a => a.id !== c.cardId);
        else
            s.inventory[c.item]--;
        s.stats[c.type==='card'?'cards':'items']=(s.stats[c.type==='card'?'cards':'items']||0)+1;
        return ok('已使用 ' + (selected?.name || c.type === 'item' && c.item));
    }
    const u = 'id' in c ? s.units.find(a => a.id === c.id && a.team === 'ally') : null;
    if (!u)
        return fail('角色不存在');
    if(c.type==='clone'){
        if(!active(u)||u.cloneOf||s.fragments<cloneCost||!cloneTiles(s,u.id).some(p=>same(p,c.to)))return fail('影复制体需要在场本体、可用部署格和20碎片');
        const id='clone-'+u.id+'-'+s.nextId++;
        const clone:Unit={...structuredClone(u),id,name:u.name+'·影',cloneOf:u.id,color:'#344a61',pos:copy(c.to),drawPos:copy(c.to),life:'active',hp:u.maxHp,maxHp:u.maxHp,path:[],destination:null,intent:null,rescueTarget:null,route:[],routeIndex:0,attackTimer:0,attackPending:undefined,moveProgress:0,moveFrom:undefined,skillTime:0,skillCd:initialCooldown(u),ready:0,downTimer:0,respawnTimer:0,statuses:[],weaponIndex:0,weapons:u.weapons.map(w=>({...w})),autoSkill:u.role==='guard',sniperMode:false,poisonMeter:0};
        s.fragments-=cloneCost;s.units.push(clone);note(s,u.name+' 的影复制体已布置（20碎片）');return ok();
    }
    if (c.type === 'deploy') {
        if (!['reserve', 'withdrawn'].includes(u.life) || u.ready > 0 || !deployTiles(s).some(t => same(t, c.to)))
            return fail('角色尚未就绪或部署格无效');
        u.life = 'active';
        u.pos = copy(c.to);
        u.drawPos = copy(c.to);
        u.facing = awayFromCrystal(s,u);
        u.defaultFacing = u.facing;
        u.ready = 0;
        return ok(u.name + ' 已部署');
    }
    if (c.type === 'rescue') {
        if (u.life !== 'downed' || !hValid(s))
            return fail('需要在场猎人与濒死角色');
        const h = hunter(s)!;
        const around = s.tiles.filter(t => dist(t, u.pos) <= 1 && walkable(s, t) && !occupied(s, t, h.id)).sort((a, b) => dist(a, h.pos) - dist(b, h.pos));
        const goal = around.find(t => same(t, h.pos) || pathTo(s, h.pos, t).length);
        if (!goal)
            return fail('救援路径受阻');
        const r = move(s, h, goal);
        if (!r.ok)
            return fail(r.reason!);
        h.intent = 'rescue';
        h.rescueTarget = u.id;
        return ok('猎人正在救援 ' + u.name);
    }
    if (!active(u))
        return fail('角色当前不在场');
    if (c.type === 'move') {
        if(u.cloneOf)return fail('复制体不可移动');
        const r = move(s, u, c.to, c.facing);
        return r.ok ? ok() : fail(r.reason!);
    }
    if (c.type === 'face') {
        return fail('当前版本自动朝向，无需手动定向');
    }
    if (c.type === 'switchWeapon') {
        if(!compatibleWeapon(u,u.weapons[1-u.weaponIndex]))return fail('角色职业不兼容该武器');
        u.weaponIndex = 1 - u.weaponIndex;
        u.attackPending=undefined;

        return ok('切换至 ' + weapon(u).name);
    }
    if (c.type === 'skill') {
        if(u.role==='ranger'){u.sniperMode=!u.sniperMode;u.attackPending=undefined;note(s,u.name+(u.sniperMode?'切换至狙击模式':'恢复常规射击'));return ok();}
        if(u.role==='guard'){u.autoSkill=u.autoSkill===false;note(s,u.name+(u.autoSkill?'启用自动毒刃':'关闭自动毒刃'));return ok();}
        if (u.skillCd > 0 || u.ready > 0 || u.skillTime > 0)
            return fail('技能尚未就绪');
        u.path = [];
        u.destination = null;
        u.intent = null;
        u.drawPos=copy(u.pos);u.moveProgress=0;u.moveFrom=undefined;u.attackPending=undefined;
        u.skillTime = u.role==='hunter'?COMBAT_CONFIG.skills.hunterDuration:2;
        u.skillPulse=.25;
        u.skillCd = 0;
        s.stats.skills=(s.stats.skills||0)+1;
        return ok(u.name + ' 施放技能');
    }
    if (c.type === 'extract') {
        if(u.cloneOf){s.units=s.units.filter(a=>a.id!==u.id);s.cards=s.cards.filter(a=>a.ownerId!==u.id);return ok('影复制体已消散');}
        if(c.via==='shadow')return fail('当前版本仅能通过水晶撤离');
        const target = s.goal;
        if (!target)
            return fail('无撤离路径');
        const r = move(s, u, target);
        if (!r.ok)
            return fail(r.reason!);
        u.intent = 'gate';
        return ok('前往水晶撤离');
    }
    return fail('未知操作');
}
const hValid = (s: GameState) => !!hunter(s);
function hurt(s: GameState, u: Unit, n: number) { if(!active(u)||n<=0||u.statuses.some(st=>st.kind==='guard'&&st.remaining>0))return;
n*=u.role==='guard'?1-COMBAT_CONFIG.guardReduction:1;
n*=1-Math.min(.9,Math.max(0,...u.statuses.filter(st=>st.kind==='defense'&&st.remaining>0).map(st=>st.power)));
u.hp = Math.max(0, u.hp - n);u.hitFlash = .2;
if(u.hp<=u.maxHp*.5&&u.team==='ally')gainStress(s,u,'lowHealth');
if (u.hp > 0)return;
if(u.cloneOf){u.life='dead';s.cards=s.cards.filter(c=>c.ownerId!==u.id);return;}
if(u.team==='ally')for(const a of s.units.filter(a=>a.id!==u.id&&dist(a.pos,u.pos)<=COMBAT_CONFIG.mental.nearbyRadius))gainStress(s,a,'allyDown');
u.path = []; u.destination = null; u.intent = null;u.attackPending=undefined;u.moveFrom=undefined; if (u.team === 'enemy') {
    u.life = 'dead';
    s.kills++;
    s.fragments += 4;
    s.effects.push({id:s.nextId++,kind:'loot',from:copy(u.pos),to:copy(u.pos),remaining:1.2,amount:4,color:'#dfb766',sourceId:u.id,asset:u.asset});
    return;
} if (u.role === 'hunter') {
    u.life = 'respawning';
    u.respawnTimer = 16;
    note(s, '猎人倒下，16 秒后重生');
}
else if (u.role === 'fiorre') {
    u.life = 'rescued';
    note(s, '菲奥蕾本场禁用');
}
else {
    u.life = 'downed';
    u.downTimer = 45;
    note(s, u.name + ' 濒死：45 秒救援窗口');
} }
function spawn(s: GameState,wave:Wave) { const i = s.spawned, role: Unit['role'] = i % 6 === 5 ? 'heavy' : i % 3 === 2 ? 'ranged' : 'melee', p = wave.route[0], u = makeUnit('enemy-' + s.nextId++, role === 'heavy' ? '重甲亡徒' : role === 'ranged' ? '铳手' : '亡徒', role, p, 'enemy'); u.asset = i % 2 ? 'Verlaine_bot' : 'Dustin'; const baseHp=role === 'heavy' ? 210 : role === 'ranged' ? 95 : 120,baseDamage=role === 'heavy' ? 16 : role === 'ranged' ? 11 : 9;u.hp=u.maxHp=Math.round(baseHp*(wave.hpScale??1));u.damage=Math.round(baseDamage*(wave.damageScale??1)); weapon(u).damage = u.damage; u.speed = COMBAT_CONFIG.baseMoveSpeed; u.light = 0; u.route = wave.route.slice(1).map(copy); if(!u.route.length)u.route=enemyPathTo(s,p,s.goal); u.path = u.route.map(copy); u.destination = copy(s.goal); u.intent = 'move'; configureCombat(u);s.units.push(u); s.spawned++; wave.spawned++;s.wave = Math.max(s.wave,wave.id); }
function settleIntent(s: GameState, u: Unit) { if (u.intent === 'rescue') {
    const t = s.units.find(a => a.id === u.rescueTarget);
    if (t?.life === 'downed' && dist(u.pos, t.pos) <= 1) {
        t.life = 'rescued';
        t.hp = 1;
        u.intent = null;
        u.path = [];
        s.stats.rescues++;
        note(s, t.name + ' 已救回，下一节点可部署');
    }
}
else if (u.intent === 'gate' && same(u.pos, s.goal)) {
    if(u.cloneOf){u.life='dead';s.cards=s.cards.filter(c=>c.ownerId!==u.id);note(s,u.name+' 已消散');return;}
    u.life = u.role === 'hunter' ? 'departed' : 'withdrawn';
    u.ready = 6;
    u.path = [];
    u.destination = null;
    u.intent = null;
    note(s, u.name + ' 已离场');
}
else if (u.intent === 'move' && !u.path.length) {
    u.intent = null;
    u.destination = null;
} }
function tick(s: GameState, dt: number) {
    s.time += dt;
    for(const wave of s.waves)while(wave.spawned<wave.count&&s.time+1e-8>=wave.startAt+wave.spawned*wave.interval)spawn(s,wave);
    const activeWave=s.waves.filter(w=>s.time>=w.startAt).at(-1);if(activeWave)s.wave=activeWave.id;
    const nextSpawns=s.waves.filter(w=>w.spawned<w.count).map(w=>w.startAt+w.spawned*w.interval-s.time);
    s.spawnTimer=nextSpawns.length?Math.max(0,Math.min(...nextSpawns)):0;
    s.effects = s.effects.filter(e => (e.remaining -= dt) > 0);
    s.lights = s.lights.filter(l => (l.remaining -= dt) > 0);
    for (const u of s.units) {
        u.turnCd=Math.max(0,(u.turnCd||0)-dt);
        u.skillCd = Math.max(0, u.skillCd - dt);
        u.ready = Math.max(0, u.ready - dt);
        u.hitFlash = Math.max(0, u.hitFlash - dt);
        u.attackFlash = Math.max(0, u.attackFlash - dt);
        u.reveal = Math.max(0, u.reveal - dt);
        if (u.life === 'downed') {
            u.downTimer -= dt;
            if (u.downTimer <= 0) {
                u.life = 'dead';
                note(s, u.name + ' 救援超时，已死亡');
            }
            continue;
        }
        if (u.life === 'respawning') {
            u.respawnTimer -= dt;
            if (u.respawnTimer <= 0) {
                const f=s.units.find(a=>a.role==='fiorre'&&active(a));
                const available=s.tiles.filter(t=>walkable(s,t)&&!occupied(s,t,u.id)&&!s.units.some(a=>a.id!==u.id&&active(a)&&same(a.pos,t)));
                const around=f?available.filter(t=>dist(t,f.pos)<=3).sort((a,b)=>dist(a,f.pos)-dist(b,f.pos)):[];
                const spawnPoint=around[0]||available.sort((a,b)=>dist(a,{x:2,y:4})-dist(b,{x:2,y:4}))[0];
                if(!spawnPoint){u.respawnTimer=.25;continue}
                u.life = 'active';
                u.hp = Math.round(u.maxHp * .6);
                u.pos = copy(spawnPoint);
                u.drawPos = copy(u.pos);
            }
            continue;
        }
        if (!active(u))
            continue;
        if(u.team==='ally'){u.defaultFacing=awayFromCrystal(s,u);if(!u.attackPending)u.facing=u.defaultFacing;}
        u.stressCd=Math.max(0,u.stressCd-dt);
        u.mentalTime=Math.max(0,(u.mentalTime||0)-dt);
        if(!u.mentalTime)u.mental='steady';
        for (const st of u.statuses) {
            st.remaining -= dt;
            if (st.kind === 'poison')
                hurt(s, u, st.power * dt);
        }
        u.statuses = u.statuses.filter(st => st.remaining > 0);
        if (!active(u))
            continue;
        if(u.team==='enemy'&&u.statuses.some(st=>st.kind==='stun')){u.attackPending=undefined;continue;}
        if(u.team==='ally'&&u.stress>=100){
            u.mental=u.role==='fiorre'||rng(s)<COMBAT_CONFIG.mental.inspiredChance?'inspired':'distressed';
            u.mentalTime=COMBAT_CONFIG.mental.duration;u.stress=40;
            note(s,u.name+(u.mental==='inspired'?'进入振奋状态':'进入承压状态，仍可正常指挥'));
        }
        if (u.skillTime > 0) {
            const before = u.skillTime;
            u.skillTime = Math.max(0, u.skillTime - dt);
            if (u.skillTime===0)u.skillCd=u.skillMax;
            if(u.role==='hunter'){
                u.skillPulse=(u.skillPulse??.25)-dt;
                if(u.skillPulse<=1e-8){castSkillPulse(s,u);u.skillPulse+=COMBAT_CONFIG.skills.hunterInterval;}
            }
            else if(before>1&&u.skillTime<=1)castSkillPulse(s,u);
            continue;
        }
        if (u.ready > 0)
            continue;
        if(u.intent==='extract'){u.intent=null;u.path=[];u.destination=null}
        if(u.team==='enemy'&&u.path.length&&s.barricades.some(b=>same(b,u.path[0]))&&dist(u.pos,u.path[0])<=1){
            const barrier=u.path[0],key=barrier.x+','+barrier.y;
            u.attackPending=undefined;u.attackTimer=Math.max(0,u.attackTimer-dt);
            if(u.attackTimer<=0){
                const hp=(s.barrierHp?.[key]??COMBAT_CONFIG.barrierHp)-weapon(u).damage;
                (s.barrierHp??={})[key]=hp;u.attackTimer=u.attackPeriod;u.attackFlash=.2;
                s.effects.push({id:s.nextId++,from:copy(u.pos),to:copy(barrier),color:'#c66b58',remaining:.2,kind:'shot',sourceId:u.id,asset:u.asset,action:'attack'});
                if(hp<=0){s.barricades=s.barricades.filter(b=>!same(b,barrier));delete s.barrierHp[key];note(s,'路障已被敌人摧毁')}
            }
            continue;
        }
        if (u.team === 'enemy' && (!u.path.length || !walkable(s, u.path[0])) && !same(u.pos, s.goal)) {
            const candidates = u.route.map((p, i) => ({ p, i })).filter(v => v.i >= u.routeIndex && walkable(s, v.p)&&tile(s,v.p)?.layer===0).sort((a, b) => dist(a.p, u.pos) - dist(b.p, u.pos));
            const reconnect = candidates.find(v => same(v.p, u.pos) || enemyPathTo(s, u.pos, v.p).length);
            if (reconnect) {
                u.path = [...enemyPathTo(s, u.pos, reconnect.p), ...u.route.slice(reconnect.i + 1).filter(p=>tile(s,p)?.layer===0).map(copy)];
                u.routeIndex = reconnect.i;
            }
            else
                u.path = enemyPathTo(s, u.pos, s.goal);
            u.intent = 'move';
            u.destination = copy(s.goal);
        }
        settleIntent(s, u);
        if (!active(u))
            continue;
        const enemies = s.units.filter(t => t.team !== u.team && active(t));
        let blocked = false;
        if (u.team === 'ally') {
            blocked = u.path.length > 0 && enemies.some(t => same(t.pos, u.path[0]) || same(t.pos, u.pos));
        }
        else {
            const blockers = enemies.filter(a => a.ready <= 0 && dist(a.pos, u.pos) <= 1 && tile(s, a.pos)?.layer === tile(s, u.pos)?.layer);
            blocked = blockers.some(a => s.units.filter(e => e.team === 'enemy' && active(e) && dist(e.pos, a.pos) <= 1).sort((a, b) => a.id.localeCompare(b.id)).slice(0, a.block).includes(u));
        }
        if (u.path.length && !blocked) {
            let next = u.path[0];
            if (!walkable(s, next)||u.team==='enemy'&&tile(s,next)?.layer!==0) {
                u.path = u.team==='enemy'?enemyPathTo(s,u.pos,u.destination||s.goal):pathTo(s, u.pos, u.destination || s.goal);
                next = u.path[0];
            }
            if (next) {
                const origin=u.moveFrom||copy(u.pos);u.moveFrom=origin;
                const dx=next.x-origin.x,dy=next.y-origin.y;
                u.facing=Math.abs(dx)>=Math.abs(dy)?(dx<0?'west':'east'):(dy<0?'north':'south');
                const cross = tile(s, next)?.layer !== tile(s, origin)?.layer;
                u.transition = cross ? .75 : 0;
                u.moveProgress += cross?dt/.75:dt*u.speed*weightProfile(u).move/Math.max(1,Math.hypot(next.x-origin.x,next.y-origin.y));
                u.drawPos = { x: origin.x + (next.x - origin.x) * Math.min(1, u.moveProgress), y: origin.y + (next.y - origin.y) * Math.min(1, u.moveProgress) };
                if(!cross&&u.moveProgress>=.5)u.pos=copy(next);
                if (u.moveProgress >= 1) {
                    u.pos = copy(next);
                    u.drawPos = copy(next);
                    u.path.shift();
                    if (u.team === 'enemy') {
                        const idx = u.route.findIndex((p, i) => i >= u.routeIndex && same(p, u.pos));
                        if (idx >= 0)
                            u.routeIndex = idx + 1;
                    }
                    u.moveProgress = 0;
                    u.moveFrom=undefined;
                    u.transition = 0;
                    if (u.team === 'enemy' && same(u.pos, s.goal)) {
                        s.crystalHp -= u.role === 'heavy' ? 2 : 1;
                        u.life = 'departed';
                    }
                    settleIntent(s, u);
                }
                continue;
            }
        }
        u.attackTimer = Math.max(0, u.attackTimer - dt);
        if(u.attackPending){
            u.attackPending.remaining-=dt;
            if(u.attackPending.remaining<=0){
                const pending=u.attackPending;u.attackPending=undefined;
                const target=s.units.find(t=>t.id===pending.targetId);
                if(target&&canHit(s,u,target,pending.facing)){
                    const targets=weapon(u).width>0?enemies.filter(t=>canHit(s,u,t,pending.facing)):[target];
                    releaseAttack(s,u,targets);
                }
            }
            continue;
        }
        const nearest = (d: Direction) => Math.min(...enemies.filter(t => canHit(s, u, t, d)).map(t => dist(t.pos, u.pos)));
        const ordered = [u.defaultFacing, ...DIRS.filter(d => d !== u.defaultFacing).sort((a, b) => nearest(a) - nearest(b))];
        let targets: Unit[] = [];
        let attackFacing=u.defaultFacing;
        for (const d of ordered) {
            targets = enemies.filter(t => canHit(s, u, t, d)).sort((a, b) => dist(a.pos, u.pos) - dist(b.pos, u.pos) || a.id.localeCompare(b.id));
            if (targets.length) {
                attackFacing=d;
                if (u.attackTimer<=0&&u.facing !== d) {
                    u.facing = d;
                    s.stats.autoTurns++;
                }
                break;
            }
        }
        if (!targets.length) {
            u.facing = u.defaultFacing;
            continue;
        }
        if (u.attackTimer <= 0) {
            u.facing=attackFacing;
            u.attackPending={targetId:targets[0].id,remaining:.25,facing:attackFacing};
            u.attackTimer=u.attackPeriod*(u.role==='ranger'&&u.sniperMode?COMBAT_CONFIG.skills.sniperPeriod:1)/weightProfile(u).attack;
        }
    }
    if (s.crystalHp <= 0)
        finish(s, false);
    else if (s.spawned >= s.totalEnemies && !s.units.some(u => u.team === 'enemy' && active(u)))
        finish(s, true);
    s.units=s.units.filter(u=>!(u.cloneOf&&u.life==='dead'));
    if (s.phase === 'battle' && s.autoDraw && s.fragments >= 20)
        command(s, { type: 'draw' });
}
function castSkillPulse(s:GameState,u:Unit){
    const fx={sourceId:u.id,asset:u.asset,action:'skill' as const};
    if(u.role==='fiorre'){
        const range=skillRangeTiles(s,u);
        for(const a of s.units.filter(a=>a.team===u.team&&active(a)&&range.some(p=>same(p,a.pos)))){
            a.hp=Math.min(a.maxHp,a.hp+COMBAT_CONFIG.skills.fiorreHeal);
            s.effects.push({...fx,id:s.nextId++,from:copy(u.pos),to:copy(a.pos),color:'#74b9c7',remaining:.6,kind:'heal'});
        }
        return;
    }
    const choices=DIRS.map(d=>({d,targets:s.units.filter(t=>t.team!==u.team&&active(t)&&skillRangeTiles(s,u,d).some(p=>same(p,t.pos)))}));
    const defaultChoice=choices.find(c=>c.d===u.defaultFacing&&c.targets.length);
    const chosen=defaultChoice||choices.filter(c=>c.targets.length).sort((a,b)=>Math.min(...a.targets.map(t=>dist(t.pos,u.pos)))-Math.min(...b.targets.map(t=>dist(t.pos,u.pos))))[0];
    if(!chosen)return;
    u.facing=chosen.d;u.attackFlash=.25;
    const range=skillRangeTiles(s,u,chosen.d);
    const spec:Weapon={name:'独立技能',range:0,width:0,remote:true,damage:0,durability:0,maxDurability:0,shadow:true,damageKind:'physical',subtype:'pierce'};
    const damage=COMBAT_CONFIG.skills.hunterDamage;
    for(const t of chosen.targets.filter(t=>range.some(p=>same(p,t.pos)))){applyAttackDamage(s,t,spec,damage,u);if(u.role==='hunter'&&active(t))t.statuses.push({kind:'stun',remaining:COMBAT_CONFIG.skills.hunterStun,duration:COMBAT_CONFIG.skills.hunterStun,source:u.id,name:'短暂眩晕',power:0});}
    s.effects.push({...fx,id:s.nextId++,from:copy(u.pos),to:copy(chosen.targets[0].pos),color:'#d7be81',remaining:.3,kind:u.role==='hunter'?'shot':'burst'});
}
function releaseAttack(s:GameState,u:Unit,targets:Unit[]){
    const w=weapon(u);u.attackFlash=.25;
    if(!w.shadow)w.durability=Math.max(0,w.durability-1);
    const mental=u.mental==='inspired'?COMBAT_CONFIG.mental.inspiredDamage:u.mental==='distressed'?COMBAT_CONFIG.mental.distressedDamage:1;
    const damage=w.damage*(u.role==='ranger'&&u.sniperMode?COMBAT_CONFIG.skills.sniperDamage:1)*mental*(1+u.statuses.filter(st=>st.kind==='attack').reduce((n,st)=>n+st.power,0));
    for(const t of targets){
        applyAttackDamage(s,t,w,damage,u);
        if(u.role==='guard'&&u.autoSkill!==false&&t.team==='enemy'&&active(t)){
            t.poisonMeter=(t.poisonMeter||0)+COMBAT_CONFIG.skills.poisonPerHit;
            if(t.poisonMeter>=COMBAT_CONFIG.skills.poisonThreshold){
                t.poisonMeter=0;
                for(const victim of s.units.filter(a=>a.team==='enemy'&&active(a)&&Math.hypot(a.pos.x-t.pos.x,a.pos.y-t.pos.y)<=COMBAT_CONFIG.skills.poisonRadius))applyAttackDamage(s,victim,{...w,damageKind:'arcane',subtype:'flame'},COMBAT_CONFIG.skills.poisonDamage,u);
                s.effects.push({id:s.nextId++,from:copy(t.pos),to:copy(t.pos),color:'#a9dc76',remaining:.55,kind:'burst',sourceId:u.id,asset:u.asset,action:'skill'});
            }
        }
        if(u.team==='enemy'){u.reveal=2;(s.reveals??={})[u.id+':'+t.id]=s.time+2}
    }
    s.effects.push({id:s.nextId++,from:copy(u.pos),to:copy(targets[0].pos),color:u.team==='ally'?'#c7e9e8':'#cc7075',remaining:.22,kind:'shot',sourceId:u.id,asset:u.asset,action:'attack'});
    if(w.durability<=0&&!w.shadow){u.weaponIndex=1;note(s,u.name+' 武器损坏，切换影武器')}
}
export function step(s: GameState, dt: number) { if (s.phase !== 'battle' || !Number.isFinite(dt) || dt <= 0)
    return; let remaining = Math.min(dt, 60); while (remaining > 0 && s.phase === 'battle') {
    const d = Math.min(.05, remaining);
    tick(s, d);
    remaining -= d;
} }










