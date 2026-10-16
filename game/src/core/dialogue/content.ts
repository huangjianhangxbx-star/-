import type {DialogueDefinition} from './model';
const base={actorId:'companion',trigger:'interaction',priority:0,repeat:'always'} as const;
export const SAMPLE_DIALOGUES:DialogueDefinition[]=[
 {...base,id:'sample.companion.default',conditions:[],entryNodeId:'greeting',nodes:{
 greeting:{kind:'line',id:'greeting',speakerId:'companion',text:'我在这里，准备好继续探索了吗？',next:'team'},
 team:{kind:'line',id:'team',speakerId:'companion',text:'前面的路还不熟悉，我们一起留意周围吧。',next:'plan'},
 plan:{kind:'line',id:'plan',speakerId:'companion',text:'出发前，我想听听你的打算。',next:'choice'},
 choice:{kind:'choice',id:'choice',prompt:'接下来，要先检查补给还是观察前路？',options:[{id:'A',text:'检查补给',next:'flagA'},{id:'B',text:'观察前路',next:'flagB'}]},
 flagA:{kind:'effect',id:'flagA',effect:{kind:'setFlag',key:'sample.dialogue.choiceA',value:true},next:'noticeA'},
 noticeA:{kind:'effect',id:'noticeA',effect:{kind:'notice',text:'SAMPLE · 已记录检查补给的选择'},next:'endA'},
 endA:{kind:'line',id:'endA',speakerId:'companion',text:'好，先检查补给，我会留意附近的动静。'},
 flagB:{kind:'effect',id:'flagB',effect:{kind:'setFlag',key:'sample.dialogue.choiceB',value:true},next:'noticeB'},
 noticeB:{kind:'effect',id:'noticeB',effect:{kind:'notice',text:'SAMPLE · 已记录观察前路的选择'},next:'endB'},
 endB:{kind:'line',id:'endB',speakerId:'companion',text:'那就先看看前路，我们保持彼此照应。'}
 }},
 ...(['A','B'] as const).map(key=>({...base,id:'sample.companion.after'+key,priority:10,conditions:[{kind:'flag' as const,key:'sample.dialogue.choice'+key,equals:true}],entryNodeId:'first',nodes:{first:{kind:'line' as const,id:'first',speakerId:'companion',text:key==='A'?'你刚才说要检查补给，我记住了。':'你刚才说要观察前路，我记住了。',next:'last'},last:{kind:'line' as const,id:'last',speakerId:'companion',text:'准备好了就继续走吧，我会跟着你。'}}}))
];
export type DialogueCatalog=Record<string,DialogueDefinition[]>;
export const DIALOGUE_CATALOG:DialogueCatalog={companion:SAMPLE_DIALOGUES};
/** Resolve role capability to content; bind pool-local speaker alias to the actual entity. */
export function resolveDialoguePool(catalog:DialogueCatalog,poolId:string,targetId:string){
 const source=catalog[poolId];if(!source)throw Error('未知对话内容池：'+poolId);
 return structuredClone(source).map(d=>{if(d.actorId===poolId)d.actorId=targetId;for(const n of Object.values(d.nodes))if(n.kind==='line'&&n.speakerId===poolId)n.speakerId=targetId;return d;});
}
