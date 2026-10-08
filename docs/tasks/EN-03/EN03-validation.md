# EN03-MIX 验证与边界

## 最终技术结果

定向：7文件53项（EN01 29、EN02 10、EN03 14）通过。最终完整Vitest：106文件，1405通过、2既有skip（合计1407），69.06秒。类型通过；主和Action Lab构建通过，主构建保留已有大chunk提示。AL01/AL03、AR02/AR03、Hunter AR05、Al AR06、XX、主图、Tower/Legacy逻辑覆盖来自此全量。全量没有包含Playwright，不能称全部浏览器绿。

| 浏览器分组 | 结果 | 证据及类型 |
| --- | --- | --- |
| EN03/MIX | 4通过 | browser-final.log；实际键鼠，无HP/位置/时间注入 |
| 自然离开视线/搜索/回位 | 1通过 | navigation.log/natural-return.json；只读选现有路线，真实WASD/H |
| EN02/AR06 | 5通过 | regression-models.log；原模型、盾/击杀/404、阿尔四发装弹/主动 |
| EN01入口/方向盾/Reset/时钟 | 4通过 | regression-en01.log；真实键鼠 |
| T036 S4焦点命中 | 1通过 | regression-t036.log；旧受控程序夹具，不冒充自然MIX |
| XX原创预览 | 1通过 | regression-xx.log；真实原预览选择/镜像UI |
| T036历史选组 | 6通过、2历史失败 | history-t036.log；与EN01 legacy-known.log同两项charges字段错误 |

分组累计22通过、2历史失败，不是一次全浏览器套件运行。历史S3/S7还读已移除evasion.charges，TypeError与既有EN01日志一致；没有删除/改旧断言，没有越界调整黄金角色使其过关。新增测试文件虽匹配相关来源名，仍逐项区分自然输入与程序夹具。

## 核心证明

- 原事件Hit/Lock=.6333；主根→两子→三独立运输，出生.6333/.6333/.7333，飞行.92；无飞行HP、每爆炸对两本体各至多一次。三波可独立命中，不合并根级普通伤害去重。
- Hit前取消0；Hit后死亡/Finish不清已提交第三。自然键鼠先盾冲削HP，再等真实Hit后普攻击杀，三箭正常落地；该自然死亡发生在第三已经出生后，死亡早于第三出生由独立程序反例覆盖。
- 原样角色输入下：双怪两位角色原模型同屏，真实G焦点限制离手Al目标、Z切换、RMB射击扣弹、Shift/WASD拉开、Space暂停、G .1×、Alt 2×；六次模式切换增加generation并恢复视图数量。单独真实H暂收搭档后Hunter右键接触记录block；不称两人常驻的一次连续盾挡已自动证明。
- 自然离开缓存预瞄点0接触；自然离开现有地图视线后弓手搜索/回位。程序墙反例验证平面扫掠阻断，不把无墙自然避让当墙测试。静态落点用主地图裁切投影，无弹射/追踪新点。
- 主resolveHit真实HP/正面盾/背面爆炸/Al无敌、Trace开关同HP/RNG/运行时亲缘；没有第二HP或旧Kit回退。可见目标初始/后来不可达反例、受击硬度严格大于、失视缓存/有限记忆、准备时移动锁均通过。
- 每怪原Skeleton/独立track/context，4.1与玩家旧Runtime隔离；资源404显式冻结专用遭遇；真实反复重置、late-load释放/alpha拾取修复，未称GPU/长期内存已测。

## 保护与已知缺口

11原资产指纹复核，包括两套JSON/atlas/PNG、原箭附件、4.1runtime与三原录音。135个接手保护文件除11批准接缝不变；黄金角色、地图/种子、用户维护、开发细则均未改。774份旧生成证据恢复到接手字节，本轮重生成差异另存regression-generated。原素材不上传，主/Lab构建不携带AL原二进制。共享五记录只追加任务块，按HEAD＋任务块提交，保留其他未提交原文。

SOURCE、LAB SAMPLE、MAIN IMPLEMENTED、AUTO VERIFIED分别记；ORIGINAL OBS/actualResult=null；USER ACCEPTED敌方手感=null，不能借用旧小蓝/小黄认可。没有本轮浏览器视频、原VFX完整迁移、目标GPU/长期负载、完整多宽高比和世界持续生存验收。EN04/Heavy/精英/Boss未做，停止于EN03-MIX。
