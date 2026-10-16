# UIX-ROLE-01 实施计划
目标：统一角色交互和商店路由，保留现有库存交易。
技术：TypeScript、DOM/SVG、Three.js既有投影、Vitest/Playwright。
1. 先以实机场景+HTML/SVG叠加生成 concept-01.png；右侧F提示、左侧四段弧形菜单，不遮人物；商人仅商店亮，其余灰；菜单锁输入不暂停世界。独立找茬官评分>=8才改实现。
2. 新建 core/role-interaction.ts：能力定义、角色筛选、同层/视距/3单位判定、会话身份有效性；商店访问复用其能力，空伙伴货架与商人货架分开。
3. 新建 role-interaction-panel.ts / CSS：提示、弧形菜单、统一动作路由，关闭校验；接 exploration-app.ts 输入/渲染，移除旧商人直达入口。F角色优先；V寻路；Z现有切换。
4. 单测先覆盖主角不交互、商人灰项、伙伴全项、受控伙伴Z、同层距离、身份失效；再实现。Playwright覆盖F/点击、商店真实跳转、空货架、锁移动但时间继续、Esc/空白/超距关闭、Z/V。
5. 找茬官依据源PPT、截图、代码和测试证据评分，<9返修，最多三轮。通过后更新CurrentRules/项目状态/当日日志、提交推送GitHub main；不推Gitee。
