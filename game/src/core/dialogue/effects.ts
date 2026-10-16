import type {DialogueEffect,Value} from './model';
/** Validate the whole effect segment before committing any flags or notices. */
export class DialogueEffects{
 constructor(private flags:Record<string,Value>,private notice:(text:string)=>void){}
 apply(effects:DialogueEffect[]){for(const e of effects)if(e.kind!=='setFlag'&&e.kind!=='notice')throw Error('未实现对话效果：'+e.kind);for(const e of effects){if(e.kind==='setFlag')this.flags[e.key]=e.value;else if(e.kind==='notice')this.notice(e.text);}}
}
