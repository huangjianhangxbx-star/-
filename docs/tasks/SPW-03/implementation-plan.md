# SPW-03 AI协作骨架标定实施计划

批准依据：用户2026-10-25明确要求理解较新对话并执行附件SPW-03 v1.0，提供芙蕾茜娅与rozeul目录。ChatGPT正文当前在内置浏览器重定向登录页，已告知并保留登录页；未冒称读到较新消息。先执行附件明确范围，任何追加决定按用户回复并入。

基准：本轮已核对github/main@c600598并从干净4ab2a24快进，Spine工坊仍0.2.5。沿用现有隔离checkout；不修改开发细则/用户维护区、不上传角色、不推Gitee。设计细则2.2登记草稿，第7.1.1选择B级模块验证；不执行无关地图工坊全套。

## 数据与模块边界

- M0：官方Spine4.3.26只读导出两份原工程到work/SPW-03/native-cache，记录SHA256与真实结构。来源rozeul为169骨，目标FREYCIA（原文件芙雷茜娅.spine）为135骨/8约束/1个非空旧动画，尚非五向完整绑定，不移动母版人体。
- M1（rig_reference）：src/analysis/rig-profile.ts提供RigSelection与buildRigProfile；固定setup身体锚点的逆世界矩阵产生分支局部坐标，保留原世界/本地数值与真实动画位移。sampleRig/autoMapSpine增加可选selection，默认旧行为不变。测试平移布局不变性、真实根运动、中文、共享骨、镜像与无效矩阵。
- M2/M3（protocol）：ai-contracts/ai-bundle/ai-proposal/analysis-diagnostics及schemas。版本化manifest与两种提案协议，身份包含原文件哈希、导出指纹、骨架/皮肤/方向和完整选择的bundleId。每个建议关联真实对象和证据。先测试拒绝错指纹/错分支/错侧别/重复/代码字段，再实现严格数据校验、分组待审、保留人工映射的合并。分析包默认只有结构化证据和程序填好的任务书，不含原工程或整套贴图。
- 主任务：桌面安全文件交换IPC、角色/方向/身体锚点选择、预览过滤和坐标/骨链显示、AI审阅面板、配置持久化、真实角色闭环与便携包。AI提案导入只建立待审列表，按链接受后调用现有草稿引擎，不执行返回脚本。
- M4/M5（asset_analysis+主任务）：实际阅读工坊生成分析包，输出mapping-proposal.json、rig-hints.json、analysis-report.md；用同一份接受映射生成两个不同动作的可编辑草稿、diagnostics.json与repair-request.md。跨进程重开复用标定。最终用户仍在Spine确认导入；无GUI证据不声称已导回并改键。

## 公共接口

RigSelection={directionId,directionRoot,bodyAnchor,groundAnchor?,sharedBones,normalizationBones?}。
buildRigProfile(document,atlas,animations,skin,selection,side)产出原setup世界矩阵、固定人体参考系局部点、尺度、骨/约束/槽关系、运动采样和稳定evidenceIds。
createAiBundle({source,target,animations,toolVersion})返回manifest/sourceRig/targetRig/files；输入单侧含projectPath/skeletonName/projectHash/document/atlasText/skin/selection。
validateAiProposal(value,bundle,hints?)→candidates/groups/unresolved/warnings；mergeAcceptedAiMappings(existing,reviewed,acceptedIds)→mappings/acceptedIds/conflicts，不覆盖已有对象占用。

桌面AI文件写入仅允许固定文件清单、新建独立目录；导入只读取选择目录内两种JSON及可选报告，限制大小。打开目录/复制指令只针对本轮已登记导出路径。原工程/图片路径只作只读证据。

## 实施与验证次序

1. 各模块先失败用例，再实现到相关测试通过。来源169骨、目标135骨，以intake.json实际source/target为准，任何文档示意不当真实名。
2. 工坊输入真文件、选侧正面方向分支，确认人体锚点偏离root的复现；同分支平移对照测试排除编辑布局影响。
3. 工坊导出真实bundle及填充任务书；Codex产出提案，工坊严格拒绝损坏/过期/其他方向/重复提案并审阅接受主要身体+至少一条肩肘腕链。
4. 动作1与动作2共享角色映射；缺失/需校准单独记录。关闭进程，重新载入配置验证角色标定及来源信息。
5. 类型检查、受影响模块与工坊既有测试、build，最终便携EXE隐藏流程复测；官方原生载体回读和原件哈希检查。GUI导入/保存/改键按实际工具可用性单独记录。
6. 打包0.3.0至E:/SPW-03-release独立目录，交付work/SPW-03分析包、AI结果、两动作证据和使用说明；核对远端并选择性推GitHub main。
