import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSpineReportSummary, formatSpineReportText } from '../src/ui/spine-report.ts';
import type { SpineMigrationReport } from '../src/transfer/spine-timelines.ts';

test('a pose warning remains visible in both the stage summary and saved report', () => {
  const report: SpineMigrationReport = {
    sourceAnimation: 'run', blocked: false,
    totals: { direct: 1, corrected: 0, needsCalibration: 0, explicitSkip: 0, unmapped: 0, unsupported: 0, conflict: 0 },
    warnings: ['arm → Rarm: parent chain differs; inspect local axes and final pose'],
    channels: [{ category: 'bone', kind: 'bone', source: 'arm', channel: 'rotate', keyCount: 2,
      status: 'direct', target: 'Rarm', reason: 'mapped' }],
  };

  assert.match(formatSpineReportSummary(report), /1 条校准警告/);
  const text = formatSpineReportText(report, { sourcePath: 'rhiny.json', targetPath: 'rozeul.json',
    sourceAnimation: 'run', outputName: 'spw02_run' });
  assert.match(text, /状态：部分迁移候选/);
  assert.match(text, /校准警告（1）/);
  assert.match(text, /arm → Rarm: parent chain differs/);
});
