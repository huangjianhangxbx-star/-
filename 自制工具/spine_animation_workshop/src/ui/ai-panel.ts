import type { SpineObjectMapping } from '../core/spine-contracts.ts';
import type { SpineMigrationReport } from '../transfer/spine-timelines.ts';
import type { AiBundle, AiRigInput, AiReviewState, AiReviewedProposal, AiCandidateGroup } from '../analysis/ai-contracts.ts';
import type { RigSelection } from '../analysis/rig-profile.ts';
import { createAiBundle, createAiSurveyBundle, stableAiJson } from '../analysis/ai-bundle.ts';
import { parseAiProposal, parseAiSurveyReply, mergeAcceptedAiMappings } from '../analysis/ai-proposal.ts';
import { createAnalysisDiagnostics } from '../analysis/analysis-diagnostics.ts';
import { mappingWithinBundle, restoreAiReview, restoreAiAnalysis, acceptedAiCandidateIds } from '../analysis/ai-session.ts';
import { discoverRigReferences } from '../analysis/rig-discovery.ts';

type Pair = {source:Omit<AiRigInput,'selection'>;target:Omit<AiRigInput,'selection'>;sourceResourceId:string;targetResourceId:string};
type Hooks = {
  pair:()=>Pair|null; animation:()=>string; mappings:()=>readonly SpineObjectMapping[];
  state:(state:AiReviewState|undefined)=>void;
  commit:(mappings:SpineObjectMapping[],state:AiReviewState)=>void;
  selection:(selection:{source:RigSelection;target:RigSelection}|null)=>void;
};
const node = <T extends HTMLElement>(id:string):T => {
  const result=document.getElementById(id); if(!result) throw new Error(`Missing #${id}`); return result as T;
};
const text = (tag:string,value:string,className='') => {const item=document.createElement(tag);item.textContent=value;item.className=className;return item;};
const errorText = (error:unknown)=>error instanceof Error?error.message:String(error);
const groups:Record<AiCandidateGroup,string>={torso:'躯干',leftArm:'左臂',rightArm:'右臂',leftLeg:'左腿',rightLeg:'右腿',control:'控制器',decoration:'装饰',display:'显示与事件'};
const lines=(value:string)=>[...new Set(value.split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean))];

/** UI for a local, reviewable file exchange. No AI service is called from the renderer. */
export class SpineAiPanel {
  private bundle:AiBundle|null=null;
  private reviewed:AiReviewedProposal|null=null;
  private acceptedIds:string[]=[];
  private withdrawnIds:string[]=[];
  private exportRef:{directory:string;exportId:string}|null=null;
  private report:SpineMigrationReport|null=null;
  private referencesDirty=false;
  private appliedSecondReference='';
  private derivedFromBundleId:string|undefined;
  private revision=0;
  constructor(private hooks:Hooks){
    node('ai-apply-selection').addEventListener('click',()=>this.run(()=>{
      try{this.build();this.say('方向与身体参考已应用。仅当前分支和明确共享控制骨参与迁移。');}
      catch(error){this.revealSettings();throw error;}
    }));
    node('ai-second-animation').addEventListener('change',()=>{this.referencesDirty=node<HTMLSelectElement>('ai-second-animation').value!==this.appliedSecondReference;});
    node('ai-preview-body').addEventListener('click',()=>void this.run(()=>{
      const ids=this.reviewed?.candidates.filter(candidate=>this.bodyCandidate(candidate)&&!this.acceptedIds.includes(candidate.id)&&!this.withdrawnIds.includes(candidate.id)).map(candidate=>candidate.id)??[];
      this.accept(ids);node<HTMLButtonElement>('generate').click();
    }));
    node('ai-export').addEventListener('click',()=>void this.run(async()=>{
      const pair=this.hooks.pair();if(!pair)throw new Error('请先载入来源和目标工程');
      const bundle=this.bundle&&!this.bundle.manifest.referenceMode?this.bundle:this.survey();
      const revision=this.revision;
      this.say('正在写入本机分析包…');
      const result=await window.spw.writeAiFiles({sourceResourceId:pair.sourceResourceId,targetResourceId:pair.targetResourceId,kind:'bundle',bundleId:bundle.manifest.bundleId,files:bundle.files});
      if(revision!==this.revision || !result)return;
      this.exportRef=result; node('ai-directory').textContent=result.directory;
      node<HTMLButtonElement>('ai-open-folder').disabled=false;node<HTMLButtonElement>('ai-copy-prompt').disabled=false;
      this.say('分析包已生成，无需填写参考骨。复制给 Codex 的指令交给 AI 判断；返回后选择 mapping-proposal.json。');
    }));
    node('ai-import').addEventListener('click',()=>void this.run(async()=>{
      const revision=this.revision;
      const result=await window.spw.openAiResult();if(!result || revision!==this.revision)return;
      const pair=this.hooks.pair();if(!pair)throw new Error('请先载入对应来源和目标工程');
      const context=result.manifestText?restoreAiAnalysis(JSON.parse(result.manifestText.replace(/^\uFEFF/,'')),pair):this.bundle;
      if(!context)throw new Error('回传目录缺少 manifest.json，请与原分析包放在同一目录，或先生成分析包');
      const parsed=context.manifest.referenceMode==='automatic-survey'
        ?parseAiSurveyReply(result.proposalText,context,result.hintsText,pair)
        :{bundle:context,reviewed:parseAiProposal(result.proposalText,context,result.hintsText),derivedFromBundleId:context.manifest.bundleId===this.bundle?.manifest.bundleId?this.derivedFromBundleId:undefined};
      const previous=this.selections()??null;
      try{this.hooks.selection({source:parsed.bundle.manifest.sourceSelection,target:parsed.bundle.manifest.targetSelection});}
      catch(error){try{this.hooks.selection(previous);}catch{/* Keep the last valid preview if available. */}throw error;}
      const previousReview=this.reviewed,previousWithdrawn=this.withdrawnIds;
      this.acceptedIds=acceptedAiCandidateIds(this.hooks.mappings(),parsed.reviewed,parsed.bundle.manifest.bundleId);
      this.withdrawnIds=parsed.reviewed.candidates.filter(candidate=>!this.acceptedIds.includes(candidate.id)&&previousReview?.proposal.bundleId===parsed.reviewed.proposal.bundleId&&previousReview.candidates.some(old=>previousWithdrawn.includes(old.id)&&stableAiJson(old.mapping)===stableAiJson(candidate.mapping)&&old.semanticRole===candidate.semanticRole)).map(candidate=>candidate.id);
      this.bundle=parsed.bundle;this.reviewed=parsed.reviewed;this.derivedFromBundleId=parsed.derivedFromBundleId;
      this.referencesDirty=false;this.revision++;
      this.fill('source',this.bundle.manifest.sourceSelection);this.fill('target',this.bundle.manifest.targetSelection);
      this.appliedSecondReference=node<HTMLSelectElement>('ai-second-animation').value;
      this.coordinates();this.describe();this.persist();this.render();
      this.say(`AI 已给出两端方向和身体参考，${parsed.reviewed.candidates.length} 项映射候选、${parsed.reviewed.unresolved.length} 项待确认。无需填写高级表单，接受所需身体骨链即可预览。`);
    }));
    for(const[id,action]of [['ai-open-folder','open'],['ai-copy-prompt','copy']]as const)node(id).addEventListener('click',()=>void this.run(async()=>{
      if(this.exportRef)await window.spw.aiAction(this.exportRef.exportId,action);
      if(action==='copy')this.say('给 Codex 的指令已复制，粘贴到当前聊天即可。');
    }));
    node('ai-withdraw').addEventListener('click',()=>{
      if(!this.reviewed)return;
      this.withdrawnIds=this.reviewed.candidates.filter(candidate=>!this.acceptedIds.includes(candidate.id)).map(candidate=>candidate.id);
      this.persist();this.render();this.say(`已撤回 ${this.withdrawnIds.length} 项未接受候选，保留 ${this.acceptedIds.length} 项接受记录和现有映射。`);
    });
    node('ai-diagnostics').addEventListener('click',()=>void this.run(async()=>{
      if(!this.bundle || !this.report)return;
      const pair=this.hooks.pair();if(!pair)return;
      const result=createAnalysisDiagnostics({bundle:this.bundle,report:this.report,...(this.reviewed?{reviewed:this.reviewed}:{}),acceptedIds:this.acceptedIds});
      const saved=await window.spw.writeAiFiles({sourceResourceId:pair.sourceResourceId,targetResourceId:pair.targetResourceId,kind:'diagnostics',bundleId:this.bundle.manifest.bundleId,files:result.files});
      if(saved)this.say(`诊断与修整请求已导出：${saved.directory}`);
    }));
    this.reset();
  }
  private async run(action:()=>unknown|Promise<unknown>){try{await action();}catch(error){this.say(`AI 协作未完成：${errorText(error)}`,true);}}
  private say(message:string,error=false){node('ai-status').textContent=message;node('ai-status').classList.toggle('error',error);}
  private revealSettings(){
    node<HTMLDetailsElement>('ai-rig-settings').open=true;
    node('ai-source-root').focus();node('ai-rig-settings').scrollIntoView({block:'nearest'});
  }
  private survey():AiBundle {
    const pair=this.hooks.pair();if(!pair)throw new Error('请先载入来源和目标工程');
    const animations=[...new Set([this.hooks.animation(),node<HTMLSelectElement>('ai-second-animation').value].filter(Boolean))];
    const bundle=createAiSurveyBundle({...pair,animations,toolVersion:'0.3.2'});
    this.bundle=bundle;this.reviewed=null;this.acceptedIds=[];this.withdrawnIds=[];this.derivedFromBundleId=undefined;this.revision++;
    this.describe();this.persist();this.render();return bundle;
  }
  private state():AiReviewState {if(!this.bundle)throw new Error('请先生成分析包');return{reviewSchema:'spw.ai.review.v1',manifest:this.bundle.manifest,...(this.reviewed?{proposal:this.reviewed.proposal,...(this.reviewed.hints?{hints:this.reviewed.hints}:{})}:{}),acceptedIds:[...this.acceptedIds],...(this.withdrawnIds.length?{withdrawnIds:[...this.withdrawnIds]}:{}),...(this.derivedFromBundleId?{derivedFromBundleId:this.derivedFromBundleId}:{})};}
  private persist(){if(this.bundle)this.hooks.state(this.state());}
  private fill(side:'source'|'target',selection?:RigSelection){
    const rig=this.hooks.pair()?.[side];
    const bones=(rig?.document as {bones?:{name:string;parent?:string}[]}|undefined)?.bones??[];
    const options=(selected:string,optional=false)=>[...(optional?['']:[]),...bones.map(b=>b.name)].map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value||'不指定';option.selected=value===selected;return option;});
    node<HTMLSelectElement>(`ai-${side}-root`).replaceChildren(...options(selection?.directionRoot??bones[0]?.name??''));
    node<HTMLSelectElement>(`ai-${side}-anchor`).replaceChildren(...options(selection?.bodyAnchor??bones[0]?.name??''));
    node<HTMLSelectElement>(`ai-${side}-ground`).replaceChildren(...options(selection?.groundAnchor??'',true));
    node<HTMLInputElement>(`ai-${side}-direction`).value=selection?.directionId??'';
    node<HTMLTextAreaElement>(`ai-${side}-shared`).value=selection?.sharedBones.join('\n')??'';
    node<HTMLTextAreaElement>(`ai-${side}-normalization`).value=selection?.normalizationBones?.join('\n')??'';
    node(`ai-${side}-coordinates`).textContent='请选择真实方向入口和身体锚点；全工程根点可能只是排版坐标。';
  }
  private read(side:'source'|'target'):RigSelection {
    const directionRoot=node<HTMLSelectElement>(`ai-${side}-root`).value;
    if(!directionRoot)throw new Error(`请先选择${side==='source'?'来源':'目标'}方向入口`);
    const directionId=node<HTMLInputElement>(`ai-${side}-direction`).value.trim()||directionRoot;
    const ground=node<HTMLSelectElement>(`ai-${side}-ground`).value;
    const normalization=lines(node<HTMLTextAreaElement>(`ai-${side}-normalization`).value);
    return{directionId,directionRoot,bodyAnchor:node<HTMLSelectElement>(`ai-${side}-anchor`).value,sharedBones:lines(node<HTMLTextAreaElement>(`ai-${side}-shared`).value),...(ground?{groundAnchor:ground}:{}),...(normalization.length?{normalizationBones:normalization}:{})};
  }
  private coordinates(){if(!this.bundle)return;for(const side of ['source','target']as const){
    if(this.bundle.manifest.referenceMode){node(`ai-${side}-coordinates`).textContent='当前为完整骨架调查，身体参考由 AI 结合层级、约束和采样判断。';continue;}
    const rig=side==='source'?this.bundle.sourceRig:this.bundle.targetRig;
    const roots=rig.bones.filter(b=>rig.globalRoots.includes(b.name)).map(b=>`${b.name} (${b.setup.world.x.toFixed(1)}, ${b.setup.world.y.toFixed(1)})`).join('；');
    const anchor=rig.reference.setupWorld;
    node(`ai-${side}-coordinates`).textContent=`全局根：${roots}；固定身体锚点 ${rig.selection.bodyAnchor} (${anchor.x.toFixed(1)}, ${anchor.y.toFixed(1)})；选入 ${rig.includedBones.length} 骨；人体尺寸 ${rig.normalizationScale.toFixed(2)}。`;
  }}
  private describe(){
    const pair=this.hooks.pair(),host=node('ai-discovery-summary');if(!pair){host.textContent='载入两份工程后会自动读取骨架，无需先填写标定。';return;}
    node<HTMLSelectElement>('ai-second-animation').disabled=!!this.bundle&&!this.bundle.manifest.referenceMode;
    if(this.bundle&&!this.bundle.manifest.referenceMode){host.textContent=`当前参考：来源 ${this.bundle.manifest.sourceSelection.directionRoot} / ${this.bundle.manifest.sourceSelection.bodyAnchor}；目标 ${this.bundle.manifest.targetSelection.directionRoot} / ${this.bundle.manifest.targetSelection.bodyAnchor}。可直接审阅映射和预览。`;return;}
    const discovery=this.bundle?.files['discovery.json']?JSON.parse(this.bundle.files['discovery.json']) as {source:ReturnType<typeof discoverRigReferences>;target:ReturnType<typeof discoverRigReferences>}:null;
    const source=discovery?.source??discoverRigReferences(pair.source.document,pair.source.atlasText,[this.hooks.animation()],pair.source.skin,'source');
    const target=discovery?.target??discoverRigReferences(pair.target.document,pair.target.atlasText,[],pair.target.skin,'target');
    const bones=(rig:Pair['source'])=>(rig.document as {bones:unknown[]}).bones.length;
    host.textContent=`已自动调查来源 ${bones(pair.source)} 骨、目标 ${bones(pair.target)} 骨，发现 ${source.directionCandidates.length} / ${target.directionCandidates.length} 个候选分支。所有方向均保留给 AI 判断，参考点和控制链无需你填写。`;
  }
  private build():AiBundle {
    const pair=this.hooks.pair();if(!pair)throw new Error('请先载入来源和目标工程');
    const source=this.read('source'),target=this.read('target');
    if(this.bundle&&!this.bundle.manifest.referenceMode&&!this.referencesDirty&&stableAiJson(source)===stableAiJson(this.bundle.manifest.sourceSelection)&&stableAiJson(target)===stableAiJson(this.bundle.manifest.targetSelection)){
      node<HTMLInputElement>('ai-source-direction').value=source.directionId;node<HTMLInputElement>('ai-target-direction').value=target.directionId;
      return this.bundle;
    }
    const animations=[this.hooks.animation(),node<HTMLSelectElement>('ai-second-animation').value].filter(Boolean);
    const bundle=createAiBundle({source:{...pair.source,selection:source},target:{...pair.target,selection:target},animations,toolVersion:'0.3.2'});
    const previous=this.selections()??null;
    try{this.hooks.selection({source,target});}catch(error){try{this.hooks.selection(previous);}catch{/* Original preview may already be unavailable. */}throw error;}
    if(this.bundle?.manifest.bundleId!==bundle.manifest.bundleId){this.reviewed=null;this.acceptedIds=[];this.withdrawnIds=[];this.exportRef=null;this.report=null;this.revision++;node('ai-directory').textContent='';for(const id of ['ai-open-folder','ai-copy-prompt','ai-diagnostics'])node<HTMLButtonElement>(id).disabled=true;}
    this.bundle=bundle;this.derivedFromBundleId=undefined;this.referencesDirty=false;this.appliedSecondReference=node<HTMLSelectElement>('ai-second-animation').value;
    node<HTMLInputElement>('ai-source-direction').value=source.directionId;node<HTMLInputElement>('ai-target-direction').value=target.directionId;
    this.coordinates();this.describe();this.persist();this.render();return bundle;
  }
  reset(saved?:AiReviewState){
    this.revision++;this.bundle=null;this.reviewed=null;this.acceptedIds=[];this.withdrawnIds=[];this.exportRef=null;this.report=null;this.referencesDirty=false;this.derivedFromBundleId=undefined;
    this.fill('source');this.fill('target');this.hooks.selection(null);
    const pair=this.hooks.pair(),actions=Object.keys((pair?.source.document as {animations?:object}|undefined)?.animations??{});
    const select=node<HTMLSelectElement>('ai-second-animation');select.replaceChildren(...['',...actions].map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value||'仅当前动作';return option;}));
    node('ai-directory').textContent='';for(const id of ['ai-open-folder','ai-copy-prompt','ai-diagnostics'])node<HTMLButtonElement>(id).disabled=true;
    for(const id of ['ai-export','ai-import','ai-apply-selection'])node<HTMLButtonElement>(id).disabled=!pair;
    if(saved && pair){try{
      const restored=restoreAiReview(saved,pair);this.bundle=restored.bundle;this.reviewed=restored.reviewed;this.acceptedIds=[...saved.acceptedIds];this.withdrawnIds=[...(saved.withdrawnIds??[])];this.derivedFromBundleId=saved.derivedFromBundleId;
      this.fill('source',saved.manifest.sourceSelection);this.fill('target',saved.manifest.targetSelection);
      select.value=saved.manifest.animations.find(name=>name!==this.hooks.animation())??'';
      this.hooks.selection(this.selections()??null);this.coordinates();this.say(this.bundle.manifest.referenceMode?'已恢复完整调查，可直接导入 AI 返回结果，无需填写参考骨。':`已恢复角色标定及 ${this.acceptedIds.length} 项接受记录。切换动作可复用当前映射。`);
    }catch(error){
      this.bundle=null;this.reviewed=null;this.acceptedIds=[];this.withdrawnIds=[];this.derivedFromBundleId=undefined;
      try{this.hooks.selection(null);}catch{/* A failed preview must not authorize old AI mappings. */}
      this.hooks.state(undefined);this.say(`保存的 AI 标定未启用：${errorText(error)}。旧 AI 映射暂停参与，可重新自动分析。`,true);
    }}
    else this.say(pair?'可直接生成 AI 分析包。程序自动采样全部骨架，由 AI 判断身体与方向，不必填写高级设置。':'载入两份工程后可直接生成任务书。');
    this.appliedSecondReference=select.value;
    node<HTMLDetailsElement>('ai-rig-settings').open=false;
    try{this.describe();}catch(error){node('ai-discovery-summary').textContent=`自动调查提示：${errorText(error)}`;}
    this.render();
  }
  selections(){return this.bundle&&!this.bundle.manifest.referenceMode?{source:this.bundle.manifest.sourceSelection,target:this.bundle.manifest.targetSelection}:undefined;}
  filter(mappings:readonly SpineObjectMapping[]){return mappings.filter(mapping=>
    (mapping.provenance?.origin!=='reviewed-ai'||(this.bundle!==null&&!this.bundle.manifest.referenceMode&&mapping.provenance.bundleId===this.bundle.manifest.bundleId))&&
    (!this.bundle||this.bundle.manifest.referenceMode||mappingWithinBundle(mapping,this.bundle)));
  }
  recordReport(report:SpineMigrationReport){this.report=report;node<HTMLButtonElement>('ai-diagnostics').disabled=!this.bundle||!!this.bundle.manifest.referenceMode;}
  invalidateReport(){this.report=null;node<HTMLButtonElement>('ai-diagnostics').disabled=true;}
  private bodyCandidate(candidate:AiReviewedProposal['candidates'][number]){
    return candidate.status!=='unresolved'&&(['torso','leftArm','rightArm','leftLeg','rightLeg'].includes(candidate.group)||
      candidate.group==='control'&&candidate.mapping.kind==='bone'&&/root|motion|pelvis|hips|spine|body|arm|hand|leg|foot|躯干|臂|手|腿|足|脚/i.test(candidate.semanticRole)&&!/weapon|grip|hold|武器|持握/i.test(candidate.semanticRole));
  }
  private accept(ids:string[]){
    if(!this.reviewed)return;
    const result=mergeAcceptedAiMappings(this.hooks.mappings(),this.reviewed,ids);
    this.acceptedIds=[...new Set([...this.acceptedIds,...result.acceptedIds])];
    this.hooks.commit(result.mappings,this.state());this.render();
    this.say(`本次采用 ${result.acceptedIds.length} 项身体对应；替换 ${result.replaced.length} 项本地自动对应。${result.conflicts.map(c=>`${c.proposed.source}：${c.reason}`).join('；')||'可以连续播放草稿，按画面需要再调整。'}`);
  }
  syncMappings():AiReviewState|undefined {
    if(!this.bundle || !this.reviewed || !this.acceptedIds.length)return;
    const valid=this.acceptedIds.filter(id=>{
      const candidate=this.reviewed!.candidates.find(item=>item.id===id);if(!candidate)return false;
      return this.hooks.mappings().some(mapping=>mapping.provenance?.origin==='reviewed-ai' && mapping.provenance.bundleId===this.bundle!.manifest.bundleId &&
        ['kind','source','target','drive','side','channels','sourceSkin','targetSkin','sourceSlot','targetSlot'].every(key=>stableAiJson(mapping[key as keyof SpineObjectMapping])===stableAiJson(candidate.mapping[key as keyof SpineObjectMapping])));
    });
    if(valid.length===this.acceptedIds.length)return;
    this.acceptedIds=valid;this.render();this.say('映射已由人工修改或删除，已更新 AI 接受记录；当前对象映射优先。');return this.state();
  }
  private render(){
    const host=node('ai-review-list');host.replaceChildren();node<HTMLButtonElement>('ai-withdraw').disabled=!this.reviewed||this.reviewed.candidates.every(candidate=>this.acceptedIds.includes(candidate.id)||this.withdrawnIds.includes(candidate.id));
    const bodyButton=node<HTMLButtonElement>('ai-preview-body');
    bodyButton.disabled=!this.reviewed?.candidates.some(candidate=>this.bodyCandidate(candidate)&&!this.acceptedIds.includes(candidate.id)&&!this.withdrawnIds.includes(candidate.id));
    if(!this.reviewed)return;
    const reviewed=this.reviewed;
    for(const[group,title]of Object.entries(groups) as [AiCandidateGroup,string][]){
      const candidates=reviewed.candidates.filter(item=>item.group===group&&!this.withdrawnIds.includes(item.id));if(!candidates.length)continue;
      const section=document.createElement('details');section.open=['torso','leftArm','rightArm','control'].includes(group);
      section.append(text('summary',`${title} · ${candidates.length} 项`));
      const checks=new Map<string,HTMLInputElement>();
      for(const candidate of candidates){
        const row=text('div','','ai-candidate'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.aiCandidate=candidate.id;
        check.checked=this.acceptedIds.includes(candidate.id);check.disabled=check.checked||candidate.status==='unresolved';checks.set(candidate.id,check);
        label.append(check,document.createTextNode(`${candidate.mapping.source} → ${candidate.mapping.target}`));
        row.append(label,text('small',`${candidate.semanticRole} · ${this.acceptedIds.includes(candidate.id)?'已接受':candidate.status==='unresolved'?'待补证据':'待确认'}`));
        const clashes=this.hooks.mappings().filter(m=>m.kind===candidate.mapping.kind&&(m.source===candidate.mapping.source||m.target===candidate.mapping.target));
        for(const clash of clashes)row.append(text('p',`当前 ${clash.source} → ${clash.target}（${clash.provenance?.origin??'manual'}）；提案驱动 ${candidate.mapping.drive}。${clash.provenance?.origin==='local-auto'?'接受时替换本地自动对应。':'保留已有人工 / 已审阅决定。'}`,'field-note'));
        row.append(text('p',candidate.reason,'field-note'));
        for(const note of [...candidate.reviewNotes,...candidate.warnings])row.append(text('p',note,'field-note'));
        row.append(text('small',`证据：${candidate.evidenceIds.join('；')}`));section.append(row);
      }
      const accept=text('button','接受本链勾选项','button') as HTMLButtonElement;accept.type='button';
      accept.addEventListener('click',()=>void this.run(()=>{
        const selected=[...checks].filter(([id,check])=>check.checked&&!this.acceptedIds.includes(id)).map(([id])=>id);
        this.accept(selected);
      }));section.append(accept);host.append(section);
    }
    if(reviewed.unresolved.length)host.append(text('p',`尚待确认：${reviewed.unresolved.map(item=>`${item.source}：${item.reason}`).join('；')}`,'field-note'));
  }
}
