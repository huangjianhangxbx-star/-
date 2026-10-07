# AR02 技能分表

| 类别 / 能力 | 启动身份 | 出手与结果 | 备注 |
|---|---|---|---|
| ordinary attack：hunt / bell | observed，成功command，slot/skill/旧pressureCastId | observed，真实pulse，bell多目标同机会分别HitOutcome | suppressed不补发；猎人pulse没有目标仍是该pulse机会，不造命中 |
| healing/support：prayer / ward | observed | not-an-attack；旧治疗/status/FX原样 | 支持动作不以技能开始伪造攻击 |
| count support：pain | observed，newRun成功消耗已有counter | not-an-attack；painWave治疗与painEcho原样 | 即时本体完成，Echo自身support context保留父/根，无攻击事件 |
| SkillRun field：sanctuary | observed，成功castSpecial/newRun | not-an-attack；场域heal/slow/削抗旧逻辑 | 原field寿命/治疗段数保留 |
| toggle：poison / snipe | observed，成功mode-toggle即完成 | not-an-attack（切模式自身） | 不把切开/关当伤害；失败CD/权限不造action |
| chargedMode：dance准备/退出 | observed，旧自动enabled变化system或玩家退出 | not-an-attack（准备/退出自身） | 真实状态转换才记，非每帧准备重记 |
| Basic modifier：dance sweep / sniper shot | observed，newRun在真实资格通过后 | observed，子技能攻击以当前Basic为父/根；旧castId和费用不改 | 不是独立新手动施法，也不改Basic节奏 |
| on-hit threshold：poison爆发 | observed，旧毒素阈值分支通过 | observed，爆发子动作/多目标；父为当前Basic | 普通毒素积累没有额外Action；旧共享meter与cast budget不变 |
| auto SkillRun：rain | observed，旧自动newRun，system | observed，每个真正有目标并发射的slot独立wave，原at保留 | 跳过的slot不造发射/费用，不catch-up |
| auto SkillRun：reap | observed，旧counter/path资格及newRun，system | observed，旧扫掠segment/爆发机会 | 原几何和out/backHits去重不变，正常/受阻完成记录 |
| delayed：snipeEcho / backslash | observed，旧Echo提交时独立子context | observed，延迟触发自身AttackEvent | actor/cast/parent/root冻结；已结束源动作不清旧Echo |
| persistent：rainTrace / scytheTrace / seat | observed，旧Echo提交 | observed，旧tick采样攻击机会 | 空采样可无HitOutcome，旧hits/expires/detached判定不变；非新projectile |
| DoT / special legacy | legacy或unattributed | 没经resolveHit则不伪造Outcome | 详见路径覆盖；不会以全部newRun已接来声称所有旧伤害统一完毕 |

正式源：core/engine.ts、basic-chain.ts、skill-execution.ts、attack-intent.ts；无Action Lab kernel/素材迁移。rain/reap的system意味着实际tick自动执行，不发明玩家按钮或AI请求。原作观察结果未补填。
