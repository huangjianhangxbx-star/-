# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cl01b.spec.ts >> old held inputs and real blur preserve modal ownership at 1440
- Location: tests\cl01b.spec.ts:8:52

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('#cards,#hand-drawer,#selected-panel,#build-panel,#world-rescues,#card-chain,#dash-directions,[data-clone]')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('#cards,#hand-drawer,#selected-panel,#build-panel,#world-rescues,#card-chain,#dash-directions,[data-clone]') with timeout 5000ms
  - waiting for locator('#cards,#hand-drawer,#selected-panel,#build-panel,#world-rescues,#card-chain,#dash-directions,[data-clone]')
    11 × locator resolved to 1 element
       - unexpected value "1"

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
      - generic [ref=e31]: 00:00
      - button "音效：开" [ref=e32] [cursor=pointer]
      - button "1×" [ref=e33] [cursor=pointer]
      - button "继续" [ref=e34] [cursor=pointer]
      - button "操作说明" [ref=e35] [cursor=pointer]: 帮助
    - status: world-1 · 暗牢 · 双人探索 · 访问 1 · 区域内
    - generic: 探索中
    - status: 已暂停
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
  - img "可见敌人出招与落点"
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {mkdirSync,writeFileSync} from 'node:fs';
  3  | const dir='../work/CL-01B-A/after/browser';mkdirSync(dir,{recursive:true});test.setTimeout(120000);
  4  | test('retired Tower route offers a clear return and never boots a game fixture',async({page})=>{
  5  |  await page.goto('/?legacy=1');await expect(page.getByRole('heading',{name:'旧塔防入口已退休'})).toBeVisible();await expect(page.locator('[data-journey=tower],#cards,#build-panel,canvas')).toHaveCount(0);
  6  |  expect(await page.evaluate(()=>!!(window as any).prototype)).toBe(false);await page.getByRole('link',{name:'进入正式探索'}).click();await expect(page.getByRole('button',{name:'开始探索',exact:true})).toBeVisible();
  7  | });
  8  | for(const [width,height]of [[1440,900],[1280,720]])test(`old held inputs and real blur preserve modal ownership at ${width}`,async({page})=>{
  9  |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await page.goto('/');
  10 |  await page.locator('.test-resources summary').click();await page.locator('#carry-gold').fill('1');await page.locator('[data-companion=ranger]').click();await expect(page.locator('[data-action=carry]')).toBeDisabled();await page.locator('#carry-gold').fill('0');await page.locator('[data-action=carry]').click();
  11 |  await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready),{timeout:30000}).toBe(true);await page.keyboard.press('Space');
  12 |  const read=()=>page.evaluate(()=>{const s=(window as any).prototype.state;return {world:s.world.id,time:s.time,resources:s.economy.carried,cards:s.cards,pending:s.economy.pending,party:s.units.filter((u:any)=>u.team==='ally').map((u:any)=>({id:u.id,life:u.life,hp:u.hp,posture:u.posture,shadow:u.shadowResident})),controlled:s.controlledBodyId,tactics:s.partyTactics};});
  13 |  const before=await read();for(const k of ['q','h','b','Tab','c','v','1','2','3','4']){await page.keyboard.down(k);await page.keyboard.down(k);await page.waitForTimeout(40);await page.keyboard.up(k);}expect(await read()).toEqual(before);
> 14 |  await expect(page.locator('#cards,#hand-drawer,#selected-panel,#build-panel,#world-rescues,#card-chain,#dash-directions,[data-clone]')).toHaveCount(0);
     |                                                                                                                                          ^ Error: expect(locator).toHaveCount(expected) failed
  15 |  await page.locator('[data-action=help]').first().click();await page.keyboard.down('h');const other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();await page.bringToFront();await other.close();await page.keyboard.up('h');expect(await read()).toEqual(before);
  16 |  await page.locator('[data-action=help]').first().click();await page.keyboard.press('Space');await page.keyboard.press('z');await expect(page.locator('#action-strip')).toContainText('四发射击');await page.keyboard.press('z');await page.keyboard.press('f');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.explorationControl?.aim?.kind)).toBe('path');await page.keyboard.press('Escape');await page.keyboard.down('g');await expect(page.locator('#tactic-wheel')).toBeVisible();await page.keyboard.press('Escape');await page.keyboard.up('g');
  17 |  await page.screenshot({path:dir+`/input-${width}.png`});writeFileSync(dir+`/input-${width}.json`,JSON.stringify({before,errors},null,2));expect(errors).toEqual([]);
  18 | });
  19 | 
```