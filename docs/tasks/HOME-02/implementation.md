# HOME-02 家园素材与场景落地

2026-10-18。基准及接手fetch后github/main均34c0f3a；已有未跟踪game/docs保留并排除。ZIP内9个列明文件SHA256验证通过。聊天链接重定向登录，未读到较新正文；依据用户本轮请求、计划包和现行工程记录执行。原稿、开发细则、用户维护区不改；只发布GitHub main，不同步Gitee。

已读适用AGENTS、基础细则v2.2、HOME-02专项01–05/模板及HOME-01/MAP-02约束。使用brainstorming、writing-plans、imagegen、test-driven-development；计划04要求独立监工，home02_review只读产品代码/素材并独立写评审。无需改变关键约束，未启动grill询问。

## 交付
- G0生产板R1 7.3，纠正后R2 8.6通过，原评分保留。
- G1实际地板/桌/书柜小样经独立实看后完成18张PNG。逐项最终哈希、原稿哈希、透明边界、提示规格和加工见asset-work-order.json。提示记录是生产规格整理，不伪称逐字工具转录；工具未提供seed。
- G2正式101使用独立地面及17家具/作物实例，保留原47墙族、16×12地图、门、居民和组队入口。原R2不是整图背景。
- G3八个anchor-only活动点对两角色真实半径可达。F10→家园空间诊断显示底座、足点、站位、方向、实例/修订号，不执行生活AI。
- G4定向逻辑、浏览器键盘绕桌、正常往返组队、双向队友攻击、素材故障和三次往返组合验证；详见validation.md。最终独立评分另存，不由实现者预填。

无生产、仓库、烹饪、种植、离线生活、存档或居民战斗，新家具不注册F交互。用户审美仍待试玩。

## 架构
public/assets/home02/manifest.json定义18项图片尺寸、256PPU、像素足点、路径。core/home-layout.ts定义17实例、稳定ID、位置、统一缩放、局部底座及8活动点。scene-layout.ts纯空间查询由spatial.ts接入现有移动/导航/视线/弹道。低桌只阻身体，书柜/灶台另阻视线/弹道/光；家具不写建筑obstacle，不长新墙。

足点是图片底部落地线，底座向北延伸，按足点排序。图片等比；角色可见高度猎人1.203U、芙蕾茜娅1.273U。椅子0.75、作物0.65、篮子0.8为显式统一缩放。地板固定坐标选择三变体，B/C共享A外12px并羽化到24px，分别生成的内部保留。

activity-anchors.ts返回map实例/revision、owner、tags、approach、facing、capacity=1、anchor-only及可达性；只读，无调度器。rest/store站位在家具侧面，避免南墙遮人。

home-assets.ts每候选独立持有资源；必需项/锚点预检→18图准备→纹理上传/编译→现有首帧验证→激活。Scene2DView准备序号拦截旧结果，失败保留旧图可重试，dispose后迟到纹理清理。切出家具不显示，缓存随视图生命周期释放。住宅镜头居中；其他地图仍原跟随。南墙外不铺木地板。

箱商人仅住宅初始位置移至入口侧，库存不重置；旅行落点查目标地图布局。受光沿原SRGB管线，家具免除所在格自遮挡；默认仍Source，受光图明确为临时参数检查。

## 官方技术参考
- [Tiled对象层](https://doc.mapeditor.org/en/stable/manual/objects/)：图像和对象元数据分离。
- [Three颜色管理](https://threejs.org/manual/pages/color-management.html)：SRGB颜色纹理。
- [Epic Smart Objects](https://dev.epicgames.com/documentation/en-us/unreal-engine/smart-objects-in-unreal-engine)：带标签站位与行为执行分离。未安装这些框架。

只分发本轮生成后处理PNG，原作参考只在本机核验。概念与正常HUD实机对照见evidence/concept-to-runtime.png。
