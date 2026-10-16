import type {DialogueCondition,DialogueContext,DialogueDefinition,Predicates} from './model';
function condition(c:DialogueCondition,s:DialogueContext,p:Predicates):boolean{
 switch(c.kind){
 case 'flag':return s.flags[c.key]===c.equals;
 case 'storyNode':return s.storyNodes.includes(c.id);
 case 'questState':return s.quests[c.questId]===c.state;
 case 'characterState':{const v=s.characters[c.actorId]?.[c.key];return c.op==='eq'?v===c.value:typeof v==='number'&&typeof c.value==='number'&&(c.op==='gte'?v>=c.value:v<=c.value);}
 case 'worldPlace':return s.place===c.placeId;
 case 'inventory':return (s.inventory[c.itemId]??0)>=c.min;
 case 'custom':try{return p[c.predicateId]?.(structuredClone(s),structuredClone(c.args))===true;}catch{return false;}
 }
}
export function selectDialogue(definitions:DialogueDefinition[],s:DialogueContext,p:Predicates={}){
 const diagnostics=definitions.map(d=>{const reasons:string[]=[];if(d.actorId!==s.actorId||d.trigger!==s.trigger)reasons.push('角色/触发不匹配');if(!s.valid)reasons.push('生命周期失效');const h=s.history[d.id];if(h&&(d.repeat==='once'||d.repeat==='oncePerWorld'&&h.worlds.includes(s.world)||d.repeat==='cooldown'&&s.time-h.last<(d.cooldownSeconds??0)))reasons.push('重复/冷却限制');const conditions=d.conditions.map(c=>({condition:c,passed:condition(c,s,p)}));for(const c of conditions)if(!c.passed)reasons.push('条件失败 '+JSON.stringify(c.condition));return {id:d.id,passed:!reasons.length,reasons,conditions,priority:d.priority,specificity:d.conditions.length};});
 const eligible=definitions.filter(d=>diagnostics.find(x=>x.id===d.id)?.passed).sort((a,b)=>b.priority-a.priority||b.conditions.length-a.conditions.length||(a.id<b.id?-1:a.id>b.id?1:0));
 return {selected:eligible[0],diagnostics,rationale:eligible[0]?`${eligible[0].id}：优先级降序、条件数降序、ID升序`:'没有合格候选'};
}
