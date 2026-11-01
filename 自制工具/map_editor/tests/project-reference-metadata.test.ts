import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as docs from '../core/workshop-documents.ts';
import * as v2 from '../core/workshop-v2.ts';
import * as references from '../core/references.ts';
import {createReference,withEditorReferences,validateEditorMetadata} from '../core/references.ts';
import {planV1Migration} from '../core/workshop-v2-migration.ts';
const {createWorkshopV2Repository}=createRequire(import.meta.url)('../desktop/workshop-v2-store.cjs');
const {createWorkshopBridge}=createRequire(import.meta.url)('../desktop/workshop-ipc.cjs');
const core={...docs,...v2};
const reference=createReference({id:'shared',name:'actor.png',pixelWidth:1,pixelHeight:1,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='});
const editor={references:[reference,{...reference,id:'background',kind:'modeling' as const,height:4,visible:false}]};
async function fixture(run:(root:string,repo:any)=>Promise<void>){const parent=path.resolve('validation');await fs.mkdir(parent,{recursive:true});const root=await fs.mkdtemp(path.join(parent,'project-reference-meta-'));try{await run(root,createWorkshopV2Repository(core));}finally{assert.equal(path.dirname(root),parent);await fs.rm(root,{recursive:true,force:true});}}

test('project sharing can aggregate forty native reference lists without raising asset or scene limits',()=>{
  const limit=(references as any).PROJECT_REFERENCE_LIMIT;
  assert.equal(typeof limit,'number');
  const forty=Array.from({length:40},(_,i)=>({...reference,id:'legacy-'+i}));
  const shared=(withEditorReferences as any)(undefined,forty,limit);
  assert.equal(references.editorReferences(shared).length,40);
  assert.throws(()=>withEditorReferences(undefined,forty),/列表|32/);
  assert.throws(()=>validateEditorMetadata(shared),/列表|32/);
  assert.equal((docs.validateProject({...docs.createProject('p'),editor:shared}) as any).editor.references.length,40);
  assert.equal((v2.validateProjectV2({...v2.createProjectV2('p'),editor:shared}) as any).editor.references.length,40);
  assert.throws(()=>docs.validateScene({...docs.createScene('s'),editor:shared}),/列表|32/);
  assert.throws(()=>docs.validateAsset({...docs.createAsset('a'),editor:shared}),/列表|32/);
  assert.throws(()=>v2.validateProjectV2({...v2.createProjectV2('p'),editor:{references:Array.from({length:257},(_,i)=>({...reference,id:'too-many-'+i}))}}),/列表|256/);
});

test('project V1 and V2 accept shared editor references without changing legacy documents',()=>{
  for(const [project,validate] of [[docs.createProject('old'),docs.validateProject],[v2.createProjectV2('new'),v2.validateProjectV2]] as const){
    const before=JSON.stringify(project);assert.equal(JSON.stringify(validate(project)),before);
    const candidate={...project,editor:structuredClone(editor)},result=validate(candidate as any) as any;
    assert.deepEqual(result.editor,editor);
    result.editor.references[0].height=9;assert.equal(candidate.editor.references[0].height,1.7);
    assert.equal(JSON.stringify(project),before);
    assert.throws(()=>validate({...project,editor:{references:[reference,reference]}} as any),/重复/);
    assert.throws(()=>validate({...project,editor:{references:Array.from({length:257},(_,i)=>({...reference,id:String(i)}))}} as any),/列表|256/);
    assert.throws(()=>validate({...project,editor:{reference:{...reference,height:NaN}}} as any),/高度|尺寸/);
  }
});

test('legacy migration keeps project references shared and scene references separate',()=>{
  const project=docs.createProject('old') as any,scene=docs.createScene('scene');
  project.editor=structuredClone(editor);scene.editor={reference:{...reference,id:'scene-only'}};
  project.scenes.push({sceneId:scene.sceneId,name:scene.name,source:'scenes/scene/scene.xhscene.json'});
  const before=structuredClone(project),result=planV1Migration(project,[scene],new Map(),()=> 'unused');
  assert.deepEqual((result.project as any).editor,editor);assert.deepEqual(result.scenes[0].editor,scene.editor);
  assert.deepEqual(project,before);(result.project as any).editor.references[0].height=9;assert.equal(project.editor.references[0].height,1.7);
});

test('shared project reference save is isolated, reopenable, validated and protects external edits',()=>fixture(async(root,repo)=>{
  const opened=await repo.create(root,v2.createProjectV2('project')),asset=docs.createAsset('stone'),scene=v2.createSceneV2('scene');
  await repo.saveAsset(opened.token,asset);await repo.saveScene(opened.token,scene);
  const projectFile=path.join(root,'project.xhproject.json'),assetFile=path.join(root,'assets/stone/asset.xhmodule.json'),sceneFile=path.join(root,'scenes/scene/scene.xhscene.json');
  const originalProject=await fs.readFile(projectFile),assetBytes=await fs.readFile(assetFile),sceneBytes=await fs.readFile(sceneFile);
  const fresh=createWorkshopV2Repository(core),legacy=await fresh.open(root);assert.deepEqual(await fs.readFile(projectFile),originalProject,'opening a pre-metadata project never rewrites it');
  assert.equal(typeof fresh.saveProjectEditor,'function');
  const saved=await fresh.saveProjectEditor(legacy.token,editor);assert.deepEqual(saved.document.editor,editor);assert.equal(saved.document.revision,legacy.document.revision+1);assert.equal(saved.hash,null);
  assert.deepEqual(await fs.readFile(assetFile),assetBytes);assert.deepEqual(await fs.readFile(sceneFile),sceneBytes);
  const reopenedRepo=createWorkshopV2Repository(core),reopened=await reopenedRepo.open(root);assert.deepEqual(reopened.document.editor,editor);
  const loaded=await reopenedRepo.loadAsset(reopened.token,'stone');loaded.document.name='重命名模型';loaded.document.revision++;
  const savedAsset=await reopenedRepo.saveAsset(reopened.token,loaded.document);assert.deepEqual(savedAsset.document.editor,editor,'later asset saves retain the single shared project payload');
  const renamed=await reopenedRepo.renameProject(reopened.token,'新项目名');assert.deepEqual(renamed.document.editor,editor);
  const committed=await fs.readFile(projectFile);
  await assert.rejects(reopenedRepo.saveProjectEditor(reopened.token,{references:[reference,reference]}),/重复/);assert.deepEqual(await fs.readFile(projectFile),committed);
  await reopenedRepo.saveProjectEditor(reopened.token,undefined);assert.equal('editor' in JSON.parse(await fs.readFile(projectFile,'utf8')),false,'removing shared metadata leaves no duplicated empty reference payload');
  await fs.appendFile(projectFile,'\n');const externallyChanged=await fs.readFile(projectFile);
  await assert.rejects(reopenedRepo.saveProjectEditor(reopened.token,editor),/外部修改/);assert.deepEqual(await fs.readFile(projectFile),externallyChanged);
}));

test('legacy project metadata uses the existing leased save and reopens without changing the source until commit',()=>fixture(async(root)=>{
  const bridge=createWorkshopBridge(core),opened=await bridge.create(root,docs.createProject('legacy')),file=path.join(root,'project.xhproject.json'),before=await fs.readFile(file);
  const leased=await bridge.load(opened.token,'project.xhproject.json','project','legacy');
  leased.document.editor=structuredClone(editor);leased.document.revision++;
  assert.deepEqual(await fs.readFile(file),before);
  await bridge.commit(opened.token,[{leaseId:leased.leaseId,document:leased.document}]);
  const reopened=await createWorkshopBridge(core).open(root);assert.deepEqual(reopened.document.editor,editor);
}));

test('save-as project copies shared references once and leaves the source project untouched',()=>fixture(async(root,repo)=>{
  const source=path.join(root,'source');await fs.mkdir(source);const project={...v2.createProjectV2('project'),editor:structuredClone(editor)};
  const opened=await repo.create(source,project),before=await fs.readFile(path.join(source,'project.xhproject.json'));
  const destination=path.join(root,'copy');await repo.copyProject(opened.token,destination,'副本');
  const copied=await createWorkshopV2Repository(core).open(destination);assert.deepEqual(copied.document.editor,editor);assert.deepEqual(copied.document.assets,[]);assert.deepEqual(await fs.readFile(path.join(source,'project.xhproject.json')),before);
}));
