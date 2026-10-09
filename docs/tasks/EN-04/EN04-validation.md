# EN04 验证

- Fixture：14架势案例，通过首次归零即时控、guard半成本/背面/Al无敌、控制不续期/半恢复、真正步行/主攻/副手、DOT/newhit分离、Al RMB主手、Reference/Legacy、死亡优先、代次清理、子步恢复延迟及TraceOFF。首次5失败，追加死亡/Reset2失败、子步延迟1失败、Reference构造1失败均先捕获后修复；没有用红绿统计代替范围验收。
- 定向：12文件102项（EN01五文件、EN02、EN03、新EN04及Hunter黄金3文件、AR06），通过。最终Reference构造局部改动另定向核对。
- Natural：Edge真实WASD/LMB/H，1项16.4秒通过。僵尸15→0当次仍活着HP120，control .6、身体无未来动作；这是H临时召回Al的单猎人案例，不是EN06双人认可。保存 `work/EN-04/browser/natural-zero.{json,png}`，无pageerror。
- 纠正浏览器测试的错误前提：归零当时身体已被前一普通Hurt取消，没有可再次取消的action；不得为测试伪造Cancel。pre-Hit时有真实action的取消由核心夹具独立证明。
- 类型/主构建/Action Lab构建通过；主包既有chunk体积警告保留。没有原动态OBS、用户怪物体验认可、目标GPU或长期内存结论。
- 主输入/模型/黄金/普通入口后续在EN06完成受影响矩阵一次终回归。本阶段仅C1技术门，继续已授权EN05。
