import type { SpineMigrationReport, SpineChannelDecision } from '../transfer/spine-timelines.ts';
import type { AiReviewedProposal, AiValidationContext } from './ai-contracts.ts';

export type AnalysisDiagnosticsInput = { bundle: AiValidationContext; report: SpineMigrationReport;
  reviewed?: AiReviewedProposal; acceptedIds?: readonly string[] };
export type DiagnosticRiskGroup = 'key-motion-chain' | 'control-conflict' | 'pose-calibration' | 'display-attachment' | 'secondary-bone';
function group(channel: SpineChannelDecision): DiagnosticRiskGroup {
  if (channel.status === 'needs-calibration') return 'pose-calibration';
  if (channel.status === 'conflict' || ['ik', 'transform', 'path', 'physics'].includes(channel.kind)) return 'control-conflict';
  if (['attachment', 'slot', 'drawOrder', 'event'].includes(channel.kind)) return 'display-attachment';
  if (/hair|cloth|tail|skirt|bow|butterfly|头发|衣|裙|尾|飘|发/i.test(channel.source)) return 'secondary-bone';
  return 'key-motion-chain';
}
/** Reproducible diagnostics refer to actual copier decisions, never AI confidence or a geometric success score. */
export function createAnalysisDiagnostics(input: AnalysisDiagnosticsInput) {
  const copied = input.report.channels.filter(channel => ['direct', 'corrected', 'needs-calibration'].includes(channel.status));
  const omitted = input.report.channels.filter(channel => !copied.includes(channel));
  const accepted = new Set(input.acceptedIds ?? []);
  const candidates = input.reviewed?.candidates ?? [];
  const risks = input.report.channels.filter(channel => !['direct', 'corrected', 'explicit-skip'].includes(channel.status))
    .map(channel => ({ group: group(channel), ...channel }));
  const diagnostics = {
    diagnosticSchema: 'spw.ai.diagnostics.v1' as const, bundleId: input.bundle.manifest.bundleId,
    source: input.bundle.manifest.source, target: input.bundle.manifest.target,
    sourceSelection: input.bundle.manifest.sourceSelection, targetSelection: input.bundle.manifest.targetSelection,
    sourceAnimation: input.report.sourceAnimation,
    acceptedMappedObjects: candidates.filter(candidate => accepted.has(candidate.id)).length,
    actualCopiedChannels: copied.length, copiedBoneChannels: copied.filter(channel => channel.kind === 'bone').length,
    needsCalibrationChannels: copied.filter(channel => channel.status === 'needs-calibration').length,
    omittedChannels: omitted.length,
    deliveryReady: copied.length > 0 && input.report.totals.needsCalibration === 0 && input.report.totals.conflict === 0
      && input.report.totals.unmapped === 0 && input.report.totals.unsupported === 0,
    state: copied.length === 0 ? 'diagnostic-only-no-motion-transferred' : 'draft-requires-visual-review',
    chainCoverage: Object.fromEntries(['torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'control', 'decoration', 'display'].map(name => {
      const groupCandidates = candidates.filter(candidate => candidate.group === name);
      return [name, { proposedObjects: groupCandidates.length, acceptedObjects: groupCandidates.filter(candidate => accepted.has(candidate.id)).length }];
    })),
    risks, copiedChannels: copied, omittedChannelDecisions: omitted,
    candidateWarnings: candidates.filter(candidate => candidate.warnings.length).map(candidate => ({ id: candidate.id,
      source: candidate.mapping.source, target: candidate.mapping.target, warnings: candidate.warnings, evidenceIds: candidate.evidenceIds })),
    unresolved: input.reviewed?.unresolved ?? [], warnings: [...input.report.warnings],
    importState: 'not-imported-by-this-analysis' as const,
  };
  const names = (text: string) => JSON.stringify(text);
  const request = `# 迁移草稿修整请求\n\n分析包：${diagnostics.bundleId}\n当前动作：${names(diagnostics.sourceAnimation)}\n` +
    `已接受映射对象 ${diagnostics.acceptedMappedObjects}；实际复制通道 ${copied.length}（身体骨骼 ${diagnostics.copiedBoneChannels}）；需校准 ${diagnostics.needsCalibrationChannels}；略过 ${omitted.length}。\n\n` +
    `${copied.length === 0 ? '**当前只有诊断草稿，尚无实际迁移；不能视为可交付动画。**' : '**当前为可检查草稿，需要用户连续播放确认形体、手脚轨迹和节奏。**'}\n\n` +
    `请读取本包身份、当前 diagnostics.json 与原任务书，优先检查身体和真实控制链。不要修改原 .spine，不要编造自动校准公式，不要覆盖人工映射。` +
    `若需变更方向入口或锚点，先列 unresolved 并请求用户重新生成分析包。使用相同协议写一份待审阅提案及说明。\n\n` +
    `## 本轮具体问题\n\n` +
    (risks.length ? risks.slice(0, 80).map(channel => `- [${channel.group}] ${channel.kind} ${names(channel.source)}.${channel.channel}` +
      `${channel.target ? ` → ${names(channel.target)}` : ''}：${channel.status}；${channel.reason.replace(/[\r\n]/g, ' ')}。`).join('\n') : '本轮没有硬阻塞通道；请检查候选校准警告与视觉效果。') +
    `\n\n## 提案中尚待确认\n\n` +
    (diagnostics.unresolved.length ? diagnostics.unresolved.map(item => `- ${names(item.source)}：${item.reason.replace(/[\r\n]/g, ' ')}`).join('\n') : '无额外 unresolved；不能据此代替视觉验收。') +
    `\n\n完整风险、复制通道、略过原因及证据 ID 见 diagnostics.json。当前分析没有完成 Spine 编辑器导入。\n`;
  return { diagnostics, files: { 'diagnostics.json': `${JSON.stringify(diagnostics, null, 2)}\n`, 'repair-request.md': request } };
}
