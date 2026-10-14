# RFC-TILEGRAM-02 Implementation Plan

> For agentic workers: superpowers:executing-plans/subagent-driven-development不可用；沿用用户完整执行授权，在当前会话顺序执行，不派遣代理或重复询问批准。

Goal：让画师看到真实墙的连续职责、至少A/B两套整板方案、确实能切47态的原创工作台。
Architecture：独立 tools/wall47-authoring-research 的纯映射/整数切片/生成器/本地服务/静态页面；原作路径与可逆数据只写ignored新研究目录。旧图库/工坊只读。
Tech Stack：现有Python/Pillow/numpy + msedge/Playwright；无新依赖。
Spec：本机intake/implementation-plan.md为用户原件；不公开可逆原作索引。

- [x] M0：锁定原作两族JSON、源PNG、旧入口/规则脚本、2D工坊与开发细则SHA；本地/远端main对账，全部dirty另存ignored；旧图库浏览复现。
- [x] M1–M4：47mask身份证、48项差异、PPU/Pivot/Alpha实测、原像素12场景与独立标注；按正交职责与实际面板区分；RGBA局部复用和邻边剖面证据。
- [x] M5：A连续场景覆盖、B局部功能片组合、C47格保底；计算覆盖与补画成本，不将猜测写成PSD事实。
- [x] M6–M7：透明空板/独立辅助线/原创笔画示范，cut-map整数rect+层顺序；切片47与H/L/T/环洞等；缺角工单明确。
- [x] M8：第二已闭合墙族的47角色/8场景及相同规则不同画法反例。
- [x] M9：画师母版推导页，原图/连续标注/母板阶段/来源互查/下载；localhost服务、旧页与新页真实浏览器截图，<=3点击到母版。
- [x] M10：37项矩阵独立报告，SHA前后/非法路径/索引断链/裁切负例；只公开通用代码、原创空板和抽象结论；选择性GitHub main发布。

Interfaces/tests（字面行为期望）：normalize(255)=255、normalize(1)=0；全部47与正交数量分布[1,4,10,16,16]；sourceRect整数、不越界；341×512/ppu341/pivot(.5,.34)/anchor(.5,.5) bounds=(0,-.0104985,1,1.4909677)。RGBA不缩放的native layer组成；PPU混合的世界视图单独标明显示缩放，不伪装源像素保真。A/B切图需保留全部crop矩形及补丁来源；非法mask/漏项/重身份/目录穿越拒绝。

UI：深靛蓝画师工作台#18222e，暗木褐#76634b、墨线#111417、暖纸文字#e7e2d7、轨迹青#70c4c3与补笔橙#e5ab6b。宋体标题、微软雅黑正文、Consolas身份。核心整板流程带为主视觉，原图默认大图，mask退到可展开证据。左右对照、阶段按钮、局部点位，禁止只有蓝框。

定向技术验证完成；37项中3项部分，限制见validation.md。人工美术验收与原作作者PSD不作为本轮已通过事项。
