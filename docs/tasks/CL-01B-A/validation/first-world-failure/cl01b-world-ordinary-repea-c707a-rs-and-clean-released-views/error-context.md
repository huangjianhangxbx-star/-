# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cl01b-world.spec.ts >> ordinary repeated fresh worlds bound native GPU owners and clean released views
- Location: tests\cl01b-world.spec.ts:29:1

# Error details

```
Error: real movement blocked at {"pos":{"x":27.150042712474324,"y":8.882842712474663},"life":"active","hp":360,"enemy":{"id":"explore-1","d":4.957471916652014,"screen":{"x":1333.1898005615055,"y":528.3011052858658}}}
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic "战场" [ref=e2]:
    - generic "斜视角战场：石板地面、双层高台与角色" [ref=e3]
  - generic: 阿尔 · 自由行动 G 战术
  - generic:
    - region "双人状态" [ref=e4]:
      - article [ref=e5]:
        - generic [ref=e7]:
          - generic [ref=e8]:
            - generic [ref=e9]: 猎人
            - generic [ref=e10]: ◆ 主控
          - text: 生命 360/360 · 虚血 0 · 架势 90/90
      - article [ref=e17]:
        - generic [ref=e19]:
          - generic [ref=e20]:
            - generic [ref=e21]: 阿尔
            - generic [ref=e22]: ◇ 同行
          - text: 生命 260/260 · 虚血 0 · 架势 70/70
          - generic [ref=e28]: 自由
      - paragraph [ref=e29]: Z 切人 · G 战术 · F 选路
    - navigation "设置与帮助" [ref=e30]:
      - generic [ref=e31]: 00:05
      - button "音效：开" [ref=e32] [cursor=pointer]
      - button "1×" [ref=e33] [cursor=pointer]
      - button "暂停" [ref=e34] [cursor=pointer]
      - button "操作说明" [ref=e35] [cursor=pointer]: 帮助
    - status: world-2 · 暗牢 · 双人探索 · 访问 1 · 区域内
    - generic: 交战中
    - status
    - status: 当前世界已建立 · 合法离开后可继续，刷新不存档
    - region "当前主控动作" [ref=e36]:
      - generic [ref=e37]:
        - text: 猎人
        - generic [ref=e38]: 当前主控
      - generic [ref=e39]:
        - generic [ref=e40]: LMB
        - generic [ref=e41]: 四段普攻
        - generic [ref=e42]: 就绪
      - generic [ref=e43]:
        - generic [ref=e44]: RMB
        - generic [ref=e45]: 方向格挡
        - generic [ref=e46]: 就绪
      - generic [ref=e47]:
        - generic [ref=e48]: Shift
        - generic [ref=e49]: 闪避
        - generic [ref=e50]: 就绪 · 2/2
      - generic [ref=e51]:
        - generic [ref=e52]: E
        - generic [ref=e53]: 盾冲
        - generic [ref=e54]: 就绪
    - generic [ref=e55]:
      - group [ref=e56]:
        - generic "探索目标 · 抵达出口" [ref=e57] [cursor=pointer]
      - button "开始全新测试会话" [ref=e58] [cursor=pointer]
  - generic:
    - generic "敌人发现目标": "!"
  - img "可见敌人出招与落点"
```

# Test source

```ts
  1  | import {expect,type Page} from '@playwright/test';
  2  | import {mkdirSync,writeFileSync} from 'node:fs';
  3  | const dir='../work/CL-01B-A/'+(process.env.CL_PHASE??'after')+'/browser';mkdirSync(dir,{recursive:true});
  4  | type Point={x:number;y:number};
  5  | export async function snapshot(page:Page){return page.evaluate(()=>{const s=(window as any).prototype.state;return {world:s.world?.id,visit:s.world?.visit,phase:s.phase,time:s.time,resources:s.economy.carried,settled:s.economy.settled,rewards:s.economy.rewards,seen:s.exploration?.memory.seen,used:s.exploration?.memory.mechanisms,units:s.units.filter((u:any)=>u.id==='hunter'||u.id==='ranger').map((u:any)=>({id:u.id,hp:u.hp,gray:u.grayHp,posture:u.posture,life:u.life,pos:u.pos,weapons:u.weapons.map((w:any)=>({name:w.name,durability:w.durability})),hunter:u.hunterCombat&&{held:u.hunterCombat.held,frost:u.hunterCombat.frost,activeCooldown:u.hunterCombat.activeCooldown,finalRecoveryUntil:u.hunterCombat.finalRecoveryUntil},al:u.alCombat&&{held:u.alCombat.held,shotHeld:u.alCombat.shotHeld,ammo:u.alCombat.ammo,rocketCd:u.alCombat.rocketCd}})),dead:s.units.filter((u:any)=>u.team==='enemy'&&u.life==='dead').map((u:any)=>u.id),kills:s.kills};});}
  6  | 
  7  | // Read-only route planning; travel and attacks are actual keyboard/mouse events.
  8  | export async function route(page:Page,to:Point){return page.evaluate((to)=>{const s=(window as any).prototype.state,h=s.units.find((u:any)=>u.id==='hunter'),key=(p:Point)=>p.x+','+p.y,open=new Set(s.tiles.filter((t:any)=>!t.obstacle).map(key)),start={x:Math.round(h.pos.x),y:Math.round(h.pos.y)},end={x:Math.round(to.x),y:Math.round(to.y)},queue=[start],prev=new Map<string,Point|undefined>([[key(start),undefined]]);for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(end)){const path:Point[]=[];let q:Point|undefined=p;while(q){path.unshift(q);q=prev.get(key(q));}return path;}for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){const n={x:p.x+d.x,y:p.y+d.y};if(open.has(key(n))&&!prev.has(key(n))){prev.set(key(n),p);queue.push(n);}}}return [];},to);}
  9  | export async function walk(page:Page,to:Point,label?:string){
  10 |  let captured=false;
  11 |  let way=await route(page,to);expect(way.length,'reachable route').toBeGreaterThan(0);let cursor=0;const held=new Set<string>();let stagnant=0,last:Point|undefined;
  12 |  const keys=async(next:string[])=>{for(const k of [...held])if(!next.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of next)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}};
  13 |  for(let n=0;n<2200;n++){
  14 |   const data=await page.evaluate(async()=>{const {clearShot}=await import('/src/core/spatial.ts' as string),p=(window as any).prototype,s=p.state,h=s.units.find((u:any)=>u.id==='hunter'),e=s.units.filter((u:any)=>u.team==='enemy'&&u.life==='active'&&clearShot(s,h.pos,u.pos)).sort((a:any,b:any)=>Math.hypot(a.pos.x-h.pos.x,a.pos.y-h.pos.y)-Math.hypot(b.pos.x-h.pos.x,b.pos.y-h.pos.y))[0];return {pos:{...h.pos},life:h.life,hp:h.hp,enemy:e&&{id:e.id,d:Math.hypot(e.pos.x-h.pos.x,e.pos.y-h.pos.y),screen:p.project(e.pos)}};});
  15 |   if(n%30===0){console.log('real route',n,data.pos,data.hp,data.enemy?.id,data.enemy?.d);writeFileSync(dir+'/progress.json',JSON.stringify({n,data}));}
  16 |   expect(data.life,'hunter remains playable').toBe('active');
  17 |   if(data.enemy&&data.enemy.d<3.5){await keys([]);if(label&&!captured){await page.waitForTimeout(300);await page.screenshot({path:dir+`/live-${label}.png`});captured=true;}await page.mouse.move(data.enemy.screen.x,data.enemy.screen.y);if(data.enemy.d>1.65){const enemyPos=await page.evaluate(id=>{const e=(window as any).prototype.state.units.find((u:any)=>u.id===id);return {...e.pos};},data.enemy.id);const dx=enemyPos.x-data.pos.x,dy=enemyPos.y-data.pos.y;await keys([...(Math.abs(dx)>.2?[dx>0?'d':'a']:[]),...(Math.abs(dy)>.2?[dy>0?'s':'w']:[])]);}await page.mouse.down();await page.waitForTimeout(200);await page.mouse.up();await keys([]);way=await route(page,to);cursor=0;stagnant=0;continue;}
  18 |   while(cursor<way.length&&Math.hypot(way[cursor].x-data.pos.x,way[cursor].y-data.pos.y)<.3)cursor++;
  19 |   if(cursor===way.length){await keys([]);return;}
  20 |   const goal=way[cursor],dx=goal.x-data.pos.x,dy=goal.y-data.pos.y;
  21 |   const next:string[]=[];if(Math.abs(dx)>.13)next.push(dx>0?'d':'a');if(Math.abs(dy)>.13)next.push(dy>0?'s':'w');await keys(next);await page.waitForTimeout(110);
  22 |   if(last&&Math.hypot(last.x-data.pos.x,last.y-data.pos.y)<.015)stagnant++;else stagnant=0;last=data.pos;
> 23 |   if(stagnant>25){await keys([]);await page.screenshot({path:dir+'/blocked.png'});throw Error('real movement blocked at '+JSON.stringify(data));}
     |                                                                                         ^ Error: real movement blocked at {"pos":{"x":27.150042712474324,"y":8.882842712474663},"life":"active","hp":360,"enemy":{"id":"explore-1","d":4.957471916652014,"screen":{"x":1333.1898005615055,"y":528.3011052858658}}}
  24 |  }
  25 |  await keys([]);throw Error('natural route deadline');
  26 | }
  27 | 
```