# AR-07-X01 验证与交接

状态：xx 技术可玩试装；用户原创角色视觉与手感复验待定。不是第三名正式主角，也未改 AR06 用户验收状态。

## 使用
正常首页选独立探索，勾「xx（实验角色）替换猎人」，选择阿尔出发；或 http://127.0.0.1:5173/?xx=1 预勾选后出发。WASD、鼠标方向、LMB 单击/按住四段，Z 只切当前两人。RMB、Shift、E/R/T 未适配，明确提示，不借用缺失 pose。H/B/Q 仍为原队伍探索接口。

http://127.0.0.1:5173/xx-preview.html 可选择全部110原动画、暂停拖动原时间、镜像，并读源事件、ActionStage及独立SAMPLE解锁。点击恢复原角色/打开普通首页即可退出会话实验；没有账号长期写入。

## 证据与核对
- 当前原工程4.3.26只读导出，与旧3.8.99导出区分；110动画、169 bones、88 slots、default skin；原133文件SHA256核对未改变。
- 实际Spine4.3.13 Canvas运行库解析；与4.1 Blue/Yellow和原3.8 namespace隔离，真实双人页window.spine.SkeletonBinary仍存在。
- `ar07.test.ts`16逻辑＋`ar07-assets.test.ts`1白名单：独立替身、四连段、原窗口时间、同帧窗口跨窗判重、受击、移动解锁、墙、未知敌人、0.1/1/2模拟变速、Z accepted生命周期及真实离手AI主HP通过。初始RED缺适配器/白名单；GREEN后补出的浮点重复事件回归已修正。
- 最终定向9文件178项通过：xx、Hunter黄金、Al AR06、EC10逻辑、伙伴/预约/探索控制。
- 浏览器专项真实输入通过：当前骨架预览、四段held、Z、WASD实际位移、暂停冻结和释放held、blur清理、主权威受击、真实地图墙体位置测试、dispose画布0/ready=false，pageerror为空。
- 受击和墙位置验证使用显式浏览器测试fixture：调用主resolveHit施加伤害，把角色放到真实地图墙旁；不是宣称自然遭遇全流程完成。单位回归同时验证活跃遭遇敌人主HP、LOS和离手AI。不另建LabWorld。
- 原角色F01/F02/F03浏览器18项，AR06两项通过。包括原Blue逐像素方向/附件对照、单身体及两人控制。
- EC10浏览器19项：初次14通过5失败；其中加载时序失败单项复跑通过。剩余四项在只读main@ae4613c的隔离副本同样失败：S4指定非最近目标、S3 Ability defense、S7 Shift旧evasion.charges、S5自由/谨慎位移比较。两项明确仍读AR06已移除字段；S4各次失败位置不同但基准也失败；S5两版同失败。不修改旧测试、不把这些失败写成通过。基准尝试首次缺工作台依赖，补齐后才计入有效对照。

最终全量99文件1352通过/2跳过，TypeScript与Vite构建通过。Vite既有大chunk提示保留。测试生成的四个旧经济报告已恢复开工字节，未纳入提交。

## 本机可复验材料（ignored，不上传原二进制）
`work/AR-07-X01/main-playtest.webm`：真实浏览器录屏，含原预览、攻击、切人、移动、受击、墙位置及取消。
`main-pair.png`：主探索xx/Al同屏；`main-xx-al.png`：实际攻击；`main-move.png`、`main-hurt.png`、`main-wall.png`：对应步骤。
`idle1_1-0.png`、`run-0.3.png`、`atk1-0.08333333.png`、`atk1-0.2666667.png`、`atk2-0.1.png`、`atk3-0.23333333.png`、`atk4-0.06666667.png`、`atk4-0.5666666.png`、`upper_hitted_all-0.1.png`、`death-0.5.png`：原Canvas连续状态帧，非生成/重绘资源。
`native-runtime-audit.json`、`main-evidence.json`、`intake.json`：运行库/时间/原文件指纹；`baseline-results/`：旧轮盘基准失败证据。

## 保留边界
xx伤害/范围/半角来自Blue样本；AttackReady与MoveReady分别为hit_to_idle后1/2帧，原事件没有这两个门，不冒充作者确认。原四窗口模拟时钟同步源视觉；没有原Dash/霜寒/盾冲/翻滚消费者，也未补声音映射。
单rig允许水平镜像，上下方向不冒充独立背面；所有110源动画可预览，但本轮只消费待机/移动/四普攻/受击/死亡。渲染足底/尺寸与世界碰撞体分离。
加载资源不足明确报错，本地素材只经loopback固定白名单；公开代码构建不包含ignored角色素材，生产dist不能代替本机试装服务。
原Hunter黄金合同与Al代码/参数/音频未修改；局部接入主HP、accepted lifecycle和AI权限。开发细则及用户原稿不改，既有工作树保留，GitHub main任务增量发布，Gitee禁止。

用户待验：xx原创模型完整性、刀击动作与窗口解释是否合意、四段衔接/移动SAMPLE手感、镜像与比例。原事件合理解释不等于作者最终确认；xx本次不等于正式角色定稿。

发布前HEAD已由并行2DW任务推进至c10b392；检查其50个文件仅独立工作台与状态/当日日志，没有game或冻结合同变化，GitHub同为c10b392。沿当前HEAD增量提交，不回退并行任务。共享文档只追加本任务块，提交只取当前HEAD加本任务块。
