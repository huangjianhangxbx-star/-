import type {GameState,WaveDefinition,WaveRuntime,BatchDefinition,SpawnEntry} from './types';
export const WAVE_TIMING={firstSpawn:18,intermission:5,preview:5};
export type BatchPreview={id:string;waveId:string;waveNumber:number;batchId:string;route:BatchDefinition['route'];previewAt:number;startAt:number;count:number};
const key=(w:WaveDefinition,b:BatchDefinition)=>`${w.id}/${b.id}`;
export function validateWaves(waves:WaveDefinition[]){
 if(!waves.length)throw new Error('塔防配置至少需要一波');
 const ids=new Set<string>();
 for(const w of waves){
  if(!w.id||ids.has(w.id)||!w.batches.length)throw new Error('波身份重复或缺少批次');ids.add(w.id);const batches=new Set<string>();
  for(const b of w.batches){
   if(!b.id||batches.has(b.id))throw new Error('批次身份重复');batches.add(b.id);
   if(!Number.isFinite(b.offset)||b.offset<0||!Number.isFinite(b.interval)||b.interval<=0||!Number.isFinite(b.previewSeconds)||b.previewSeconds<=0||b.route.length<2||b.route.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||!b.entries.length)throw new Error('批次时间、路线或数量无效');
   const entries=new Set<string>();for(const e of b.entries){if(!e.id||entries.has(e.id)||!['melee','ranged','heavy'].includes(e.role)||!['Dustin','Verlaine_bot'].includes(e.asset)||!Number.isFinite(e.hpScale)||e.hpScale<=0||!Number.isFinite(e.damageScale)||e.damageScale<=0)throw new Error('敌人定义无效');entries.add(e.id);}
  }
 }
}
export function createWaveRuntime(waves:WaveDefinition[],anchor=WAVE_TIMING.firstSpawn):WaveRuntime{validateWaves(waves);return {index:0,phase:'waiting',anchor,spawned:{},intermissionUntil:null};}
export const enemyCount=(waves:WaveDefinition[])=>waves.reduce((n,w)=>n+w.batches.reduce((a,b)=>a+b.entries.length,0),0);
export function spawnDue(s:GameState,spawn:(wave:WaveDefinition,batch:BatchDefinition,entry:SpawnEntry)=>void){
 const r=s.waveState;if(!r||r.phase==='complete')return;
 if(r.phase==='intermission'){
  if(s.time+1e-8<(r.intermissionUntil??Infinity))return;
  r.index++;r.anchor=r.intermissionUntil!;r.intermissionUntil=null;r.spawned={};r.phase='waiting';
 }
 const w=s.waves[r.index];if(!w)return;
 // Sort due entries by their scheduled time: dt subdivision and batch order cannot
 // change the deterministic runtime spawn order or each preset reward identity.
 const due:{batch:BatchDefinition;entry:SpawnEntry;at:number}[]=[];
 for(const b of w.batches){let n=r.spawned[key(w,b)]||0;while(n<b.entries.length&&s.time+1e-8>=r.anchor+b.offset+n*b.interval){due.push({batch:b,entry:b.entries[n],at:r.anchor+b.offset+n*b.interval});n++;}r.spawned[key(w,b)]=n;}
 due.sort((a,b)=>a.at-b.at||a.batch.id.localeCompare(b.batch.id)||a.entry.id.localeCompare(b.entry.id));for(const d of due)spawn(w,d.batch,d.entry);
 const remaining=w.batches.some(b=>(r.spawned[key(w,b)]||0)<b.entries.length);
 if(due.length||r.phase!=='waiting')r.phase=remaining?'spawning':'clearing';
 if(due.length)s.wave=r.index+1;
 const times=w.batches.filter(b=>(r.spawned[key(w,b)]||0)<b.entries.length).map(b=>r.anchor+b.offset+(r.spawned[key(w,b)]||0)*b.interval-s.time);
 s.spawnTimer=times.length?Math.max(0,Math.min(...times)):0;
}
/** Called after damage, leak and downed timeout. Never performs node cleanup. */
export function advanceWave(s:GameState){
 const r=s.waveState;if(!r||r.phase==='intermission'||r.phase==='complete')return r?.phase==='complete';
 const w=s.waves[r.index];if(!w||w.batches.some(b=>(r.spawned[key(w,b)]||0)<b.entries.length)||s.units.some(u=>u.team==='enemy'&&u.life==='active'))return false;
 // Dead/leaked units are no longer part of the field; death rewards/effects have
 // already been emitted. Keep current transient visuals, not stale unit records.
 s.units=s.units.filter(u=>u.team!=='enemy'||u.life==='active');
 if(r.index===s.waves.length-1){r.phase='complete';return true;}
 r.phase='intermission';r.intermissionUntil=s.time+WAVE_TIMING.intermission;return false;
}
export function wavePreviews(s:GameState):BatchPreview[]{
 const r=s.waveState;if(s.phase!=='battle'||!r||r.phase==='complete')return [];
 const index=r.phase==='intermission'?r.index+1:r.index,w=s.waves[index],anchor=r.phase==='intermission'?r.intermissionUntil!:r.anchor;if(!w)return [];
 return w.batches.map(b=>({id:key(w,b),waveId:w.id,waveNumber:index+1,batchId:b.id,route:b.route,previewAt:anchor+b.offset-b.previewSeconds,startAt:anchor+b.offset,count:b.entries.length})).filter(b=>s.time+1e-8>=b.previewAt&&s.time<b.startAt-1e-8);
}
export function waveProgress(s:GameState){
 const r=s.waveState,w=r&&s.waves[r.index],live=s.units.filter(u=>u.team==='enemy'&&u.life==='active').length;
 return {current:w?r!.index+1:0,total:s.waves.length,phase:r?.phase||'waiting',live,pending:w?w.batches.filter(b=>(r!.spawned[key(w,b)]||0)<b.entries.length).length:0,intermission:Math.max(0,(r?.intermissionUntil??s.time)-s.time),previews:wavePreviews(s)};
}
