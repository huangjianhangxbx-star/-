import test from 'node:test';
import assert from 'node:assert/strict';
import { composePreset, DEFAULT_PROJECT_STYLE_CONTRACT } from '../core/task.ts';

const selection = {
  mode: 'preset' as const, seed: { id: 'standalone-static-png', version: '1' },
  purpose: { id: 'generic-asset', version: '1' }, structure: { id: 'standalone-static-png', version: '1' },
  operation: { id: 'create-new', version: '1' }, style: { id: 'project-neutral', version: '1' }, adapter: { id: 'codex', version: '1' },
};
const values = { taskId: 'env-test', title: '场景', widthPx: 256, squareLocked: true };
const environment = (materialFamily = 'stone', repeatable = false, connected = false) => ({
  schemaVersion: '2dw-environment-style/1', domain: 'environment', materialFamily, repeatable, connected,
});
const make = (input: unknown) => composePreset(selection, { ...values, environmentStyle: input } as never, []);

test('scene selection produces a versioned authoritative snapshot without changing PNG or old contract', () => {
  const spec = make(environment());
  assert.equal(spec.schemaVersion, '1.2.0');
  assert.deepEqual(spec.projectStyleContract, DEFAULT_PROJECT_STYLE_CONTRACT);
  assert.equal(spec.output.ppu, 100);
  assert.equal(spec.output.widthPx, 256);
  const env = (spec as any).environmentStyle;
  assert.ok(env.approvedRules.some((r: any) => r.id === 'ENV-STONE-01'));
  assert.ok(env.approvedRules.every((r: any) => r.status === 'approved' && r.origin && r.trigger && r.checkMode === 'visual-review'));
  assert.equal(new Set(env.approvedRules.map((r: any) => r.id)).size, env.approvedRules.length);
  assert.match(env.approvedRules.find((r: any) => r.id === 'ENV-COM-10').text, /主要明暗块面/);
  assert.match(env.approvedRules.find((r: any) => r.id === 'ENV-COM-06').text, /按需/);
  assert.equal(env.referenceAnchors[0].sha256, '41c21aa13228c01f15034d213e2e948d2f032fa4ebd0d8f6c87c17185332b559');
});

test('wood inherits approved common rules while material suggestions stay candidate and never inherit stone', () => {
  const env = (make(environment('wood')) as any).environmentStyle;
  assert.ok(env.approvedRules.some((r: any) => r.id === 'ENV-CHAR-01'));
  assert.ok(![...env.approvedRules, ...env.candidateRules].some((r: any) => r.id.startsWith('ENV-STONE')));
  assert.deepEqual(env.candidateRules.map((r: any) => r.id), ['ENV-WOOD-01', 'ENV-WOOD-02']);
  assert.ok(env.candidateRules.every((r: any) => r.status === 'candidate'));
  assert.deepEqual(env.referenceAnchors, []);
});

test('repeatable or connected rules activate only from explicit selection', () => {
  assert.ok(!(make(environment()) as any).environmentStyle.approvedRules.some((r: any) => r.id === 'ENV-COM-08'));
  for (const input of [environment('stone', true), environment('wood', false, true)]) {
    assert.ok((make(input) as any).environmentStyle.approvedRules.some((r: any) => r.id === 'ENV-COM-08'));
  }
});

test('old and explicit non-scene task retain old schema and no environmental payload', () => {
  for (const spec of [composePreset(selection, values, []), make(null)]) {
    assert.equal(spec.schemaVersion, '1.1.0');
    assert.ok(!Object.hasOwn(spec, 'environmentStyle'));
  }
});

test('unknown family, domain, version, nonboolean and extra authority fields fail closed', () => {
  for (const input of [environment('unknown'), { ...environment(), domain: 'ui' },
    { ...environment(), schemaVersion: '2dw-environment-style/99' }, { ...environment(), repeatable: 'yes' },
    { ...environment(), approvedRules: [] }]) assert.throws(() => make(input));
});

test('general and reserved families have no invented material rules', () => {
  for (const family of ['general', 'soil', 'metal', 'vegetation']) {
    const env = (make(environment(family)) as any).environmentStyle;
    assert.ok(!env.approvedRules.some((r: any) => r.layer === 'L2'));
    assert.deepEqual(env.candidateRules, []);
  }
});

test('scene keeps explicit budget conflicts but does not claim semantic or image verification', () => {
  const spec = composePreset(selection, { ...values, environmentStyle: environment(), taskStyleDelta: {
    schemaVersion: '2dw-task-style-delta/1', focus: '保留结构', mustPreserve: [], mustChange: [], localReferenceNote: '', avoid: [], toneBudget: { darkMaxTiers: 4 },
  }} as never, []);
  assert.match((spec as any).environmentStyle.conflicts.join(''), /暗部/);
  assert.ok((spec as any).environmentStyle.failureSignals.every((r: any) => r.checkMode === 'visual-review'));
});
test('stricter project budget is allowed while empty baseline cannot waive approved scene ceiling',()=>{
 const strict=composePreset(selection,{...values,environmentStyle:environment(),projectStyleContract:{...DEFAULT_PROJECT_STYLE_CONTRACT,toneBudget:{darkMaxTiers:2,lightMaxTiers:2}}} as never,[]);
 assert.deepEqual(strict.environmentStyle!.conflicts,[]);
 const waived=composePreset(selection,{...values,environmentStyle:environment(),projectStyleContract:null,taskStyleDelta:{schemaVersion:'2dw-task-style-delta/1',focus:'试验',mustPreserve:[],mustChange:[],localReferenceNote:'',avoid:[],toneBudget:{lightMaxTiers:4}}} as never,[]);
 assert.ok(waived.environmentStyle!.conflicts.length>0);
});
