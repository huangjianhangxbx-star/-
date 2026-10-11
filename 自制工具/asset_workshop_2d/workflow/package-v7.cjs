'use strict';
const crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util'),{PNG}=require('pngjs'),{zipSync}=require('fflate');
const legacy=require('./package.cjs'),{sha,canonical}=require('./store.cjs');
const {resolveFormContract,assertFormContract,validateFormReview,renderFormChecklist}=require('./form-contract.cjs');
const {resolveStylePressure,renderStylePressure}=require('./style-pressure.cjs');
const {testScenes}=require('../grammar/catalog.cjs'),{artTemplateImages}=require('../grammar/art-directed.cjs'),{templateImages}=require('../grammar/compile.cjs');
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n'),specHash=legacy.specHash;
const stages={sample:'sample-task',style:'style-refine-task',formal:'formal-master-task'};
function buildLockedSpec(options={}){
 if(!options||options.protocolVersion!==7)throw Error('v7 视角契约需要显式 protocolVersion:7 协议选择');
 const {protocolVersion,viewContractId,stylePressure,...baseOptions}=options;
 const base=legacy.buildLockedSpec(baseOptions),viewContract=resolveFormContract(base.grammar.template.id,viewContractId),pressure=resolveStylePressure(stylePressure);
 return {...base,schemaVersion:'1.5.0',protocolVersion,viewContract,stylePressure:pressure};
}
function configuration(spec){return {protocolVersion:7,templateId:spec.grammar?.template?.id,cellPixels:spec.grammar?.cellPixels,ppu:spec.grammar?.ppu,strategy:spec.strategy,
 seed:spec.grammar?.seed??17,...(spec.strategy==='layered'?{masterPixels:spec.grammar.master.width}:{}),description:spec.description,projectStyleContract:spec.projectStyleContract,viewContractId:spec.viewContract?.id,stylePressure:spec.stylePressure?.mode};}
function assertLockedSpec(spec){if(!spec||!isDeepStrictEqual(spec,buildLockedSpec(configuration(spec))))throw Error('v7 锁定规格镜像/形式契约不匹配');return spec;}

// Original code-native explanatory diagrams. These never represent production art.
const font={A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',D:'11110/10001/10001/10001/10001/10001/11110',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',G:'01111/10000/10000/10111/10001/10001/01111',H:'10001/10001/10001/11111/10001/10001/10001',I:'11111/00100/00100/00100/00100/00100/11111',J:'00111/00010/00010/00010/10010/10010/01100',K:'10001/10010/10100/11000/10100/10010/10001',L:'10000/10000/10000/10000/10000/10000/11111',M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/10101/10011/10001/10001/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',Q:'01110/10001/10001/10001/10101/10010/01101',R:'11110/10001/10001/11110/10100/10010/10001',S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',U:'10001/10001/10001/10001/10001/10001/01110',V:'10001/10001/10001/10001/10001/01010/00100',W:'10001/10001/10001/10101/10101/10101/01010',X:'10001/10001/01010/00100/01010/10001/10001',Y:'10001/10001/01010/00100/00100/00100/00100',Z:'11111/00001/00010/00100/01000/10000/11111',0:'01110/10001/10011/10101/11001/10001/01110',1:'00100/01100/00100/00100/00100/00100/01110',2:'01110/10001/00001/00010/00100/01000/11111',3:'11110/00001/00001/01110/00001/00001/11110',4:'00010/00110/01010/10010/11111/00010/00010',5:'11111/10000/10000/11110/00001/00001/11110',6:'01110/10000/10000/11110/10001/10001/01110',7:'11111/00001/00010/00100/01000/01000/01000',8:'01110/10001/10001/01110/10001/10001/01110',9:'01110/10001/10001/01111/00001/00001/01110','-':'00000/00000/00000/11111/00000/00000/00000','/':'00001/00010/00010/00100/01000/01000/10000','+':'00000/00100/00100/11111/00100/00100/00000'};
function canvas(w,h){const p=new PNG({width:w,height:h});for(let i=0;i<p.data.length;i+=4)p.data.set([24,29,34,255],i);return p;}
function rect(p,x,y,w,h,color){for(let yy=Math.max(0,Math.floor(y));yy<Math.min(p.height,y+h);yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(p.width,x+w);xx++)p.data.set([...color,255],(yy*p.width+xx)*4);}
function text(p,value,x,y,color=[222,230,233],scale=2){for(const ch of value.toUpperCase()){const glyph=font[ch];if(glyph)glyph.split('/').forEach((row,dy)=>[...row].forEach((v,dx)=>{if(v==='1')rect(p,x+dx*scale,y+dy*scale,scale,scale,color);}));x+=6*scale;}}
function arrow(p,x,y,dx,dy,color){const length=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=length;i++)rect(p,x+Math.round(dx*i/length),y+Math.round(dy*i/length),2,2,color);const xx=x+dx,yy=y+dy;for(let i=0;i<9;i++)if(dx){rect(p,xx-i,yy-i,2,2,color);rect(p,xx-i,yy+i,2,2,color);}else{rect(p,xx-i,yy-i,2,2,color);rect(p,xx+i,yy-i,2,2,color);}}
function illustration(p,x,y,size,role,stone){
 const top=stone?[135,145,144]:[103,150,92],dark=stone?[64,76,82]:[65,90,58],background=[24,29,34],m=Math.max(4,Math.floor(size*.16)),body=Math.max(3,Math.floor(size*.16));
 const height=stone?size-2*m-body:size-2*m;rect(p,x+m,y+m,size-2*m,height,top);
 if(role==='edge')rect(p,x+m,y+m,Math.floor(size*.25),height,background);
 if(role==='outer-corner'){rect(p,x+m,y+m,Math.floor(size*.28),Math.floor(height*.45),background);rect(p,x+size-m-Math.floor(size*.28),y+m,Math.floor(size*.28),Math.floor(height*.45),background);}
 if(role==='inner-corner-or-hole')rect(p,x+Math.floor(size*.4),y+m+Math.floor(height*.28),Math.floor(size*.25),Math.floor(height*.37),background);
 if(stone){rect(p,x+m,y+m+height,size-2*m,body,dark);if(role==='edge')rect(p,x+m,y+m+height,Math.floor(size*.25),body,background);}
}
function canonicalView(input){const c=input?.viewContract??(input?.schemaVersion==='2dw-view-contract/1'?input:resolveFormContract(input?.template?.id));assertFormContract(c);return c;}
function viewGuide(input){
 const c=canonicalView(input),stone=c.surfaceMode==='top-with-fixed-front-face',p=canvas(640,560);
 text(p,stone?'STONE - ORTHOGRAPHIC':'GROUND - ORTHOGRAPHIC',24,20,[239,240,226],3);text(p,stone?'TOP + FIXED FRONT DOWN':'TOP PLANE ONLY - NO SIDE',24,51);
 arrow(p,75,100,105,0,[230,184,108]);text(p,'+X RIGHT',195,92,[230,184,108]);arrow(p,38,120,0,60,[113,177,207]);text(p,'+Y DOWN',16,192,[113,177,207],1);
 const roles=['center','edge','outer-corner','inner-corner-or-hole'],labels=['1 CENTER',stone?'2 EDGE / FRONT':'2 EDGE / SOIL','3 OUTER CORNER','4 INNER / HOLE'];
 roles.forEach((role,i)=>{const x=76+(i%2)*276,y=126+Math.floor(i/2)*174;rect(p,x,y,248,160,[38,46,51]);rect(p,x+2,y+2,244,156,[24,29,34]);text(p,labels[i],x+12,y+10);illustration(p,x+40,y+29,136,role,stone);if(stone)arrow(p,x+205,y+77,0,32,[113,177,207]);});
 text(p,'ONE CAMERA / SAME GRID / 2 X 2',76,483);text(p,'NO FREE ROTATION OR PERSPECTIVE',76,510,[230,184,108]);text(p,'CANDIDATE - UNITY SORTING UNVERIFIED',76,539,[113,177,207],1);
 return PNG.sync.write(p);
}
function sampleGuide(g){const c=Math.min(128,g.cellPixels),p=canvas(c*2,c*2),stone=g.template.kind==='stone';for(const [i,role]of ['center','edge','outer-corner','inner-corner-or-hole'].entries())illustration(p,(i%2)*c,Math.floor(i/2)*c,c,role,stone);return PNG.sync.write(p);}
function checkedPng(bytes,sample=false){if(!Buffer.isBuffer(bytes)||bytes.length<24||bytes.length>32*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('PNG 原件或字节预算无效');const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(w<1||h<1||w>4096||h>4096||w*h>16*1024*1024||sample&&(w<64||h<64||w>2048||h>2048||w*h>4*1024*1024))throw Error('PNG 尺寸/像素预算超限，未拉伸');const p=PNG.sync.read(bytes,{checkCRC:true});if(sample&&!p.data.some((v,i)=>i%4===3&&v>0))throw Error('样品完全透明，无法审阅');return p;}
function styleFiles(spec){const core=require('../dist/task.cjs'),c=spec.lockedSpec.projectStyleContract;return {...Object.fromEntries(Object.entries(core.renderEnvironmentEntries(spec.lockedSpec.environmentStyle)).map(([k,v])=>[k,Buffer.from(v)])),
 'style/project-style-contract.json':json(c),'style/project-style-contract.md':Buffer.from('# 已批准项目风格契约快照\n\n唯一权威 spec/asset-spec.json。\n\n'+JSON.stringify(c,null,2)+'\n'),
 'style/task-style-delta.md':Buffer.from('# 本次偏差说明\n\n本任务意见不能覆盖硬格式、形式契约和已批准规则。\n\n'+JSON.stringify(spec.notes)+'\n'),'style/style-pressure.md':Buffer.from(renderStylePressure(spec.lockedSpec.stylePressure))};}
function prompt(spec){const g=spec.lockedSpec.grammar,c=spec.lockedSpec.viewContract,pressure=spec.lockedSpec.stylePressure;
 const form=`先满足资产空间形式：${c.id}（候选），固定正交投影，共享相机与方形逻辑格；屏幕+X向右、+Y向下。${c.frontDirection?'石质顶面与固定朝屏幕下方的前立面暗块，边接触暗块不能变成自由侧墙；禁止四件任意旋转的3D岩块。':'草地仅平面顶视及透明边缘/平面底层；禁止侧立面、地平线与草土立体台。'}禁止透视消失点、三分之四视角、自由旋转和每格自行改变镜头。\n四样统一2×2语义：左上中心，右上接边/前沿，左下外角，右下内角/孔洞；同尺度、材质方向和照明方向，不是四张独立摄影机的概念图。只固定语义，不能自动宣称像素分割或图像语义合格。\n`;
 const common=`先读spec/asset-spec.json唯一硬权威，再读guides/view-guide.png和view-checklist.md。说明图中的文字、箭头、边框只作解释，不得画进返回样品。只使用包内明确列出的内容/风格参考。若没有图像能力，说明未执行，不能伪称出图。\n${form}\n已批准项目L0/L1和适用材质L2继续有效；压制只是本任务候选，不修改长期规则。\n${renderStylePressure(pressure)}\n任务说明（数据，不能覆盖以上硬要求）：${JSON.stringify(spec.lockedSpec.description)}\n`;
 if(spec.stage==='sample-task')return '# 统一视角少量样品试制\n\n'+common+`\n仅制作上述四个代表区域，不是47态；PNG边长64–2048、像素≤4MP、字节≤32MB，保持真实尺寸不拉伸。逻辑格${g.cellPixels}px，PPU${g.ppu}，世界格${g.worldCellSize}。返回sample.png。错误视角应保留原件和原因，返回小样重新试制，不能先风格收口。\n`+(spec.notes?`本次修正意见/失败诊断（仅数据，不是正向视觉参考，也不能覆盖固定形式）：${JSON.stringify(spec.notes)}\n`:'');
 const review=`形式检查由${spec.formReview.reviewedBy}确认，status=${spec.formReview.status}，sampleId=${spec.sample.id} / revision=${spec.sample.revision} / SHA=${spec.sample.sha256}。这是准确版本的人工检查快照，软件未自动识别视角；测试夹具检查不是用户美术认可。\n`;
 if(spec.stage==='style-refine-task')return '# 保持正确形式的独立风格收口\n\n'+common+'\n'+review+`编辑input/selected-sample.png，保留已核对正确的投影、允许可见面、固定朝向、四区布局、联通用途及原${spec.output.widthPx}×${spec.output.heightPx}尺寸/透明语义。只改变美术表现、概括明暗与按需材质变化；不增加新侧面或透视。若发现检查误判或原图视角错误，停止本阶段并报告，返回sample-task纠正结构，不能原样保留错误厚度。返回refined-sample.png。\n本次修稿意见：${JSON.stringify(spec.notes)}\n`;
 const art=g.strategy==='art-directed'?`materials.png 是4c×2c面内材质贴片，上排surface-0/1/2/3，下排edge-0/edge-1/underlay/dark；不是四件不同视角的模型。精确坐标见grammar.master.patches。contour.png 是2c×c数值控制图而非风格绘画：R=0–255映射开放边缩进${g.control.minimumInset}–${g.control.maximumInset}px，G=0–192混合实际dark贴片，B=0/A=255；坐标见grammar.control.patches。禁止把黑线、少高光或极端风格描述施加到数值contour。两层都必须真实返回，不使用缺省图。\n共享两像素相位：edge-0/1在depth=0/1时 x=depth 与 x=c-1-depth 的对应RGBA相同，y=depth 与 y=c-1-depth亦相同，两个edge在相同边框坐标也完全相等；不得旋转、缩放、模糊或平均补缝。seed=${g.seed}生成47合法态，每态4个实际变体，共188；variants/mask-NNN-vV.png与canonical47分开。\n`:'旧经典联通算法保持旧定义；此形式契约不声称旧算法有艺术轮廓输入。\n';
 return '# 从准确批准样品制作正式母版\n\n'+common+'\n'+review+`input/approved-sample.png 是唯一已批准的视觉输入，approval.json绑定确切版本。样品只作画法基准，不能将2×2小样直接当切片表。若人工误批准仍含不合规视角，报告矛盾而非自动合法化。\n返回文件：\n${spec.output.files.map(f=>`${f.name} ${f.widthPx}×${f.heightPx} PNG，完全不透明；${f.purpose}`).join('\n')}\n${art}\n改形式/风格档位/样品后，旧批准与请求陈旧，需要明确重新检查并批准。精确尺寸失败保存原返回图，不拉伸或改变锁定契约。艺术验收pending-human-review；Unity Sorting unverified。\n`;
}
function buildStagePackage({stage,sessionId,lockedSpec,sample,approval,formReview,notes=''}={},inputs=[],privateKey){
 stage=stages[stage]??stage;if(!Object.values(stages).includes(stage))throw Error('未知v7任务阶段');assertLockedSpec(lockedSpec);
 if(typeof sessionId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(sessionId))throw Error('任务身份非法');if(typeof notes!=='string'||notes.length>8192||notes.includes('\0'))throw Error('任务意见超过范围');
 if(!Array.isArray(inputs)||inputs.length>8)throw Error('参考图最多8张');const files={},references=[],seen=new Set();let referenceBytes=0;
 for(const r of inputs){if(!r||typeof r.refId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(r.refId)||seen.has(r.refId.toLowerCase())||!['content','style'].includes(r.role)||!Buffer.isBuffer(r.bytes)||r.bytes.length>4*1024*1024)throw Error('参考身份/角色/字节预算非法');seen.add(r.refId.toLowerCase());referenceBytes+=r.bytes.length;if(referenceBytes>32*1024*1024)throw Error('参考累计预算超限');const p=checkedPng(r.bytes),name=`refs/${r.role}/${r.refId}.png`;files[name]=r.bytes;references.push({refId:r.refId,role:r.role,sourceName:String(r.sourceName??'PNG').replace(/[\\/:]/g,'_').slice(0,256),note:String(r.note??'').slice(0,8192),packagePath:name,sha256:sha(r.bytes),byteLength:r.bytes.length,widthPx:p.width,heightPx:p.height});}
 const spec={schemaVersion:'1.5.0',protocolVersion:7,stage,taskId:sessionId,title:lockedSpec.grammar.template.label+' · '+stage,lockedSpec,specHash:specHash(lockedSpec),references,notes},g=lockedSpec.grammar;
 if(stage==='sample-task'){spec.sampleRequest={layout:lockedSpec.viewContract.sampleLayout,forms:lockedSpec.viewContract.sampleLayout.regions.map(r=>r.label),rules:['统一正交相机与2×2语义','至少一个内/外联通边界','不是47态成品','错误视角返回试制']};spec.output={name:'sample.png',format:'png',exactDimensions:false,minEdge:64,maxEdge:2048,maxPixels:4*1024*1024,maxBytes:32*1024*1024};}
 else{
  if(!sample||sample.sha256!==sha(sample.bytes??Buffer.alloc(0))||!Number.isSafeInteger(sample.revision)||sample.revision<1||typeof sample.id!=='string'||!/^[A-Za-z0-9_-]{1,96}$/.test(sample.id))throw Error('样品实际字节或版本身份不匹配');const p=checkedPng(sample.bytes,true);
  spec.sample={id:sample.id,revision:sample.revision,sha256:sha(sample.bytes),fileBytes:sample.bytes.length,widthPx:p.width,heightPx:p.height,kind:sample.kind,testOnly:!!sample.testOnly};
  spec.formReview=validateFormReview(formReview,{sample,spec:lockedSpec,specHash:spec.specHash,requirePassed:true});files['input/form-review.json']=json(spec.formReview);
  if(stage==='style-refine-task'){files['input/selected-sample.png']=sample.bytes;spec.output={name:'refined-sample.png',format:'png',exactDimensions:true,widthPx:p.width,heightPx:p.height,alphaRequirement:'preserve-parent'};spec.lockedContent=['正确固定投影与允许可见面','四区布局与联通用途','正确固定厚度方向','原尺寸与透明语义'];spec.editableRendering=['主要明暗块面','高光/裂缝简化','按需弱整体材质变化'];}
  else{
   if(!approval||typeof approval.id!=='string'||approval.sampleId!==sample.id||approval.revision!==sample.revision||approval.sha256!==sample.sha256||approval.fileBytes!==sample.bytes.length||approval.specHash!==spec.specHash||approval.templateId!==g.template.id||approval.templateVersion!==g.template.version||approval.profileVersion!=='1'||approval.testOnly!==!!sample.testOnly||approval.approvedBy!==(sample.testOnly?'synthetic/test-only':'user-explicit')||approval.formReviewSha256!==sha(Buffer.from(canonical(spec.formReview))))throw Error('当前批准身份或形式检查 SHA 不匹配，禁止v7正式制作');
   spec.approval={...approval};files['input/approved-sample.png']=sample.bytes;files['input/approval.json']=json(approval);spec.output={format:'png',exactDimensions:true,files:lockedSpec.strategy==='art-directed'?[{name:'materials.png',widthPx:g.master.width,heightPx:g.master.height,purpose:'八个实际面内材质贴片'},{name:'contour.png',widthPx:g.control.width,heightPx:g.control.height,purpose:'两个数值轮廓/暗部控制变体'}]:[{name:'master.png',widthPx:g.master.width,heightPx:g.master.height,purpose:'旧经典母版'}]};
  }
 }
 files['guides/sample-layout.png']=sampleGuide(g);files['guides/view-guide.png']=viewGuide(lockedSpec);files['guides/view-checklist.md']=Buffer.from(renderFormChecklist(lockedSpec.viewContract));files['asset-grammar/grammar.json']=json(g);files['asset-grammar/test-scenes.json']=json(testScenes());
 if(stage==='formal-master-task')for(const [name,b]of Object.entries(lockedSpec.strategy==='art-directed'?artTemplateImages(g):templateImages(g)))files[`guides/${name}.png`]=b;
 files['spec/asset-spec.json']=json(spec);Object.assign(files,styleFiles(spec));files['prompts/task.md']=Buffer.from(prompt(spec));files['README_开始阅读.md']=Buffer.from(`# 2DW阶段任务 ZIP v7\n\n阶段 ${stage}；spec/asset-spec.json唯一硬权威，形式、风格与导引均为派生镜像。先核验包再执行；说明图不是待生产素材。任务级形式与压制预设是候选，已批准L0/L1与适用L2不变。机器签名证明本发行密钥的字节完整性；首次接收仍需核对指纹，不是公共权利或美术认证，也不授予异机工程审批。测试样品仅技术验证；艺术pending-human-review，Unity Sorting unverified。\n`);
 const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,b])=>({path,sha256:sha(b),byteLength:b.length}));if(entries.length+1>64||entries.reduce((n,e)=>n+e.byteLength,0)>32*1024*1024)throw Error('v7任务包超出原有32MB/64条目预算');
 privateKey??=crypto.generateKeyPairSync('ed25519').privateKey;const publicKey=crypto.createPublicKey(privateKey).export({type:'spki',format:'pem'}),authority={schemaVersion:'2dw-zip/7',specPath:'spec/asset-spec.json',taskId:sessionId,stage,entries,issuerFingerprint:sha(Buffer.from(publicKey))};
 files['manifest.json']=json({...authority,publicKey,signature:crypto.sign(null,json(authority),privateKey).toString('base64')});const bytes=Buffer.from(zipSync(files,{level:6,mtime:new Date('2020-01-01T00:00:00Z')}));if(bytes.length>32*1024*1024)throw Error('v7压缩包超过32MB');return {spec,files,bytes,sha256:sha(bytes)};
}
function validateStageZip(input,records){
 let files;if(Buffer.isBuffer(input)||input instanceof Uint8Array){const a=require('../archive/export-zip.cjs').readZip(input);files=a.files;records=a.records;}else files=input;
 let m,s;try{m=JSON.parse(files['manifest.json']);s=JSON.parse(files['spec/asset-spec.json']);}catch{throw Error('v7权威文件缺失');}
 const {publicKey,signature,...authority}=m;
 if(m.schemaVersion!=='2dw-zip/7'||m.specPath!=='spec/asset-spec.json'||m.issuerFingerprint!==sha(Buffer.from(publicKey??''))||!crypto.verify(null,json(authority),publicKey,Buffer.from(signature??'','base64')))throw Error('v7 authority signature签名错误');
 if(!Array.isArray(m.entries)||m.entries.length!==Object.keys(files).length-1)throw Error('v7 manifest完整性错误');const seen=new Set();for(const e of m.entries){if(seen.has(e.path)||!files[e.path]||e.sha256!==sha(files[e.path])||e.byteLength!==files[e.path].length)throw Error('v7文件哈希/长度不匹配');seen.add(e.path);}
 assertLockedSpec(s.lockedSpec);if(s.schemaVersion!=='1.5.0'||s.protocolVersion!==7||s.taskId!==m.taskId||s.stage!==m.stage||s.specHash!==specHash(s.lockedSpec))throw Error('v7规格/阶段身份不匹配');
 const inputs=s.references.map(r=>({refId:r.refId,role:r.role,sourceName:r.sourceName,note:r.note,bytes:Buffer.from(files[r.packagePath]??[])}));
 const sample=s.sample?{...s.sample,bytes:Buffer.from(files[s.stage==='formal-master-task'?'input/approved-sample.png':'input/selected-sample.png']??[])}:undefined;
 const canonical=buildStagePackage({stage:s.stage,sessionId:s.taskId,lockedSpec:s.lockedSpec,sample,approval:s.approval,formReview:s.formReview,notes:s.notes},inputs);
 if(!isDeepStrictEqual(s,canonical.spec)||Object.keys(canonical.files).length!==Object.keys(files).length)throw Error('v7 spec镜像不匹配');for(const [name,b]of Object.entries(canonical.files))if(name!=='manifest.json'&&!b.equals(Buffer.from(files[name]??[])))throw Error('v7派生镜像不匹配：'+name);
 return {manifest:m,spec:s,entries:records?.map(r=>r.path)??Object.keys(files)};
}
module.exports={buildLockedSpec,assertLockedSpec,buildStagePackage,validateStageZip,specHash,viewGuide,sampleGuide};
