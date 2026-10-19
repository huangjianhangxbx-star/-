import assert from 'node:assert/strict';
import test from 'node:test';
import { addPane, closePane, navigate, newLayout, restoreLayout, travel } from '../core/asset-browser-state.ts';

test('browser panes keep independent folders, history, search and zoom', () => {
  let layout = newLayout();
  layout = addPane(layout, layout.active, 'right', true);
  assert.equal(layout.panes.length, 2);
  layout.panes[0] = navigate(layout.panes[0], 'assets/家具');
  layout.panes[0].query = '椅'; layout.panes[0].zoom = 64;
  assert.equal(layout.panes[1].folder, '');
  assert.equal(layout.panes[1].query, '');
  assert.equal(layout.panes[1].zoom, 128);
  assert.equal(travel(layout.panes[0], 'back').folder, '');
  assert.equal(travel(travel(layout.panes[0], 'back'), 'forward').folder, 'assets/家具');
  const restored = restoreLayout(JSON.parse(JSON.stringify(layout)));
  assert.equal(restored.panes[0].query, '椅');
  assert.equal(closePane(restored, restored.panes[0].id).panes.length, 1);
  assert.equal(restoreLayout({ panes: [{ id: 'x', folder: '../outside' }] }).panes[0].folder, '');
});
