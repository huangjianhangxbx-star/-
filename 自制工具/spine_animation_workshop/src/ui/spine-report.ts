import type { SpineMigrationReport } from '../transfer/spine-timelines.ts';

export type SpineReportContext = {
  sourcePath: string;
  targetPath: string;
  sourceAnimation: string;
  outputName: string;
};

export function formatSpineReportSummary(report: SpineMigrationReport): string {
  const { direct, corrected, needsCalibration, explicitSkip, unmapped, unsupported, conflict } = report.totals;
  return `直接 ${direct} · 修正 ${corrected} · 待校准 ${needsCalibration} · 跳过 ${explicitSkip} · 待处理 ${unmapped + unsupported + conflict} · ${report.warnings.length} 条校准警告`;
}

export function formatSpineReportText(report: SpineMigrationReport, context: SpineReportContext): string {
  const totals = report.totals;
  const partial = totals.explicitSkip > 0 || totals.needsCalibration > 0 || report.warnings.length > 0;
  return [
    'SPW-02 Spine 到 Spine 迁移报告',
    `来源：${context.sourcePath}`,
    `目标：${context.targetPath}`,
    `动作：${context.sourceAnimation} → ${context.outputName}`,
    `状态：${report.blocked ? '阻塞' : partial ? '部分迁移候选，需视觉审阅' : '候选已生成'}`,
    `直接：${totals.direct}；修正：${totals.corrected}；待校准：${totals.needsCalibration}；显式跳过：${totals.explicitSkip}；未映射：${totals.unmapped}；不支持：${totals.unsupported}；冲突：${totals.conflict}`,
    '',
    `校准警告（${report.warnings.length}）`,
    ...report.warnings,
    '',
    ...report.channels.map((item) => `${item.status}\t${item.kind}\t${item.sourceSkin ? `${item.sourceSkin}/${item.sourceSlot}/` : ''}${item.source}\t${item.channel}\t${item.target ?? ''}\t${item.keyCount} keys\t${item.reason}`),
    '',
  ].join('\n');
}
