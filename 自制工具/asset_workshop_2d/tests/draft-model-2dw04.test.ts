import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftModel } from '../desktop/draft-model.ts';

test('task identity is shared by preset and custom drafts after startup', () => {
  const draft = new DraftModel();
  draft.setTaskId('stone-01');
  draft.setField('description', '石块');
  draft.setMode('custom');
  assert.equal(draft.valuesForBridge().taskId, 'stone-01');

  draft.setTaskId('stone-02');
  draft.setMode('preset');
  assert.equal(draft.valuesForBridge().taskId, 'stone-02');
  assert.throws(() => draft.setTaskId('   '), /任务 ID/);
  assert.equal(draft.valuesForBridge().taskId, 'stone-02');
});

test('auto title uses visible description, dimensions, and mode without semantic guessing', () => {
  const draft = new DraftModel();
  draft.setTaskId('stone-01');
  draft.setField('description', '  青灰色石块\n  表面有裂纹  ');
  draft.setField('widthPx', 512);
  draft.setField('heightPx', 256);
  assert.equal(draft.titleMode, 'auto');
  assert.equal(draft.effectiveTitle, '青灰色石块 表面有裂纹 · 512×256 px · 独立静态 PNG');
  assert.equal(draft.valuesForBridge().title, draft.effectiveTitle);

  draft.setMode('custom');
  assert.equal(draft.effectiveTitle, '青灰色石块 表面有裂纹 · 512×256 px · 自定义静态 PNG');
  draft.setField('description', '一块新岩石');
  assert.equal(draft.effectiveTitle, '一块新岩石 · 512×256 px · 自定义静态 PNG');
});

test('auto title uses square-derived height only when height was not entered', () => {
  const draft = new DraftModel();
  draft.setField('widthPx', 384);
  draft.setField('squareLocked', true);
  assert.equal(draft.effectiveTitle, '未描述素材 · 384×384 px · 独立静态 PNG');
  draft.setField('heightPx', 256);
  assert.equal(draft.effectiveTitle, '未描述素材 · 384×256 px · 独立静态 PNG');
  assert.equal(draft.valuesForBridge().heightPx, 256);
});

test('manual title stays fixed through draft changes, and blank title restores auto mode', () => {
  const draft = new DraftModel();
  draft.setTaskId('stone-01');
  draft.setManualTitle('手写标题');
  assert.equal(draft.titleMode, 'manual');
  draft.setField('description', '石块');
  draft.setField('widthPx', 128);
  draft.setMode('custom');
  assert.equal(draft.effectiveTitle, '手写标题');
  assert.equal(draft.valuesForBridge().title, '手写标题');

  draft.setManualTitle('  ');
  assert.equal(draft.titleMode, 'auto');
  assert.equal(draft.effectiveTitle, '石块 · 128×? px · 自定义静态 PNG');
  draft.setManualTitle('二次命名');
  draft.restoreAutoTitle();
  assert.equal(draft.titleMode, 'auto');
  assert.equal(draft.valuesForBridge().title, '石块 · 128×? px · 自定义静态 PNG');
});

test('new task resets mode, fields, requirements, and preview', () => {
  const draft = new DraftModel();
  draft.setTaskId('stone-01');
  draft.setMode('custom');
  draft.setField('description', '旧任务');
  draft.setField('widthPx', 512);
  draft.setField('ppu', 200);
  draft.addRequirement('hard', '保持轮廓');
  draft.setManualTitle('固定标题');
  const oldRevision = draft.revision;
  draft.acceptPreview(oldRevision);

  draft.newTask('stone-02');
  assert.equal(draft.mode, 'preset');
  assert.equal(draft.titleMode, 'auto');
  assert.equal(draft.valuesForBridge().taskId, 'stone-02');
  assert.equal(draft.effectiveTitle, '未描述素材 · 尺寸待定 · 独立静态 PNG');
  assert.equal(draft.valuesForBridge().description, undefined);
  assert.equal(draft.valuesForBridge().widthPx, undefined);
  assert.equal(draft.valuesForBridge().ppu, undefined);
  assert.equal(Object.hasOwn(draft.valuesForBridge(), 'requirements'), false);
  assert.equal(draft.exportRevision, null);
  assert.equal(draft.acceptPreview(oldRevision), false);
  draft.setMode('custom');
  assert.deepEqual(draft.valuesForBridge().requirements, { hard: [], preferences: [], creativeFreedom: [] });
});

test('copy task retains only visible custom fields and requirements under a new ID', () => {
  const draft = new DraftModel();
  draft.setTaskId('stone-01');
  draft.setField('description', '隐藏的预设草稿');
  draft.setMode('custom');
  draft.setField('description', '可见的自定义草稿');
  draft.setField('widthPx', 640);
  draft.addRequirement('hard', '必须有透明背景');
  draft.addRequirement('preferences', '轮廓柔和');
  draft.setManualTitle('手工石块');
  const oldRevision = draft.revision;
  draft.acceptPreview(oldRevision);

  draft.copyTask('stone-02');
  assert.equal(draft.mode, 'custom');
  assert.equal(draft.titleMode, 'manual');
  assert.equal(draft.valuesForBridge().taskId, 'stone-02');
  assert.equal(draft.valuesForBridge().title, '手工石块');
  assert.equal(draft.valuesForBridge().description, '可见的自定义草稿');
  assert.equal(draft.valuesForBridge().widthPx, 640);
  assert.deepEqual(draft.valuesForBridge().requirements, {
    hard: ['必须有透明背景'], preferences: ['轮廓柔和'], creativeFreedom: [],
  });
  assert.equal(draft.exportRevision, null);
  assert.equal(draft.acceptPreview(oldRevision), false);

  draft.setMode('preset');
  assert.equal(draft.valuesForBridge().description, undefined);
  assert.equal(draft.valuesForBridge().widthPx, undefined);
});

test('copying a preset does not carry hidden custom requirements into the next custom draft', () => {
  const draft = new DraftModel();
  draft.setTaskId('stone-01');
  draft.setMode('custom');
  draft.addRequirement('hard', '旧自定义要求');
  draft.setMode('preset');
  draft.setField('description', '当前预设内容');
  draft.copyTask('stone-02');
  draft.setMode('custom');
  assert.equal(draft.valuesForBridge().taskId, 'stone-02');
  assert.equal(draft.valuesForBridge().description, '当前预设内容');
  assert.deepEqual(draft.valuesForBridge().requirements?.hard, []);
});
