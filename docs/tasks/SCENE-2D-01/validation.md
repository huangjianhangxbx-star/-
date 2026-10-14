# SCENE-2D-01 验证记录

2026-10-14；GitHub基准 d7aec8f；独立 scene2d-validation 工作树。按批准计划采用 writing-plans、test-driven-development、frontend-design；没有需要变更范围的疑问，未启动额外访谈。最新聊天读取只返回内容引用占位，未将不可见正文当作已读取依据；实施以用户提供的完整 v0.1 计划为准。

## 来源与比例

仅三张用户地砖和指定锚点对应的同源47墙族。地砖实际路径少一层计划中重复的“1画画”；原件都是400×400。源身份、47完整规则、Pivot/PPU、原件SHA与本机PNG位于 ignored `work/SCENE-2D-01/source-manifest.json`、`assets/manifest.json`；不提交可逆原作资源或完整私有表。50件原始文件末次SHA复核：改变0。

同源条件八邻表48槽，1–47可达、0不使用；消费者lookup一致。源Y向上与模拟Y向下明确转换，转角仅在两邻边存在时保留。47联系表、地砖横纵各9种有序拼接已查看：灰色石块与边界接缝保留，部分组合仍显重复/边界线差异，不称无缝。未旋转、镜像、补边、抠黑；墙原图不透明黑区完整保留。

地砖显示4U（参考100PPU），逻辑格1U，确定性混排种子91。墙宽341px、PPU341、Pivot(0.5,0.3400000036)，典型高512px；按每片源尺寸/Pivot放置，统一比例1。**墙额外显示偏移 anchorY=-0.45U 是本轮实验默认值**，不改源Pivot或碰撞；可复位和调节。角色采用已有4.1 Spine，512画布显示4U，脚点对齐；不改骨架、黄金动作或实体半径。

## 四种边界

同一墙集合分别产生：1U实体格（原空间/导航）、脚底排序（视觉覆盖）、原 clearShot（玩法LOS）、有限24步二维光线采样遮挡（视觉光）。显示比例与偏移只改变图像边界，不扩大实体碰撞，不把被遮住等同于不可命中。红线=碰撞、青线=图片边界、黄线=排序基线，网格独立开关。

## 渲染迁移对照

|已有参照|本轮实际实现|限制|
|---|---|---|
|FoundationV2区域冷暖、地面清楚、材质分家|Source原图单次sRGB输出；MaterialLight轻冷暖/对比、角色保护|用户原PNG没有语义Normal/Data/Mask；没有反推法线，不能称完整材质系统|
|AtmosphereV21 D4暖灯、门墙截光、连续暗部|世界坐标局部灯、墙mask射线、噪声消光/暖散射、非圆形暗边|二维近似；没有3D体积、原SDF房间体系或实际高度场；D4本身主观Partial|
|OutdoorV23 Balanced/Light克制亮部、空气层次|独立MaterialLight、空气开关、轻调色|只有候选方向，不称URP画面精确移植；源版本也有待用户验收项|
|Bloom/Dust|四邻亮像素溢出、世界位置程序粒点|不是URP全屏Bloom/原粒子；无DOF、SSAO或额外接触阴影pass，保留原画暗部|

## 测试与实拍

TDD先失败后实现：确定性混排、条件转角/47映射缺项拒绝、源尺寸/Pivot/排序、真实碰撞和LOS；服务精确别名白名单/仅loopback/拒绝穿越。最终四文件22测试通过：scene2d、scene2d-assets、world-session、ar05-golden。TypeScript通过，Vite生产构建通过（已有大chunk告警；未为本轮做广泛拆包）。

额外旧 path-aim 16项失败：fixture仍选已退场ines，在设置该角色pos时即抛错，尚未进入导航断言；测试与engine文件相对基准零差异。本轮不扩展去修旧fixture，不报告全部测试通过。实际F绕行由下面浏览器故事验证。

Playwright最终2/2通过，36.2秒：2D真实键鼠故事28.8秒、默认3D黄金入口6.2秒。猎人W向墙走停于y=8.6801；F选后侧目标实际绕过缺口，抵达x≈10/y=7.3167；同机位Source/Dungeon墙前、墙后两组截图看到前侧身体在墙前、后侧身体受墙覆盖。Z切阿尔，调参不改双方HP/主武器身份/CD，复位、JSON导出、合法退出/继续世界重建两角色均通过。默认入口仍BattleScene，无2D面板。

私人证据位于本机 `work/SCENE-2D-01/`：`browser-final.log`、`story.json`、`front-Source.png`/`front-DungeonLight.png`、`behind-Source.png`/`behind-DungeonLight.png`、`debug.png`、`exported-look.json`。不提交截图。本轮修复面板收起后焦点仍吞F的实际问题；最终页面异常数组为空，favicon 404不当作素材错误或声称整台控制台零错误。

粗性能：Chromium SwiftShader软件渲染，1440×900/DPR1；墙前88calls/16GPU纹理/1geometry/56materials，墙后109/17/1/56；调参debug99/17/5/56，继续世界107/17/5/56（debug几何缓存保留，材质不增长）。180帧窗口墙前median82.4ms/P95 173.9ms，墙后84.9/145.9ms，最终继续132.1/247.8ms。软件环境速度偏低，不能据此宣称硬件性能达标。共享纹理/几何、调试线合批，但地面仍单片draw，无目标设备验收。

## 结论

技术入口/来源/分层/交互通过；比例、遮挡偏移、拼接观感、暗部可读性和实际设备流畅度待用户体验Gate。此处停止继续美术迭代。Unity工程、两个禁读脚本目录、原图、开发细则及用户维护区均未写入；默认技能框架/黄金参数未改。
