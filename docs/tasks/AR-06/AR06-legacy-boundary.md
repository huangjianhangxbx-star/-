# Legacy边界

激活条件：Standalone、explorationCompanionId=ranger、原始ranger、al-basic-v1。出发前与其他伙伴不提前改写阿尔技能/速度；Tower保留旧逻辑。

旧技能/两次侧步回归明确mock新Al选择器为false，验证保留分支，不删除旧断言、不改冻结基线。新配置用AR06独立测试；猎人AR05 golden与boundaries继续真实回归。

篝火空技能槽原本会访问null技能，新增可复現测试后最小修复；空槽skillCd=0，不擅自给予新版资源。

保护用户维护、开发细则、原二进制与并行工作树；只推GitHub main。测试重生成的四份历史报告按接手SHA精确备份恢复，本轮结果另保存在work/AR-06。
