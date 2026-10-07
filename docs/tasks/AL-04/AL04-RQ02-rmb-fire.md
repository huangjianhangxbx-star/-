# AL04-RQ02｜小黄右键：默认炮弹与代表连射负载

2026-10-07；Build 24935935。范围只为 AL04-F01 的右键静态消费者、必要原音效。只写本 RQ 与 work/AL-04-F01；没有改生产代码、父研究、开发细则、人工区或原作，没有原作 OBS。

## 核心结论

原作把 **右键响应/弹夹支付** 与 **该次响应的实际弹种及子射击** 分开。不能把一种 SAMPLE 单发黄点当成所有右键攻击，也不能把原 r1 整段 .5333s 当作所有弹種的 cadence。

默认无改弹装填为炮弹：小黄.ReloadEnd → 刷新弹匣结算(true,上弹数量,"炮弹") → Repeat → 一次性替换/完成后改弹夹 → 提交装弹列表。get_子弹位置=min(list.Count,容量*2)-1，通常从末项选择。原 Cannonball 表炮弹→小黄远程；火箭弹→小黄远程火箭弹。其余5条只做身份映射，不展开成长或实际获取。

枪找子弹.Start 对 Cannonball.skill CreateSkill，按 Cannonball.id 存字典，并标记 isRightMouse。技能释放时按所选弹种取实际 Skill Cast。枪.Start 订阅技能射击时；此节点按 affectData[0]（两种所选都为1）RemoveAt(get_子弹位置)，刷新弹夹 UI。因此一个响应中的多个子弹不应逐粒扣弹，Cast 本身也不是已证支付节点。

| 所选负载 | 默认炮弹 | 代表连射火箭弹 |
|---|---|---|
| 实际 Skill | 小黄远程 | 小黄远程火箭弹 |
| 基础伤害 | 32 | 24 |
| 原动画 | r1 | r2连射 |
| Hit / End | .0333 / .4 | .0667 / .3333 |
| Bullet | 铁弹子弹 | 小黄加特林子弹 |
| 方式 | 直线炮弹，speed30/range5.6 | 无轨迹、射线、range8/life.1 |
| 子射击 | Combo1 / interval0 | Combo3 / interval.1 |
| 角度 | fan shootData5，但Combo1为中心；另randomDeflection±4度 | randomangle shootData6（±6度候选与前次角约束） |
| 真实声音挂点 | effectAttack=铁弹开火 | 每粒 effectFire=加特林开火 |

默认扇形散开的 shootData5 是角度步长，不是5发。实际 fan 角度为 `(data+修正)*(index-combo/2+.5)` 加 keyword 随机量；Combo1 中心角0。ShootBullet 还在非Unit目标时施加 Bullet.randomDeflection。

连发 async 缓存 SkillIndex/总数，立即发粒→await间隔（shootInterval+属性连发间隔）→核对 castingSkill/SkillIndex，keyword“技能结束时停止连发”存在时在技能失效后停止。中性属性采用预计 .0667/.1667/.2667 三粒，不能称“原作一秒十发”；用户举一秒散射是功能形态说明而非固定配置。r2 的 End .3333 比三粒结束晚。随机角度消费者实际生成3个候选、OrderBy回调及与前次角比较；简单均匀±6若用于原型须标有限 SAMPLE，不冒称完全复刻。

主动.计算动画速度：零CD左右键读取属性攻速；Hero.BasicAtkSpeed只乘左键，不乘右键；随后乘动画速度及Context速度。没有原动态构筑/OBS，因此不能把原表 clip 时点直接当所有情况下的墙钟发射间隔。父执行者已经通过正常鼠标记录933878d每响应约.4s，是原型基线，不是原作OBS。

## 换弹边界

ReloadEnter 读 config上弹时间=.8，播放 _reload/_reloadMove、Cast小黄上弹特效。ReloadUpdate 按 Time.deltaTime*上弹速度扣计时，到0调用ReloadEnd完成装夹和完成特效。原 .8 是配置，最终速度受属性影响。

OnCast/DashEnter 的 ReloadPause 已证只是 ClearTrack(1) 的视觉轨道。所读 LogicUpdate 只要换弹中就继续 ReloadUpdate；不能因名称Pause就声称换弹数值计时在攻击/翻滚时停止。旧用户已批准的原型暂停规则暂保留为 SAMPLE，由主执行者对范围变更处理；本研究不静默改手感。移动禁止时长来自属性；原作完整动作/移动/翻滚/取消动态交互和实际补夹时序未做 OBS。

## 真实原音效提取及映射

catalog 精确地址→单依赖bundle→选定 GameObject组件→AudioSource.m_audioClip→同bundle AudioClip.samples，记录在 audio-extraction.json，包含bundle/pathID/clipName/SHA256/时长。使用源码Effect绑定，不靠名字猜。

| 原 effect | 原 clip | 本地导出 | 已证源事件 |
|---|---|---|---|
| 铁弹开火 | 小黄右键 | cannon-fire.wav | 小黄远程.effectAttack |
| 加特林开火 | 加特林开火 | gatling-fire.wav | 小黄远程火箭弹.effectFire，ShootBullet每粒创建 |
| 小黄射击命中远 | 小黄右键命中 | cannon-hit.wav | 小黄远程.effectHit |
| 上弹特效 | 小黄上弹1 | reload-start.wav | ReloadEnter→小黄上弹特效.effectCast |
| 上弹完成特效 | 小黄上弹 | reload-complete.wav | ReloadEnd成功→小黄上弹完成特效.effectCast |

以上 AudioSource enabled1、PlayOnAwake真、pitch1、volume1。两个反例只记录不用：“加特林开火音效”空特效实际clip为锤子挥；“加特林命中”虽clip枪但AudioSource enabled0，不可据clip存在声称实际会播放。没有发现/确认空枪音，不新增假源。

音效在 `work/AL-04-F01/assets/audio/`，原素材本机验证，发布由主任务有效授权处理；本研究没有提交上传。源Unity粒子未完整移植、没有把源粒子当2DCanvas原样还原；最小tracer/muzzle保留计划允许 SAMPLE。

## 证据与保护

AL04-RQ02-evidence.json 汇总sourceSHA、每个方法token/path、全部source文件hash及未知项。已保存有限26静态方法（21业务/5生成；其中部分为RQ01已有方法复读，不声称26全是新证据）。Assembly仅PEReader只读，不加载原程序集执行。

原OBS=null、原实际结果=null，原held/down/up是否自动连续、松开是否取消已启动子射击、3夹实测间隔、最终属性、原碰撞宽度仍未知。未启动全RQ、其他弹种技能/成长/装备、第二敌人或第二角色扩展。默认与代表连射选择是源配置事实，原型如何提供对照入口/取消规则须沿本轮用户批准。
