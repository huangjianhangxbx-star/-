import test from 'node:test';
import assert from 'node:assert/strict';
import { composePreset, compileWorkflowTask, DEFAULT_PROJECT_STYLE_CONTRACT, getStyleConflicts } from '../core/task.ts';

const selection = {
  mode: 'preset', seed: { id: 'standalone-static-png', version: '1' },
  purpose: { id: 'generic-asset', version: '1' }, structure: { id: 'standalone-static-png', version: '1' },
  operation: { id: 'create-new', version: '1' }, style: { id: 'project-neutral', version: '1' },
  adapter: { id: 'codex', version: '1' },
} as const;
const values = { taskId: 'brick-repaint', title: '砖块局部重绘', widthPx: 683, squareLocked: false, heightPx: 679 };

test('the project style default is structured and persisted into the authoritative spec', () => {
  const spec = composePreset(selection, values, []);
  assert.deepEqual(spec.projectStyleContract, DEFAULT_PROJECT_STYLE_CONTRACT);
  assert.equal(spec.projectStyleContract?.toneBudget.darkMaxTiers, 3);
  assert.equal(spec.projectStyleContract?.toneBudget.lightMaxTiers, 3);
  assert.equal(spec.taskStyleDelta, null);
  assert.equal(spec.fieldSources.projectStyleContract, 'project-default');
  const entries = compileWorkflowTask(spec).entries;
  assert.deepEqual(JSON.parse(entries['spec/asset-spec.json']).projectStyleContract, DEFAULT_PROJECT_STYLE_CONTRACT);
  assert.deepEqual(JSON.parse(entries['style/project-style-contract.json']), DEFAULT_PROJECT_STYLE_CONTRACT);
  assert.match(entries['style/project-style-contract.md'], /暗部|黑块/);
  assert.match(entries['style/task-style-delta.md'], /未指定|无本次偏移/);
});

test('explicit null project contract is preserved and task delta is marked unprotected', () => {
  const spec = composePreset(selection, {
    ...values, projectStyleContract: null,
    taskStyleDelta: { schemaVersion: '2dw-task-style-delta/1', focus: '只改中间砖', mustPreserve: ['周边石砖'], mustChange: ['减少纹理'], localReferenceNote: '图1中间砖', avoid: [] },
  }, []);
  assert.equal(spec.projectStyleContract, null);
  assert.equal(spec.fieldSources.projectStyleContract, 'user-override');
  assert.equal(spec.taskStyleDelta?.focus, '只改中间砖');
  assert.ok(getStyleConflicts(spec.projectStyleContract, spec.taskStyleDelta).some(x => /无项目基线/.test(x)));
  assert.match(compileWorkflowTask(spec).entries['style/task-style-delta.md'], /无项目基线/);
});

test('task tone budget cannot silently relax a project budget', () => {
  const spec = composePreset(selection, {
    ...values,
    taskStyleDelta: { schemaVersion: '2dw-task-style-delta/1', focus: '中间砖', mustPreserve: [], mustChange: [], localReferenceNote: '', avoid: [], toneBudget: { darkMaxTiers: 5 } },
  }, []);
  const conflicts = getStyleConflicts(spec.projectStyleContract, spec.taskStyleDelta);
  assert.ok(conflicts.some(x => /暗部/.test(x) && /5/.test(x) && /3/.test(x)));
  assert.match(compileWorkflowTask(spec).entries['workflow/decision-policy.md'], /风格契约.*冲突|风格偏移.*冲突/);
});

test('clear positive requests for a prohibited look warn, while repeating the prohibition does not', () => {
  const delta = (mustChange: string[]) => ({
    schemaVersion: '2dw-task-style-delta/1' as const,
    focus: '中间砖', mustPreserve: [], mustChange, localReferenceNote: '', avoid: [],
  });
  assert.ok(getStyleConflicts(DEFAULT_PROJECT_STYLE_CONTRACT, delta(['改成写实抛光质感。']))
    .some(message => /写实抛光/.test(message)));
  assert.equal(getStyleConflicts(DEFAULT_PROJECT_STYLE_CONTRACT, delta(['避免过度精致和写实抛光感。'])).length, 0);
  const spec = composePreset(selection, { ...values, taskStyleDelta: delta(['改成写实抛光质感。']) }, []);
  assert.match(compileWorkflowTask(spec).entries['style/task-style-delta.md'], /显式正向诉求/);
});

test('style objects are strictly validated, and legacy resolver does not inherit a new contract', () => {
  assert.throws(() => composePreset(selection, { ...values, projectStyleContract: { ...DEFAULT_PROJECT_STYLE_CONTRACT, secret: 'x' } as any }, []),
    (error: any) => error?.code === 'unknown-field' && /projectStyleContract/.test(error.field));
  assert.throws(() => composePreset(selection, { ...values, taskStyleDelta: { schemaVersion: '2dw-task-style-delta/1', focus: 'x', mustPreserve: [], mustChange: [], localReferenceNote: '', avoid: [], toneBudget: { darkMaxTiers: 0 } } }, []),
    (error: any) => error?.code === 'invalid-number' && /darkMaxTiers/.test(error.field));
});
