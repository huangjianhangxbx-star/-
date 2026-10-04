import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createReference, validateEditorMetadata, referenceLayout, stripEditorMetadata } from '../core/references.ts';
import { ReferenceView } from '../desktop/reference-view.ts';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function ref() { return createReference({ id: 'ref-1', name: 'figure.png', dataUrl: png, pixelWidth: 1, pixelHeight: 1 }); }

test('reference dependency survives serialization and has metre defaults', () => {
  const r = ref(); const metadata = JSON.parse(JSON.stringify({ reference: r }));
  validateEditorMetadata(metadata);
  assert.equal(metadata.reference.dataUrl, png);
  assert.equal(r.height, 1.7); assert.equal(r.footY, 1); assert.equal(r.visible, true);
});
test('invalid PNG, dimensions, normalized bounds and foot anchor are rejected', () => {
  for (const patch of [{dataUrl:'file:///missing.png'}, {dataUrl:'data:image/png;base64,AAAA'}, {pixelWidth:2}, {height:0}, {x:Infinity}, {contentTop:0.9,contentBottom:0.2}, {footX:-1}, {footY:2}]) {
    assert.throws(() => validateEditorMetadata({reference:{...ref(),...patch}}));
  }
  assert.doesNotThrow(() => validateEditorMetadata(undefined));
  assert.throws(() => validateEditorMetadata([]));
});
test('effective image bounds calibrate full plane while foot is world origin', () => {
  const r = {...ref(),height:1.8,contentTop:0.2,contentBottom:0.8,footX:0.4,footY:0.8};
  const p = referenceLayout(r);
  assert.ok(Math.abs(p.height - 3) < 1e-12);
  assert.ok(Math.abs(p.width - 3) < 1e-12);
  assert.ok(Math.abs(p.offsetX - 0.3) < 1e-12);
  assert.ok(Math.abs(p.offsetY - 0.9) < 1e-12);
});
test('game export removes editor-only PNG without changing the editable source', () => {
  const source = {version:1,cells:[{x:1,y:2,z:3}],editor:{reference:ref()}};
  const exported = stripEditorMetadata(source);
  assert.equal('editor' in exported,false);
  assert.equal(source.editor.reference.dataUrl,png);
  exported.cells[0].x=9; assert.equal(source.cells[0].x,1);
});
test('reference view stays vertical, follows orthographic view and cannot block paint', () => {
  const v = new ReferenceView(() => new THREE.Texture());
  v.update({...ref(),x:2,y:3,z:4});
  assert.deepEqual(v.group.position.toArray(),[2,4,-3]);
  const camera = new THREE.OrthographicCamera(); camera.position.set(8,9,8); camera.lookAt(0,0,0); camera.updateMatrixWorld();
  v.faceCamera(camera);
  assert.equal(v.group.rotation.x,0); assert.equal(v.group.rotation.z,0);
  assert.ok(Math.abs(v.group.rotation.y-Math.PI/4)<1e-8);
  const hits:any[]=[]; v.mesh!.raycast(new THREE.Raycaster(),hits); assert.equal(hits.length,0);
  assert.equal(v.mesh!.material.transparent,true); assert.equal(v.mesh!.material.depthWrite,false);
  v.update({...ref(),visible:false}); assert.equal(v.group.visible,false); v.dispose();
});
test('replacing/removing reference disposes old image and mesh resources', () => {
  const v = new ReferenceView(() => new THREE.Texture()); v.update(ref());
  let released=0;
  v.mesh!.geometry.addEventListener('dispose',()=>released++);
  v.mesh!.material.addEventListener('dispose',()=>released++);
  v.mesh!.material.map!.addEventListener('dispose',()=>released++);
  v.update(null); assert.equal(released,3); assert.equal(v.group.children.length,0); v.dispose();
});

test('decode failure stays hidden on repeated document sync', () => {
  let fail=()=>{};
  const v=new ReferenceView((_url,_done,onError)=>{fail=onError;return new THREE.Texture();});
  let message=''; v.onError=m=>message=m; v.update(ref()); fail();
  assert.match(message,/PNG/); assert.equal(v.group.visible,false);
  v.update(ref()); assert.equal(v.group.visible,false); v.dispose();
});
test('late texture completion is disposed after reference removal', () => {
  let loaded=(_t:THREE.Texture)=>{};
  const texture=new THREE.Texture(); let disposed=0; texture.addEventListener('dispose',()=>disposed++);
  const v=new ReferenceView((_url,onLoad)=>{loaded=onLoad;return texture;});
  v.update(ref()); v.update(null); loaded(texture); assert.equal(disposed,2); assert.equal(v.group.children.length,0);
});
test('large embedded PNG validation does not overflow regular-expression stack', () => {
  const bytes=Buffer.from(png.slice(22),'base64');
  const dataUrl='data:image/png;base64,'+Buffer.concat([bytes,Buffer.alloc(32*1024*1024-bytes.length)]).toString('base64');
  assert.doesNotThrow(()=>validateEditorMetadata({reference:{...ref(),dataUrl}}));
});

