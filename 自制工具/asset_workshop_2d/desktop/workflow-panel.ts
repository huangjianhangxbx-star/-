type WfVersion={id:string;revision:number;kind:string;parentId?:string|null;sha256:string;fileBytes?:number;width:number;height:number;source?:unknown;purpose?:string;accepted:boolean;error?:string|null;testOnly?:boolean;image?:string;specHash?:string;createdAt?:string};
type WfApproval={sampleId?:string;sha256?:string;specHash?:string;trustedCurrent?:boolean;stale?:boolean;testOnly?:boolean;notes?:string};
type WfFormChecks={assetType:boolean;sharedCamera:boolean;noForbiddenFaces:boolean;productionIntent:boolean};
type WfFormReview={status:string;checks?:Partial<WfFormChecks>;sampleId?:string;revision?:number;sha256?:string;specHash?:string;trustedCurrent?:boolean;stale?:boolean;viewContractId?:string;stylePressureId?:string;reviewedBy?:string;notes?:string};
type WfReference={refId:string;role:string;sourceName?:string;note?:string;width?:number;height?:number;sha256:string;fileBytes?:number;image?:string};
type WfState={schemaVersion?:string;taskId?:string;title?:string;stage:string;format:string;options?:Record<string,unknown>;lockedSpec?:Record<string,unknown>|null;specHash?:string;versions:WfVersion[];references?:WfReference[];selectedSampleId?:string|null;approval?:WfApproval|null;approvalHistory?:unknown[];formReview?:WfFormReview|null;formReviewHistory?:unknown[];legacyContract?:boolean;requests?:unknown[];masters?:unknown[];lastError?:string|null;gates?:{sampleReady?:boolean;styleReady?:boolean;approveReady?:boolean;formReady?:boolean;canAdopt?:boolean;formalReady?:boolean;compileReady?:boolean;reason?:string};compiled?:{id:string;tiles?:number;structureStatus:string;artAcceptance?:string;unitySorting?:string;stale?:boolean}|null;board?:Record<string,string>;compiledPreview?:WfScene;masterImages?:Record<string,string>};
type WfRect={x:number;y:number;width:number;height:number};
type WfPlacement={cell?:{x:number;y:number};mask:number;tileId?:string;origin?:{x:number;y:number};sourceRect?:WfRect;sources?:unknown[];[key:string]:unknown};
type WfIssue={code?:string;message?:string;severity?:string;cell?:{x:number;y:number}|null;mask?:number;sourceRect?:WfRect|null;[key:string]:unknown};
type WfScene={preview?:string;atlas?:string;issues?:WfIssue[];report?:Record<string,unknown>;placements?:WfPlacement[];[key:string]:unknown};
type WfResponse=WfState&{state?:WfState;cancelled?:boolean;path?:string;message?:string;scene?:WfScene;preview?:string;atlas?:string;report?:Record<string,unknown>;placements?:WfPlacement[];issues?:WfIssue[]};
declare global {interface Window {tilePipeline:{state():Promise<WfState>;action(name:string,payload?:unknown):Promise<WfResponse>};}}

const formCheckKeys=['assetType','sharedCamera','noForbiddenFaces','productionIntent'] as const;
const pressureCopy={off:'无额外压制：项目已批准基础风格仍有效。',standard:'标准：结构概括，按需保留极弱材质色差。',extreme:'极端概括：每种材质以两大明暗块面为主，减少亮边；不是整图限色。'};
function templateContract(template:unknown){return String(template??'').includes('STONE')?'F-STONE-EDGE-FRONT-v1':'F-GROUND-TOPDOWN-v1';}

/** Human form review is separate from file validity and legacy approval. */
export function formUiView(s:WfState){
 const legacy=s.legacyContract===true||Number(s.options?.protocolVersion)!==7;
 const contractId=templateContract(s.options?.templateId),stone=contractId==='F-STONE-EDGE-FRONT-v1';
 const mode=s.options?.stylePressure==='off'?'off':s.options?.stylePressure==='extreme'?'extreme':'standard';
 const selected=s.versions.find(v=>v.id===s.selectedSampleId),r=s.formReview;
 const checked=!legacy&&s.format==='locked'&&!!selected?.accepted&&selected.specHash===s.specHash&&r?.status==='conforms'&&!!r.trustedCurrent&&!r.stale&&r.sampleId===selected.id&&r.revision===selected.revision&&r.sha256===selected.sha256&&r.specHash===s.specHash&&formCheckKeys.every(k=>r.checks?.[k]===true);
 return {legacy,contractId,mode,checked,description:stone?'统一正交顶面 + 朝画面下方的固定前立面；四形态共用相机。':'严格正交俯视地表；只画平面与合法边缘，不出现草土立体台。',pressureDescription:pressureCopy[mode],reviewable:!legacy&&s.format==='locked'&&!!selected?.accepted&&(selected.specHash===s.specHash||!!s.gates?.canAdopt)};
}

/** Empty native state is new, while any saved configuration or history stays historical. */
export function isUntouchedWorkflow(s:WfState){
 const record=s as unknown as Record<string,unknown>;
 return s.stage==='FORMAT_DRAFT'&&s.format==='draft'&&Object.keys(s.options??{}).length===0&&!s.lockedSpec&&!s.specHash&&!s.approval&&!s.formReview&&!s.compiled&&['versions','references','requests','masters','outputs','history','approvalHistory','formReviewHistory'].every(k=>!record[k]||(Array.isArray(record[k])&&record[k].length===0));
}

export function formDraftIdentity(s:WfState){
 const selected=s.versions.find(v=>v.id===s.selectedSampleId);
 return [selected?.id??'',selected?.revision??'',selected?.sha256??'',s.specHash??''].join('|');
}

/** Derive desktop affordances from the exact frozen image identity, even if an old gate is returned. */
export function workflowView(s:WfState){
 const selected=s.versions.find(v=>v.id===s.selectedSampleId);
 const current=s.format==='locked'&&!!selected?.accepted&&selected.specHash===s.specHash;
 const a=s.approval;
 const form=formUiView(s),formAllowed=form.legacy||form.checked;
 const approved=current&&formAllowed&&!!a?.trustedCurrent&&!a.stale&&a.sampleId===selected?.id&&a.sha256===selected?.sha256&&a.specHash===s.specHash;
 const formalReady=approved&&!!s.gates?.formalReady;
 const exportReady=s.format==='locked'&&!!s.compiled&&!s.compiled.stale&&s.compiled.structureStatus==='passed';
 const suggestedStep=s.compiled&&!s.compiled.stale?5:formalReady?4:current?(formAllowed?(selected?.kind==='sample'?2:3):1):s.format==='locked'?1:0;
 return {selected,current,approved,formalReady,exportReady,suggestedStep,styleReady:current&&formAllowed&&!!s.gates?.styleReady,approveReady:current&&formAllowed,compileReady:s.format==='locked'&&!!s.gates?.compileReady};
}

function mountWorkflow(){
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 const api=window.tilePipeline;if(!api||!$('workflow-workspace'))return;
 let state:WfState={stage:'FORMAT_DRAFT',format:'draft',versions:[]},busy=false,dirty=false,step=0,lastScene:WfScene|null=null,active=false,draftTimer:ReturnType<typeof setTimeout>|undefined,draftRevision=0,lastCompiledId='',formDraftKey='';
 const versionsKinds:Record<string,string>={sample:'试制',style:'AI 收口',manual:'人工修订'};
 const stageNames:Record<string,string>={FORMAT_DRAFT:'格式草稿',FORMAT_LOCKED:'格式已锁定',SAMPLE_REQUEST_READY:'样品包已导出',SAMPLE_RECEIVED:'样品已返回',STYLE_REQUEST_READY:'收口包已导出',STYLE_RECEIVED:'风格图已返回',SAMPLE_APPROVED:'样品已明确批准',PRODUCTION_REQUEST_READY:'正式制作包已导出',MASTER_RECEIVED:'正式源图已返回',COMPILED:'已编译',STRUCTURE_CHECKED:'受测结构已检查',EXPORTED:'结果已导出',APPROVAL_REVOKED:'已撤销批准',MASTER_REJECTED:'源图被拒绝，原件已保留',STRUCTURE_FAILED:'结构检查失败',SAMPLE_REJECTED:'样品被拒绝，原件已保留',STYLE_REWORK_REQUESTED:'继续返工'};
 const status=(text:string,error=false)=>{const e=$('wf-status');e.textContent=text;e.dataset.error=String(error);};
 const image=(id:string,src?:string)=>{const e=$<HTMLImageElement>(id);if(src?.startsWith('data:image/png;base64,')||src?.startsWith('../resources/'))e.src=src;else e.removeAttribute('src');};
 const compact=(value:unknown)=>JSON.stringify(value,(key,value)=>key==='image'||key==='preview'||key==='atlas'||key==='png'?undefined:value,2);
 function showStep(next:number){step=next;document.querySelectorAll<HTMLButtonElement>('[data-wf-step]').forEach(b=>{if(Number(b.dataset.wfStep)===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});document.querySelectorAll<HTMLElement>('[data-wf-panel]').forEach(p=>p.hidden=Number(p.dataset.wfPanel)!==step);}
 function options(fresh=false){const templateId=$<HTMLSelectElement>('wf-template').value;return {templateId,strategy:$<HTMLSelectElement>('wf-strategy').value,cellPixels:Number($<HTMLInputElement>('wf-cell').value),ppu:Number($<HTMLInputElement>('wf-ppu').value),masterPixels:Number($<HTMLInputElement>('wf-master-size').value),description:$<HTMLTextAreaElement>('wf-description').value,...(fresh||!formUiView(state).legacy?{protocolVersion:7,viewContractId:templateContract(templateId),stylePressure:fresh?'standard':document.querySelector<HTMLInputElement>('[name="wf-pressure-format"]:checked')?.dataset.wfPressure??'standard'}:{})};}
 function pressureControls(mode:string){document.querySelectorAll<HTMLInputElement>('[data-wf-pressure]').forEach(e=>e.checked=e.dataset.wfPressure===mode);}
 function setOptions(){const o=state.options??{};for(const [id,key] of [['wf-template','templateId'],['wf-strategy','strategy'],['wf-cell','cellPixels'],['wf-ppu','ppu'],['wf-master-size','masterPixels'],['wf-description','description']]){const value=o[key];if(value!==undefined)$<HTMLInputElement>(id!).value=String(value);}pressureControls(formUiView(state).mode);}
 function checks():WfFormChecks{return Object.fromEntries(formCheckKeys.map(k=>[k,$<HTMLInputElement>(`wf-form-${k}`).checked])) as WfFormChecks;}
 function render(){
  const v=workflowView(state),form=formUiView(state),locked=state.format==='locked'&&!dirty,selected=v.selected,classic=state.options?.strategy==='layered'||state.options?.strategy==='layered-classic';
  $('wf-task-title').textContent=state.title||'新的联通素材任务';$('wf-stage').textContent=dirty?'格式已改变，需重新锁定':stageNames[state.stage]??state.stage;
  $('wf-legacy-contract').hidden=!form.legacy;$<HTMLButtonElement>('wf-upgrade-contract').disabled=busy||dirty;
  $('wf-view-description').textContent=form.description;$('wf-view-identity').textContent=`${form.legacy?'历史工程预览，不是已认证契约 · ':''}${form.contractId} · 候选 · Unity 排序未验证`;
  for(const id of ['wf-sample-contract','wf-style-contract'])$(id).textContent=`${form.contractId} · ${form.description} ${form.legacy?'历史工程：未认证新形式契约。':form.pressureDescription}`;
  for(const id of ['wf-pressure-format-description','wf-pressure-style-description'])$(id).textContent=form.legacy?'历史工程保留原语义；明确升级后可使用本任务压制档位。':form.pressureDescription;
  document.querySelectorAll<HTMLInputElement>('[data-wf-pressure]').forEach(e=>e.disabled=busy||form.legacy);
  $('wf-form-review').hidden=form.legacy;
  const reviewKey=formDraftIdentity(state);if(formDraftKey!==reviewKey){formDraftKey=reviewKey;for(const k of formCheckKeys)$<HTMLInputElement>(`wf-form-${k}`).checked=form.checked&&state.formReview?.checks?.[k]===true;}
  for(const k of formCheckKeys)$<HTMLInputElement>(`wf-form-${k}`).disabled=busy||dirty||!form.reviewable;
  $<HTMLButtonElement>('wf-review-form').disabled=busy||dirty||!form.reviewable||!formCheckKeys.every(k=>checks()[k]);
  $<HTMLButtonElement>('wf-reject-form').disabled=busy||dirty||!selected?.accepted||!locked||!$<HTMLTextAreaElement>('wf-form-rejection-notes').value.trim();
  $('wf-form-review-status').textContent=form.checked?(selected?.testOnly?'技术夹具：四项核对流程已记录，不是实际美术认可。':'当前准确版本：四项已由用户核对。'):state.formReview?.status==='rejected'&&!state.formReview.stale?`形式已拒绝：${state.formReview.notes??'需回到样品重做'}。`:'四项尚未全部人工核对；不能进入风格收口或批准。';
  if(selected?.accepted&&selected.specHash!==state.specHash&&!form.legacy)$('wf-form-review-status').textContent+=' 保存核对时将以相同原图字节建立当前规格的新版本，旧版本保留。';
  $('wf-format-json').textContent=JSON.stringify(state.lockedSpec??state.options??{},null,2);
  const cell=Number(state.options?.cellPixels??128),ppu=Number(state.options?.ppu??100);
  $('wf-format-summary').textContent=`${locked?'已锁定':'草稿'} · 逻辑格 ${cell}px / ${ppu}PPU = ${Number((cell/ppu).toFixed(4))} 世界单位。${classic?'经典四区取样语义保留。':'多贴片与限定轮廓为原创候选。'}${state.specHash?' 规格 '+state.specHash.slice(0,12):''}`;
  const enabled:Record<string,boolean>={'wf-request-sample':locked&&!!state.gates?.sampleReady,'wf-import-sample':locked,'wf-paste-sample':locked,'wf-request-style':locked&&v.styleReady,'wf-import-style':locked&&v.styleReady,'wf-paste-style':locked&&v.styleReady,'wf-import-manual':locked&&v.current,'wf-paste-manual':locked&&v.current,'wf-approve':locked&&v.approveReady,'wf-rework':!!selected,'wf-revoke':!!state.approval&&!state.approval.stale,'wf-request-formal':locked&&v.formalReady,'wf-import-materials':locked&&v.formalReady,'wf-paste-materials':locked&&v.formalReady,'wf-import-contour':locked&&v.formalReady&&!classic,'wf-paste-contour':locked&&v.formalReady&&!classic,'wf-compile':locked&&v.compileReady,'wf-export-compiled':locked&&v.exportReady};
  for(const [id,can]of Object.entries(enabled))$<HTMLButtonElement>(id).disabled=busy||!can;
  for(const id of ['wf-new','wf-open','wf-save'])$<HTMLButtonElement>(id).disabled=busy||dirty;$<HTMLButtonElement>('wf-lock').disabled=busy;
  const savedReferences=state.references??[];$('wf-saved-reference-count').textContent=`${savedReferences.length} / 8`;$('wf-no-saved-references').hidden=savedReferences.length>0;$<HTMLButtonElement>('wf-clear-references').disabled=busy||savedReferences.length===0;
  const refsList=$('wf-saved-references');refsList.replaceChildren();for(const ref of savedReferences){const card=document.createElement('article');card.className='wf-saved-reference';card.dataset.refId=ref.refId;const thumb=document.createElement('img');thumb.alt=ref.sourceName??'已保存参考 PNG';if(ref.image?.startsWith('data:image/png;base64,'))thumb.src=ref.image;const info=document.createElement('div'),name=document.createElement('strong'),role=document.createElement('span'),identity=document.createElement('small'),note=document.createElement('p');name.textContent=ref.sourceName||'参考 PNG';role.textContent=ref.role==='content'?'内容参考':ref.role==='style'?'风格参考':`未知角色：${ref.role}`;identity.textContent=`${ref.refId} · ${ref.width??'?'}×${ref.height??'?'} px · ${ref.fileBytes??'?'} bytes · SHA256 ${ref.sha256}`;note.textContent=ref.note||'未补充说明';info.append(name,role,identity,note);card.append(thumb,info);refsList.append(card);}
  $<HTMLInputElement>('wf-cell').max=classic?'512':'256';
  $('wf-approval-state').textContent=v.approved?`${form.legacy?'历史协议批准 · 新形式未认证 · ':''}${state.approval?.testOnly?'技术夹具批准，不是用户美术认可':'当前正式样品'}：第 ${selected?.revision} 版 · SHA ${selected?.sha256.slice(0,12)}。`:'当前没有与选中版本及格式一致的有效批准；旧批准记录继续保留。';
  $('wf-formal-gate').textContent=v.formalReady?`制作依据：第 ${selected?.revision} 版 · ${selected?.sha256.slice(0,12)}。${state.approval?.testOnly?'测试夹具路径，仅验证技术流程。':'携带此版本的实际原图。'}`:state.gates?.reason||'先选中并明确批准当前格式的样品，才能导出正式制作包。';
  $('wf-master-instructions').textContent=classic?`返回一张 ${state.options?.masterPixels??1254}×${state.options?.masterPixels??1254}px 经典母版；不缩放，不修改切割窗。`:`按制作包逐一返回 materials.png（${cell*4}×${cell*2}px）与 contour.png（${cell*2}×${cell}px）。两张齐全后再编译，不拉伸或替代缺层。`;
  $('wf-import-materials').textContent=classic?'导入经典母版 PNG':'导入材质 PNG';$('wf-paste-materials').textContent=classic?'粘贴经典母版':'粘贴材质图';
  for(const id of ['wf-import-contour','wf-paste-contour'])$(id).hidden=classic;
  $('wf-version-count').textContent=`${state.versions.length} 版`;$('wf-no-versions').hidden=state.versions.length>0;
  const list=$('wf-versions');list.replaceChildren();for(const item of [...state.versions].reverse()){
   const b=document.createElement('button');b.type='button';b.className='wf-version';b.dataset.invalid=String(!item.accepted);b.setAttribute('aria-pressed',String(item.id===selected?.id));b.disabled=busy;
   const thumb=document.createElement('img');thumb.alt=`第 ${item.revision} 版`;if(item.image?.startsWith('data:image/png;base64,'))thumb.src=item.image;
   const copy=document.createElement('span');copy.className='wf-version-copy';const label=document.createElement('strong');label.textContent=`v${item.revision} · ${versionsKinds[item.kind]??item.kind}${item.testOnly?' · 测试夹具':''}${item.id===state.approval?.sampleId?(v.approved?' · 已批准':' · 历史批准'):''}`;
   const detail=document.createElement('small');detail.textContent=`${item.width}×${item.height} · ${item.sha256.slice(0,10)}${item.accepted?'':' · 导入失败'}${item.specHash!==state.specHash?' · 旧格式':''}`;copy.append(label,detail);b.append(thumb,copy);b.onclick=()=>void action('select',{id:item.id},undefined,'已选中原始版本；批准不会自动转移。');list.append(b);
  }
  const parent=state.versions.find(p=>p.id===selected?.parentId);image('wf-parent-image',parent?.image);image('wf-selected-image',selected?.image);$('wf-parent-caption').textContent=parent?`父版本 v${parent.revision}`:'没有父版本';$('wf-selected-caption').textContent=selected?`当前 v${selected.revision}`:'尚未选中样品';
  const meta=$('wf-version-meta');meta.replaceChildren();if(selected)for(const [key,value]of [['版本',`${selected.id} · v${selected.revision}`],['尺寸',`${selected.width}×${selected.height}px · ${selected.fileBytes??'?'} bytes`],['来源',typeof selected.source==='string'?selected.source:JSON.stringify(selected.source??{})],['SHA256',selected.sha256],['父版本',selected.parentId??'首次返回'],['状态',selected.error??(selected.specHash!==state.specHash?'旧格式，可作参考；需重新导入与批准':selected.accepted?'文件校验通过，视觉待确认':'失败原件已归档')]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;meta.append(dt,dd);}
  $('wf-history').textContent=compact({taskId:state.taskId,references:state.references,formReview:state.formReview,formReviewHistory:state.formReviewHistory,approval:state.approval,approvalHistory:state.approvalHistory,requests:state.requests,masters:state.masters,compiled:state.compiled,lastError:state.lastError});
  let materialsImage:string|undefined,contourImage:string|undefined;
  const files=$('wf-master-files');files.replaceChildren();for(const m of state.masters??[]){const o=m as Record<string,unknown>;const entries=o.files as Record<string,{role?:string;width?:number;height?:number;sha256?:string;image?:string}>|undefined;
   for(const [role,file]of Object.entries(entries??{})){const li=document.createElement('li');li.textContent=`${o.stale?'旧产出 · ':''}${o.accepted?'已接收':o.pending?'待补齐层图':'原件记录'} · ${role} ${file.width??'?'}×${file.height??'?'}px · SHA ${file.sha256?.slice(0,12)??'?'}${o.error?' · '+o.error:''}`;files.append(li);if(!o.stale&&!o.error){if(role==='contour')contourImage=file.image;else materialsImage=file.image;}}
   if(o.error&&!entries){const li=document.createElement('li');li.textContent=`失败原件 · ${String(o.error)}`;files.append(li);}
  }
  const board=state.board??{};image('wf-materials-image',state.masterImages?.materials??state.masterImages?.master??materialsImage??board.materialsGuide??board.guide??board.blank);image('wf-contour-image',state.masterImages?.contour??contourImage??board.contourGuide);image('wf-format-guide',board.materialsGuide??board.guide??board.blank);image('wf-format-contour-guide',board.contourGuide);
  image('wf-sample-guide',board.sampleGuide??`../resources/tile-templates/${String(state.options?.templateId??'').includes('STONE')?'stone':'grass'}-paint-guide.png`);image('wf-view-guide',board.viewGuide??`../resources/tile-templates/${String(state.options?.templateId??'').includes('STONE')?'stone':'grass'}-view-guide.png`);
  $('wf-compile-summary').textContent=state.compiled?`${state.compiled.stale?'旧产出已失效 · ':''}${state.compiled.tiles??47}/47 状态 · 结构${state.compiled.structureStatus==='passed'?'受测通过':state.compiled.structureStatus==='failed'?'失败':'待检查'} · 形式${form.checked?'已人工核对':form.legacy?'历史协议 / 新契约待核对':'待人工核对'} · 人工美术待验 · Unity 排序未验证。`:'尚无当前有效编译结果。形式与美术由人核对，Unity 排序未验证。';
  if(state.compiledPreview&&(!lastScene||lastCompiledId!==state.compiled?.id))scene(state.compiledPreview);if(!state.compiled||state.compiled.stale){lastScene=null;lastCompiledId='';image('wf-world');image('wf-atlas');$('wf-world-labels').replaceChildren();$('wf-issues').replaceChildren();}
 }
 async function action(name:string,payload?:unknown,next?:number,message?:string){if(busy)return;const revisionAtStart=draftRevision;busy=true;render();try{
  const r=await api.action(name,payload);if(r.state)state=r.state;else if(Array.isArray(r.versions))state=r;else state=await api.state();
  if(name==='configure'||name==='lock'||name==='new'||name==='openProject'||name==='upgrade-contract'){if(revisionAtStart===draftRevision){dirty=false;setOptions();}}
  if(name==='reject-form'||name==='review-form'||name==='upgrade-contract'||name==='openProject')formDraftKey='';
  if(r.scene)scene(r.scene);else if(r.preview)scene(r);
  if(!r.cancelled&&next!==undefined)showStep(next);
  status(r.cancelled?'已取消；现有任务与原件保留。':r.path?`已校验并保存：${r.path}`:r.message||message||state.lastError||'当前阶段已保存。',!!state.lastError);
 }catch(e){try{state=await api.state();}catch{}status(e instanceof Error?e.message:String(e),true);}finally{busy=false;render();}}
 function scene(r:WfScene){lastScene=r;lastCompiledId=state.compiled?.id??'';image('wf-world',r.preview);image('wf-atlas',r.atlas);$('wf-report').textContent=compact(r.report??r);$('wf-issues').replaceChildren();const issues=r.issues??(Array.isArray(r.report?.issues)?r.report.issues as WfIssue[]:[]);for(const issue of issues){const li=document.createElement('li');const hard=issue.severity==='hard-fail'||issue.severity==='hard';li.dataset.severity=hard?'hard-fail':issue.severity??'warning';const b=document.createElement('button');b.type='button';b.textContent=`${hard?'失败':issue.severity==='human-check'?'人工检查':'提醒'} · ${issue.cell?`地图 (${issue.cell.x},${issue.cell.y}) → `:''}${issue.mask!==undefined?`mask ${issue.mask} → `:''}${issue.message??issue.code??'检查报告'}`;b.onclick=()=>source(issue);li.append(b);$('wf-issues').append(li);}labels();}
 function highlightSource(rect:WfRect,role='materials'){for(const id of ['wf-source-highlight','wf-contour-highlight'])$(id).hidden=true;const img=$<HTMLImageElement>(role==='contour'?'wf-contour-image':'wf-materials-image'),highlight=$(role==='contour'?'wf-contour-highlight':'wf-source-highlight'),width=img.naturalWidth,height=img.naturalHeight;if(width&&height){highlight.hidden=false;Object.assign(highlight.style,{position:'absolute',pointerEvents:'none',border:'2px solid #cba469',left:`${rect.x/width*100}%`,top:`${rect.y/height*100}%`,width:`${rect.width/width*100}%`,height:`${rect.height/height*100}%`});}}
 function source(item:Record<string,unknown>){showStep(4);const selected=workflowView(state).selected;const approved=item.approvedSample as {revision?:number;sha256?:string}|undefined;const rect=item.sourceRect as WfRect|undefined;const cell=item.cell as {x:number;y:number}|undefined;$('wf-source-selection').textContent=`${cell?`地图 (${cell.x},${cell.y}) → `:''}mask ${item.mask??'?'} → ${item.filename??item.tileId??item.id??'正式 PNG'} → ${rect?`取样区 (${rect.x},${rect.y}) ${rect.width}×${rect.height}px`:'结构层与多贴片来源见报告'} → 样品 v${approved?.revision??selected?.revision??'?'} / ${approved?.sha256?.slice(0,12)??selected?.sha256.slice(0,12)??'未知'}。`;
  const patches=$('wf-source-patches');patches.replaceChildren();const sources=(item.sourcePatches??item.sources) as (WfRect&{role?:string;id?:string;sha256?:string})[]|undefined;if(sources?.length){for(const patch of sources){const b=document.createElement('button');b.type='button';b.textContent=`${patch.id??patch.role} (${patch.x},${patch.y}) ${patch.width}×${patch.height}`;b.title=`SHA ${patch.sha256??'见报告'}`;b.onclick=()=>highlightSource(patch,patch.role==='contour'||patch.id?.startsWith('contour-')?'contour':'materials');patches.append(b);}highlightSource(sources[0]!,sources[0]?.role==='contour'?'contour':'materials');}else if(rect)highlightSource(rect);
  const details=$('wf-materials-image').closest('details');if(details)details.open=true;
 }
 function labels(){const host=$('wf-world-labels');host.replaceChildren();if(!$<HTMLInputElement>('wf-labels').checked)return;const img=$<HTMLImageElement>('wf-world'),cell=Number(state.options?.cellPixels??128);if(!img.naturalWidth)return;for(const p of lastScene?.placements??[]){if(!p.origin)continue;const b=document.createElement('button');b.type='button';b.className='wf-map-label';b.textContent=`${p.mask} / ${p.tileId??''}`;Object.assign(b.style,{left:`${p.origin.x/img.naturalWidth*100}%`,top:`${p.origin.y/img.naturalHeight*100}%`,width:`${cell/img.naturalWidth*100}%`});b.onclick=()=>source(p);host.append(b);}}
 async function preview(){if(!state.compiled||state.compiled.stale)return;await action('scene',{scene:$<HTMLSelectElement>('wf-scene').value,mask:Number($<HTMLInputElement>('wf-neighbor').value),underlay:$<HTMLInputElement>('wf-underlay').checked,grid:$<HTMLInputElement>('wf-grid').checked,pivot:$<HTMLInputElement>('wf-pivot').checked,alpha:$<HTMLInputElement>('wf-alpha').checked,overhang:$<HTMLInputElement>('wf-overhang').checked,sort:$<HTMLSelectElement>('wf-sort').value},undefined,'回拼视图已更新；结构与美术验收分别记录。');}
 async function lock(){if(busy)return;clearTimeout(draftTimer);await action('configure',options());if(state.format==='draft'&&!state.lastError)await action('lock',{},1,'格式已锁定。现在可导出少量样品任务。');}
 function enter(){active=true;document.body.classList.remove('tile-active');document.body.classList.add('workflow-active');$('workflow-workspace').hidden=false;for(const id of ['ordinary-flow','tile-flow','workflow-flow'])$(id)?.setAttribute('aria-pressed',String(id==='workflow-flow'));const refs=$('reference-panel');if(refs)$('workflow-refs-host').append(refs);render();}
 function leave(){active=false;document.body.classList.remove('workflow-active');$('workflow-workspace').hidden=true;$('workflow-flow')?.setAttribute('aria-pressed','false');}
 $('workflow-flow')?.addEventListener('click',enter);$('ordinary-flow')?.addEventListener('click',leave);$('tile-flow')?.addEventListener('click',leave);
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-wf-step]'))button.onclick=()=>showStep(Number(button.dataset.wfStep));
 $('wf-lock').onclick=()=>void lock();$('wf-new').onclick=()=>void action('new',{options:options(true)},0,'新任务已建立，默认标准压制；旧工程原件继续保留。');$('wf-save').onclick=()=>void action('saveProject');$('wf-open').onclick=()=>void action('openProject');
 $('wf-upgrade-contract').onclick=()=>{if(window.confirm('升级到新视角契约将建立规格修订，使旧批准、生成请求与正式产出失效。原图和旧版本保留；需要重新人工核对并批准。是否明确升级？'))void action('upgrade-contract',{},0,'已明确升级；原始字节保留，按新形式重新核对。');};
  $('wf-clear-references').onclick=()=>void action('clearReferences',{},undefined,'已清空添加区及本工程保存的参考；后续任务 ZIP 不再携带这些图片。原始 PNG 不被删除。');
 const saveDraft=()=>{if(busy){draftTimer=setTimeout(saveDraft,350);return;}void action('configure',options(),undefined,'格式草稿已保存；旧批准与产出已失效，原图继续保留。');};
 for(const id of ['wf-template','wf-strategy','wf-cell','wf-ppu','wf-master-size','wf-description'])$(id).oninput=()=>{dirty=true;draftRevision++;clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,350);render();status('格式已改变。草稿即将保存；重新锁定后继续，原图不被覆盖。');};
 async function changePressure(mode:string){if(busy){pressureControls(formUiView(state).mode);return;}if(mode===formUiView(state).mode)return;if(state.approval&&!state.approval.stale&&!window.confirm('改变风格压制会产生新的任务规范修订，使当前生成请求、人工批准与正式产物失效；历史原图保留。切回原模式也不会恢复批准。是否继续？')){pressureControls(formUiView(state).mode);return;}const wasLocked=state.format==='locked';pressureControls(mode);dirty=true;draftRevision++;clearTimeout(draftTimer);render();await action('configure',options());if(wasLocked&&state.format==='draft'&&!state.lastError)await action('lock',{},undefined,'压制档位已更改，旧批准已失效；原图保留，请重新人工核对当前规格。');}
 document.querySelectorAll<HTMLInputElement>('[data-wf-pressure]').forEach(e=>e.onchange=()=>{if(e.checked)void changePressure(e.dataset.wfPressure!);});
 for(const k of formCheckKeys)$(`wf-form-${k}`).onchange=()=>render();
 $('wf-form-rejection-notes').oninput=()=>render();
 $('wf-review-form').onclick=()=>void action('review-form',{explicit:true,checks:checks(),notes:'用户逐项看图确认本模板形式'},undefined,'当前版本形式已由你逐项确认；这仍不是美术或 Unity 排序验收。');
 $('wf-reject-form').onclick=()=>void action('reject-form',{explicit:true,notes:$<HTMLTextAreaElement>('wf-form-rejection-notes').value.trim()},1,'形式诊断已保存。已回到样品步骤；导出新样品任务重新试制，不使用风格收口修饰错误结构。');
 $('wf-request-sample').onclick=()=>void action('request',{stage:'sample'},undefined);$('wf-request-style').onclick=()=>void action('request',{stage:'style',purpose:$<HTMLTextAreaElement>('wf-refine-notes').value});$('wf-request-formal').onclick=()=>void action('request',{stage:'formal'});
 const importSample=(kind:string,method:string)=>action('importSample',{kind,method,purpose:kind==='style'?$<HTMLTextAreaElement>('wf-refine-notes').value:kind==='manual'?'人工修正回传':'少量样品'},kind==='manual'?3:formUiView(state).legacy?2:1,'原始 PNG 已归档为新版本；先人工核对形式，未自动批准。');
 for(const kind of ['sample','style','manual']){ $(`wf-import-${kind}`).onclick=()=>void importSample(kind,'file');$(`wf-paste-${kind}`).onclick=()=>void importSample(kind,'clipboard');}
 for(const box of document.querySelectorAll<HTMLElement>('[data-wf-import]'))box.onkeydown=e=>{if(e.ctrlKey&&e.key.toLowerCase()==='v'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){e.preventDefault();const kind=box.dataset.wfImport!;if(kind==='materials')void action('importMaster',{method:'clipboard',role:state.options?.strategy==='layered'?'master':'materials'});else void importSample(kind,'clipboard');}};
 for(const role of ['materials','contour']){const payload=(method:string)=>({method,role:role==='materials'&&state.options?.strategy==='layered'?'master':role});$(`wf-import-${role}`).onclick=()=>void action('importMaster',payload('file'));$(`wf-paste-${role}`).onclick=()=>void action('importMaster',payload('clipboard'));}
 const dialog=$<HTMLDialogElement>('wf-approve-dialog');$('wf-approve').onclick=()=>{const v=workflowView(state),selected=v.selected,form=formUiView(state);if(!selected||dirty||!v.approveReady)return;image('wf-confirm-image',selected.image);$('wf-confirm-identity').textContent=`${selected.testOnly?'测试夹具，仅验证批准机制。 ':''}v${selected.revision} · ${selected.width}×${selected.height}px · ${state.options?.templateId} · SHA256 ${selected.sha256} · 规格 ${state.specHash}`;$('wf-confirm-form').textContent=form.legacy?'历史 v6 批准；未认证本轮新视角契约。':`${form.contractId} · ${form.description} ${form.pressureDescription} 四项形式检查：已由用户明确核对。`;dialog.showModal();};$('wf-cancel-approve').onclick=()=>dialog.close();$('wf-confirm-approve').onclick=()=>{dialog.close();if(!workflowView(state).approveReady||dirty)return;void action('approve',{sampleId:state.selectedSampleId,explicit:true,notes:$<HTMLTextAreaElement>('wf-approval-notes').value},4,'当前准确版本已明确批准；新修订仍需重新批准。');};
 $('wf-revoke').onclick=()=>void action('revoke',{notes:'用户在人工定稿步骤撤销批准'},3,'批准已撤销，旧正式任务和产出标记失效。');$('wf-rework').onclick=()=>{if(state.approval&&!state.approval.stale)void action('revoke',{notes:'退回继续修改'},2,'已退回继续修改，原图与旧产出保留。');else{showStep(2);status('继续修订选中版本，原图不会被覆盖。');}};
 $('wf-compile').onclick=()=>void action('compile',{},5,'已生成真实 47 状态；检查报告不等于美术验收。');$('wf-export-compiled').onclick=()=>void action('exportCompiled');
 for(const id of ['wf-scene','wf-neighbor','wf-underlay','wf-grid','wf-pivot','wf-alpha','wf-overhang','wf-sort'])$(id).onchange=()=>void preview();$('wf-labels').onchange=labels;$<HTMLImageElement>('wf-world').onload=labels;
 $('wf-world').onclick=e=>{const img=e.currentTarget as HTMLImageElement,rect=img.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*img.naturalWidth,y=(e.clientY-rect.top)/rect.height*img.naturalHeight,c=Number(state.options?.cellPixels??128);const p=lastScene?.placements?.find(p=>p.origin&&x>=p.origin.x&&y>=p.origin.y&&x<p.origin.x+c&&y<p.origin.y+c);if(p)source(p);};
 busy=true;$<HTMLButtonElement>('wf-lock').disabled=true;
 void api.state().then(async s=>{state=s;const fresh=isUntouchedWorkflow(s);if(fresh){const r=await api.action('configure',options(true));state=r.state??r;}setOptions();showStep(workflowView(state).suggestedStep);busy=false;render();status(state.lastError||(fresh?'新的视角契约草稿已建立，默认标准压制。':'本机任务已恢复。按当前步骤继续，旧版本保留。'),!!state.lastError);if(active)enter();}).catch(e=>{busy=false;render();status(e instanceof Error?e.message:String(e),true);});
}
if(typeof document!=='undefined')mountWorkflow();
