# INV-01B B级验证

## 接手与方法
根AGENTS及开发细则v2.2（与上轮完整读取SHA一致）适用，INV01A合同/验证/交接、ITEMY/UI01C/SK02合同与对账核对。game下无新增AGENTS。真实读取brainstorming/writing-plans/TDD/frontend-design，已有计划直接执行；未调用不存在的executing-plans、没有新美术生产或Unity技能。完整本轮计划及来源SHA256在reference/。

B级原因：触及世界共享库存、输入所有权及HUD原位接收。只跑相关小集，不扩全部历史/RQ。纯核心夹具、自然键鼠与合成事件分别记录。

## 核心和构建
核心首次6项RED缺新字段/API/路由。核心实现后INV01B/INV01A/Y瓶/World四文件34项GREEN；另补清除请求陈旧/foreign owner纯拒绝，最终四文件35项通过（INV01B7项），不累加重复次数。

覆盖合法替换/重复绑定幂等/十格同库存、未知ID/错误owner/非法数量/重复stack/过期world与visit/非正式场景/无本体/重复身份/阴影/敌方/瞄准指令纯拒绝，纯查询不修复。库存失效仍可清引用，阿尔respawning时活体猎人可整理。同世界Z/离区继续/全灭返场/合法篝火保留，确认新世界清空。绑定仅改背包引用，Y/activation/economy/装备/其它状态无差异。该生命周期使用核心操纵夹具，非完整地图自然试玩。

最终tsc、主构建、ActionLab独立构建通过；既有大chunk warning保留。ActionLab浏览器实际加载HTTP200/canvas/无pageerror，仅启动smoke，不声称重验黄金手感。

## 浏览器与几何
Edge软件WebGL，真实键鼠4条一轮4/4通过，1.2分钟；只读prototype状态与DOM观测，不注入command/HP/位置/时间。

1.1920：拖种子到阿尔，来源仍同DOM；种子同时绑1，农具覆盖阿尔并绑0，同源5/1；关闭后阿尔右键解绑，不增加action-accepted，原1/0选择与0右键清除通过。Y/装备/activation保持。
2.1280：Enter选种子→ArrowRight越过农具→“绑定到阿尔自由栏”Enter提交；模态Y/V/Z/G/Q/E/R/C/Shift/Space无时间/战斗/控制/费用穿透；真实拖农具显示合法高亮，松手覆盖，Z切阿尔仍保引用和原用户头像。
3.Esc、外部松手、实际viewport resize清理拖拽；blur分支明确使用合成DOM blur，不称真实OS跨应用失焦。均无残留绑定/攻击。
4.真实点击新测试→确认→开始世界，Al和十格归空、初始库存重建，原al-user.png保留。

实施前原位1920/1280六区＋Y＋阿尔自由槽bounds，分别与实际交互后量测完全一致。截图人工检查两档可读/无新增HUD重叠。1280面板沿旧max-height滚动，页尾可滚动；不是新增遮挡自由槽。两档资产原框未改变。

最终收尾明确其它伙伴不接阿尔控件后，仅定向重跑1920真实拖放故事；这次复测与前一轮四条分开记录，不伪称最后一次全套。日志见browser-owner-final.log。

## 失败与保护
一次浏览器脚本写入误用game/game/tests相对路径，未生成测试；修正绝对路径后UI RED实际等待不存在的阿尔接收器失败，此时两档基线已保存。保留RED失败，不将路径误用当产品缺陷。

开发细则、Y核心/篝火、黄金Hunter/Al、SK02核心/面板、原头像八个SHA256保持；共享文件按原字节前缀追加，既有dirty不混入提交。未动人工维护区/原始PPT/资源。暂无实际自由道具消费者，种子/农具绑定只是SAMPLE。未测触屏/真实OS隐藏与跨应用失焦/目标GPU性能，缺货显示只按核心与代码检查，未用状态注入冒充自然UI取证。用户布局/拖放手感Gate仍PENDING。
