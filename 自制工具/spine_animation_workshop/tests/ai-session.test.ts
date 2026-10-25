import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiBundle } from '../src/analysis/ai-bundle.ts';
import { mappingWithinBundle, restoreAiReview } from '../src/analysis/ai-session.ts';
const atlas = 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n';
const doc = {skeleton:{spine:'4.3.26'},bones:[{name:'root'},{name:'front',parent:'root'},{name:'body',parent:'front',length:10},{name:'back',parent:'root'},{name:'backBody',parent:'back'}],slots:[],skins:[{name:'default',attachments:{}}],animations:{one:{},two:{}}};
const rig = {projectPath:'E:/a.spine',skeletonName:'a',projectHash:'a'.repeat(64),document:doc,atlasText:atlas,skin:'default',selection:{directionId:'front',directionRoot:'front',bodyAnchor:'body',sharedBones:[]}};
test('selected branch filter excludes global layout ancestors and sibling mappings',()=>{
 const bundle=createAiBundle({source:rig,target:rig,animations:['one','two'],toolVersion:'0.3.0'});
 const mapping={kind:'bone' as const,source:'body',target:'body',side:'center' as const,drive:'fk-bone' as const};
 assert.equal(mappingWithinBundle(mapping,bundle),true);
 assert.equal(mappingWithinBundle({...mapping,target:'backBody'},bundle),false);
 assert.equal(mappingWithinBundle({...mapping,source:'root'},bundle),false);
});
test('restore uses saved representative actions/version but rejects changed project identity',()=>{
 const bundle=createAiBundle({source:rig,target:rig,animations:['one','two'],toolVersion:'0.3.0'});
 const saved={reviewSchema:'spw.ai.review.v1' as const,manifest:bundle.manifest,acceptedIds:[]};
 assert.equal(restoreAiReview(saved,{source:rig,target:rig}).bundle.manifest.bundleId,bundle.manifest.bundleId);
 assert.throws(()=>restoreAiReview(saved,{source:{...rig,projectHash:'b'.repeat(64)},target:rig}),/身份|不匹配|改变/);
});
test('explicitly shared ancestor is allowed while an unmarked layout ancestor remains excluded',()=>{
 const shared={...rig,selection:{...rig.selection,sharedBones:['root']}};
 const bundle=createAiBundle({source:shared,target:shared,animations:['one'],toolVersion:'0.3.0'});
 assert.equal(mappingWithinBundle({kind:'bone',source:'root',target:'root',side:'center',drive:'direct'},bundle),true);
});
test('constraint mapping cannot pull an unmarked control bone from another direction into a draft',()=>{
 const document={...doc,constraints:[{type:'transform',name:'follow',bones:['body'],source:'backBody',mixRotate:1}]};
 const controlled={...rig,document};
 const bundle=createAiBundle({source:controlled,target:controlled,animations:['one'],toolVersion:'0.3.0'});
 const mapping={kind:'transform' as const,source:'follow',target:'follow',side:'center' as const,drive:'direct' as const};
 assert.equal(mappingWithinBundle(mapping,bundle),false);
 const shared={...controlled,selection:{...rig.selection,sharedBones:['backBody']}};
 assert.equal(mappingWithinBundle(mapping,createAiBundle({source:shared,target:shared,animations:['one'],toolVersion:'0.3.0'})),true);
});
test('restoring AI state validates its own protocol and rejects accepting an unresolved candidate',()=>{
 const bundle=createAiBundle({source:rig,target:rig,animations:['one','two'],toolVersion:'0.3.0'});
 const saved={reviewSchema:'spw.ai.review.v1' as const,manifest:bundle.manifest,acceptedIds:[] as string[]};
 assert.throws(()=>restoreAiReview({...saved,reviewSchema:'untrusted' as any},{source:rig,target:rig}),/协议/);
 const proposal={proposalSchema:'spw.ai.mapping.v1' as const,bundleId:bundle.manifest.bundleId,source:bundle.manifest.source,target:bundle.manifest.target,
  mappings:[{kind:'bone' as const,source:'body',target:'body',side:'center' as const,drive:'fk-bone' as const,semanticRole:'torso',status:'unresolved' as const,
    evidenceIds:['source:bone:body','target:bone:body'],reason:'需确认'}],unresolved:[]};
 assert.throws(()=>restoreAiReview({...saved,proposal,acceptedIds:['ai-mapping-0']},{source:rig,target:rig}),/未确定/);
});
test('restoring withdrawn candidates preserves accepted decisions and rejects stale, duplicate or overlapping withdrawals',()=>{
 const bundle=createAiBundle({source:rig,target:rig,animations:['one','two'],toolVersion:'0.3.0'});
 const proposal={proposalSchema:'spw.ai.mapping.v1' as const,bundleId:bundle.manifest.bundleId,source:bundle.manifest.source,target:bundle.manifest.target,
  mappings:[{kind:'bone' as const,source:'body',target:'body',side:'center' as const,drive:'fk-bone' as const,semanticRole:'torso',status:'proposed' as const,
    evidenceIds:['source:bone:body','target:bone:body'],reason:'主身体'},
   {kind:'bone' as const,source:'front',target:'front',side:'center' as const,drive:'direct' as const,semanticRole:'control',status:'proposed' as const,
    evidenceIds:['source:bone:front','target:bone:front'],reason:'方向入口'}],unresolved:[]};
 const saved={reviewSchema:'spw.ai.review.v1' as const,manifest:bundle.manifest,proposal,acceptedIds:['ai-mapping-0'],withdrawnIds:['ai-mapping-1']};
 assert.equal(restoreAiReview(saved,{source:rig,target:rig}).reviewed?.candidates.length,2);
 for(const withdrawnIds of [['ai-mapping-999'],['ai-mapping-1','ai-mapping-1'],['ai-mapping-0']]){
   assert.throws(()=>restoreAiReview({...saved,withdrawnIds},{source:rig,target:rig}));
 }
 assert.throws(()=>restoreAiReview({...saved,proposal:undefined,acceptedIds:[]},{source:rig,target:rig}));
});
