# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: world-session.spec.ts >> ordinary world leave, continue, repeat and explicit reset 1280
- Location: tests\world-session.spec.ts:33:52

# Error details

```
Error: natural route deadline
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
      - generic [ref=e31]: 06:24
      - button "音效：开" [ref=e32] [cursor=pointer]
      - button "2×" [ref=e33] [cursor=pointer]
      - button "暂停" [ref=e34] [cursor=pointer]
      - button "操作说明" [ref=e35] [cursor=pointer]: 帮助
    - status: world-1 · 暗牢 · 双人探索 · 访问 1 · 区域内
    - generic: 探索中
    - status
    - status: 篝火休息 · 恢复半数最大生命、压力−40、技能就绪与满架势；检查点已记录
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
        - paragraph [ref=e58]: 当前地图：暗牢 · 双人探索
        - button "篝火休息" [disabled] [ref=e59]
        - button "离开当前区域" [disabled] [ref=e60]
        - generic [ref=e61]: 需要可行动猎人进入出口范围
      - button "开始全新测试会话" [ref=e62] [cursor=pointer]
  - img "可见敌人出招与落点"
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {mkdirSync,writeFileSync} from 'node:fs';
  3  | const dir='../work/NR-01/browser';mkdirSync(dir,{recursive:true});test.setTimeout(600000);
  4  | type Point={x:number;y:number};
  5  | async function snapshot(page:Page){return page.evaluate(()=>{const s=(window as any).prototype.state;return {world:s.world?.id,visit:s.world?.visit,phase:s.phase,time:s.time,resources:s.economy.carried,settled:s.economy.settled,rewards:s.economy.rewards,seen:s.exploration?.memory.seen,used:s.exploration?.memory.mechanisms,units:s.units.filter((u:any)=>u.id==='hunter'||u.id==='ranger').map((u:any)=>({id:u.id,hp:u.hp,gray:u.grayHp,posture:u.posture,life:u.life,pos:u.pos,weapons:u.weapons.map((w:any)=>({name:w.name,durability:w.durability})),hunter:u.hunterCombat&&{held:u.hunterCombat.held,frost:u.hunterCombat.frost,activeCooldown:u.hunterCombat.activeCooldown,finalRecoveryUntil:u.hunterCombat.finalRecoveryUntil},al:u.alCombat&&{held:u.alCombat.held,shotHeld:u.alCombat.shotHeld,ammo:u.alCombat.ammo,rocketCd:u.alCombat.rocketCd}})),dead:s.units.filter((u:any)=>u.team==='enemy'&&u.life==='dead').map((u:any)=>u.id),kills:s.kills};});}
  6  | 
  7  | // Read-only route planning; travel and attacks are actual keyboard/mouse events.
  8  | async function route(page:Page,to:Point){return page.evaluate((to)=>{const s=(window as any).prototype.state,h=s.units.find((u:any)=>u.id==='hunter'),key=(p:Point)=>p.x+','+p.y,open=new Set(s.tiles.filter((t:any)=>!t.obstacle).map(key)),start={x:Math.round(h.pos.x),y:Math.round(h.pos.y)},end={x:Math.round(to.x),y:Math.round(to.y)},queue=[start],prev=new Map<string,Point|undefined>([[key(start),undefined]]);for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(end)){const path:Point[]=[];let q:Point|undefined=p;while(q){path.unshift(q);q=prev.get(key(q));}return path;}for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){const n={x:p.x+d.x,y:p.y+d.y};if(open.has(key(n))&&!prev.has(key(n))){prev.set(key(n),p);queue.push(n);}}}return [];},to);}
  9  | async function walk(page:Page,to:Point){
  10 |  let way=await route(page,to);expect(way.length,'reachable route').toBeGreaterThan(0);let cursor=0;const held=new Set<string>();let stagnant=0,last:Point|undefined;
  11 |  const keys=async(next:string[])=>{for(const k of [...held])if(!next.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of next)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}};
  12 |  for(let n=0;n<2200;n++){
  13 |   const data=await page.evaluate(async()=>{const {clearShot}=await import('/src/core/spatial.ts' as string),p=(window as any).prototype,s=p.state,h=s.units.find((u:any)=>u.id==='hunter'),e=s.units.filter((u:any)=>u.team==='enemy'&&u.life==='active'&&clearShot(s,h.pos,u.pos)).sort((a:any,b:any)=>Math.hypot(a.pos.x-h.pos.x,a.pos.y-h.pos.y)-Math.hypot(b.pos.x-h.pos.x,b.pos.y-h.pos.y))[0];return {pos:{...h.pos},life:h.life,hp:h.hp,enemy:e&&{id:e.id,d:Math.hypot(e.pos.x-h.pos.x,e.pos.y-h.pos.y),screen:p.project(e.pos)}};});
  14 |   if(n%30===0){console.log('real route',n,data.pos,data.hp,data.enemy?.id,data.enemy?.d);writeFileSync(dir+'/progress.json',JSON.stringify({n,data}));}
  15 |   expect(data.life,'hunter remains playable').toBe('active');
  16 |   if(data.enemy&&data.enemy.d<3.5){await keys([]);await page.mouse.move(data.enemy.screen.x,data.enemy.screen.y);if(data.enemy.d>1.65){const enemyPos=await page.evaluate(id=>{const e=(window as any).prototype.state.units.find((u:any)=>u.id===id);return {...e.pos};},data.enemy.id);const dx=enemyPos.x-data.pos.x,dy=enemyPos.y-data.pos.y;await keys([...(Math.abs(dx)>.2?[dx>0?'d':'a']:[]),...(Math.abs(dy)>.2?[dy>0?'s':'w']:[])]);}await page.mouse.down();await page.waitForTimeout(200);await page.mouse.up();await keys([]);way=await route(page,to);cursor=0;stagnant=0;continue;}
  17 |   while(cursor<way.length&&Math.hypot(way[cursor].x-data.pos.x,way[cursor].y-data.pos.y)<.3)cursor++;
  18 |   if(cursor===way.length){await keys([]);return;}
  19 |   const goal=way[cursor],dx=goal.x-data.pos.x,dy=goal.y-data.pos.y;
  20 |   const next:string[]=[];if(Math.abs(dx)>.13)next.push(dx>0?'d':'a');if(Math.abs(dy)>.13)next.push(dy>0?'s':'w');await keys(next);await page.waitForTimeout(110);
  21 |   if(last&&Math.hypot(last.x-data.pos.x,last.y-data.pos.y)<.015)stagnant++;else stagnant=0;last=data.pos;
  22 |   if(stagnant>25){await keys([]);await page.screenshot({path:dir+'/blocked.png'});throw Error('real movement blocked at '+JSON.stringify(data));}
  23 |  }
> 24 |  await keys([]);throw Error('natural route deadline');
     |                       ^ Error: natural route deadline
  25 | }
  26 | 
  27 | test('isolated xx preview and playable route remain outside the world lifecycle',async({page})=>{
  28 |  await page.goto('/xx-preview.html');await expect.poll(()=>page.evaluate(()=>!!(window as any).xxPreview?.visual.ready),{timeout:30000}).toBe(true);
  29 |  await page.goto('/?xx=1');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready),{timeout:30000}).toBe(true);
  30 |  const p=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find((u:any)=>u.id==='hunter');return p.project({x:h.pos.x+1,y:h.pos.y});});await page.mouse.move(p.x,p.y);await page.mouse.down();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').xxCombat.trace.filter((r:any)=>r.name==='accepted').length),{timeout:30000}).toBeGreaterThan(3);await page.mouse.up();await page.keyboard.press('z');expect(await page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ranger');await page.keyboard.press('z');expect(await page.evaluate(()=>(window as any).prototype.state.world??null)).toBeNull();await page.screenshot({path:dir+'/xx-isolation.png'});
  31 | });
  32 | 
  33 | for(const [width,height]of [[1440,900],[1280,720]])test(`ordinary world leave, continue, repeat and explicit reset ${width}`,async({page})=>{
  34 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await page.goto('/');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();
  35 |  await expect.poll(()=>page.evaluate(()=>['hunter','ranger'].every(id=>(window as any).prototype.scene.unitVisuals.get(id)?.reference?.ready)),{timeout:30000}).toBe(true);
  36 |  await expect(page.locator('#world-status')).toContainText('world-1');await expect(page.locator('[data-action=abandon],[data-action=new],#cards,#hand-drawer')).toHaveCount(0);
  37 |  await page.locator('#exploration-objective summary').click();await page.locator('[data-exploration-point=campfire-1]').click();await expect(page.locator('[data-exploration-point=campfire-1]')).toBeDisabled();
  38 |  await page.keyboard.press('z');await expect(page.locator('#action-strip')).toContainText('四发射击');await page.keyboard.press('z');await page.keyboard.press('f');await page.keyboard.press('Escape');await page.keyboard.down('g');await page.keyboard.press('Escape');await page.keyboard.up('g');
  39 |  const started=await snapshot(page),end=await page.evaluate(()=>(window as any).prototype.state.exploration.definition.exit);
  40 |  await page.keyboard.press('AltLeft');await walk(page,end);await page.waitForTimeout(1500);
  41 |  await expect(page.locator('[data-action=exit-exploration]')).toBeEnabled({timeout:20000});await page.keyboard.press('Space');const before=await snapshot(page);await page.screenshot({path:dir+`/before-exit-${width}.png`});
  42 |  if(!await page.locator('#exploration-objective details').evaluate((e:HTMLDetailsElement)=>e.open))await page.locator('#exploration-objective summary').click();await page.locator('[data-action=exit-exploration]').click();await expect(page.locator('[data-action=continue-world]')).toBeVisible();const outside=await snapshot(page);await page.waitForTimeout(350);expect((await snapshot(page)).time).toBe(outside.time);expect(outside.world).toBe(started.world);expect(outside.phase).toBe('world');expect(outside.resources).toEqual(before.resources);expect(outside.settled).toBeNull();expect(outside.units).toEqual(before.units.map(u=>({...u,hunter:u.hunter&&{...u.hunter,held:false},al:u.al&&{...u.al,held:false,shotHeld:false}})));
  43 |  await page.screenshot({path:dir+`/outside-${width}.png`});await page.locator('[data-action=continue-world]').click();await page.keyboard.press('Space');const back=await snapshot(page);
  44 |  expect(back.world).toBe(started.world);expect(back.visit.generation).toBe(2);expect(back.resources).toEqual(before.resources);expect(back.rewards).toEqual(before.rewards);expect(back.dead).toEqual(before.dead);expect(back.seen.length).toBeGreaterThanOrEqual(before.seen.length);expect(back.used).toEqual(before.used);expect(back.units.map(u=>u.weapons)).toEqual(before.units.map(u=>u.weapons));
  45 |  for(let i=0;i<back.units.length;i++)expect(Math.abs(back.units[i].hp-before.units[i].hp)).toBeLessThan(.25);
  46 |  if(!await page.locator('#exploration-objective details').evaluate((e:HTMLDetailsElement)=>e.open))await page.locator('#exploration-objective summary').click();await expect(page.locator('[data-exploration-point=campfire-1]')).toBeDisabled();await page.screenshot({path:dir+`/continued-${width}.png`});
  47 |  await page.locator('[data-action=restart-world]').click();await expect(page.locator('#economy-confirm')).toContainText('这不是继续');await page.locator('[data-action=cancel-economic]').click();expect((await snapshot(page)).world).toBe(started.world);
  48 |  await page.locator('[data-action=restart-world]').click();await page.locator('[data-action=confirm-economic]').click();await expect(page.locator('[data-action=carry]')).toBeVisible();await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();expect((await snapshot(page)).world).toBe('world-2');await page.locator('#exploration-objective summary').click();await expect(page.locator('[data-exploration-point=campfire-1]')).toBeEnabled();
  49 |  writeFileSync(dir+`/lifecycle-${width}.json`,JSON.stringify({input:'real mouse/keyboard only; state reads only',started,before,outside,back,errors},null,2));expect(errors).toEqual([]);
  50 | });
  51 | 
```