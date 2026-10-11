import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=()=>require('../workflow/package.cjs');
test('sample stage contains topology guide, real selected refs and flexible bounded output',()=>{
 const {buildLockedSpec,buildStagePackage,validateStageZip}=api();
 const spec=buildLockedSpec({cellPixels:32});
 const pack=buildStagePackage({stage:'sample',sessionId:'test-stage',lockedSpec:spec});
 assert.equal(pack.spec.schemaVersion,'1.4.0');assert.equal(pack.spec.stage,'sample-task');
 assert.equal(pack.spec.sampleRequest.forms.length,4);assert.equal(pack.spec.output.exactDimensions,false);
 assert.ok(pack.files['guides/sample-layout.png']);assert.equal(validateStageZip(pack.bytes).spec.stage,'sample-task');
});
test('style uses actual selected revision and formal cannot bypass exact approved identity',()=>{
 const {buildLockedSpec,buildStagePackage,validateStageZip}=api();
 const {templateImages,sha}=require('../grammar/compile.cjs'),{makeGrammar}=require('../grammar/catalog.cjs');
 const bytes=templateImages(makeGrammar({cellPixels:32})).blank;
 const spec=buildLockedSpec({cellPixels:32}),sample={id:'sample-1',revision:1,sha256:sha(bytes),bytes,kind:'manual',testOnly:true};
 const style=buildStagePackage({stage:'style',sessionId:'test-stage',lockedSpec:spec,sample});
 assert.ok(style.files['input/selected-sample.png'].equals(bytes));assert.equal(validateStageZip(style.bytes).spec.sample.sha256,sha(bytes));
 assert.throws(()=>buildStagePackage({stage:'formal',sessionId:'test-stage',lockedSpec:spec,sample}),/批准/);
 const approval={sampleId:sample.id,revision:1,sha256:sha(bytes),fileBytes:bytes.length,specHash:api().specHash(spec),approvedBy:'synthetic-test-only',testOnly:true,approvedAt:'2026-10-11T00:00:00.000Z',templateId:spec.grammar.template.id,templateVersion:spec.grammar.template.version,profileVersion:'1',notes:'technical only'};
 const formal=buildStagePackage({stage:'formal',sessionId:'test-stage',lockedSpec:spec,sample,approval});
 assert.ok(formal.files['input/approved-sample.png'].equals(bytes));assert.equal(validateStageZip(formal.bytes).spec.output.files.length,2);
 assert.throws(()=>buildStagePackage({stage:'formal',sessionId:'test-stage',lockedSpec:spec,sample,approval:{...approval,sha256:'0'.repeat(64)}}),/批准/);
});
test('rehashing manifest cannot hide changed style, sample, coordinates or authority',()=>{
 const {buildLockedSpec,buildStagePackage,validateStageZip}=api();const {zipSync,unzipSync}=require('fflate'),{sha}=require('../grammar/compile.cjs');
 const pack=buildStagePackage({stage:'sample',sessionId:'test-stage',lockedSpec:buildLockedSpec({cellPixels:32})});
 for(const key of ['style/project-style-contract.json','spec/asset-spec.json','asset-grammar/grammar.json']){
  const files=unzipSync(pack.bytes);files[key]=Buffer.from('{}');const manifest=JSON.parse(Buffer.from(files['manifest.json']).toString());
  for(const e of manifest.entries){e.sha256=sha(files[e.path]);e.byteLength=files[e.path].length;}files['manifest.json']=Buffer.from(JSON.stringify(manifest));
  assert.throws(()=>validateStageZip(Buffer.from(zipSync(files))),/signature|签名|镜像|身份/);
 }
});
