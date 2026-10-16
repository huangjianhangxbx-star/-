# UIX-DIALOG-01 执行记录

基准：UIX-ROLE-01 最终提交 `5e95e0a`；开工工作区干净。只推 GitHub main。

## 需求与来源
本机《系统讲解.ppt》实际有3页，第3页规定角色气泡、完整一句、下一句三角、主控不可移动。原PPT只读。链接仍要求登录，未取得新增聊天内容，以附件与本机PPT为准。

AI默认：F/点击推进，Esc取消，方向键/Enter选项；锁玩家战斗/移动/选路/切换，世界继续；安全交互开始，生命周期/危险失效中止；结束不返回菜单。

## 结构与参考
- [Yarn Runner](https://docs.yarnspinner.dev/components/dialogue-runner)：运行与游戏连接。
- [Yarn Presenter](https://docs.yarnspinner.dev/components/dialogue-view)：行/选项显示独立。
- [Ink runtime](https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md)：推进、选择、变量及外部函数的包装接口。
- [inkjs](https://github.com/y-lohse/inkjs)：未来可替换运行实现，本轮不安装。

采用内容定义→只读条件上下文/稳定筛选→冻结会话→效果路由→气泡呈现分层。只实现setFlag/notice，其他效果明确拒绝。SAMPLE不冒充正式剧情。

## 参考测量与概念
按 image-to-ui 的测量/层级方法，PPT3 1600×900：气泡约(494,276,445,127)，名称左上、句子中间、三角右下，尾部向角色。没有切图资产，不执行Unity导出流程。
本轮概念420px宽，黑底+淡青细边，名称14px，句子18px；角色上方，边缘避让。选项纵向两行，继续三角仅有后续时出现。

## 顺序
1. 概念图独立评分≥8。
2. TDD条件/重复规则/冻结会话/效果失败与过期请求。
3. 接入既有角色所有权、气泡、输入锁。
4. 1440×900与1920宽屏实机，独立找茬官，低于9最多3轮。
5. 更新工程记录、选择性提交推送。

不修改用户维护区、开发细则、PPT，不同步Gitee。
