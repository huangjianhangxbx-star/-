import type {BasicDefinition} from './basic-definition';
export type MainFormId='I'|'II';
export type MainFormSpec={id:MainFormId;label:string;postureScale:number};
export const MAIN_FORMS:Readonly<Record<MainFormId,MainFormSpec>>=Object.freeze({I:Object.freeze({id:'I',label:'原黄金连段',postureScale:1}),II:Object.freeze({id:'II',label:'两段重击 · SAMPLE',postureScale:1.35})});
const derived=new WeakMap<BasicDefinition,BasicDefinition>();
/** SAMPLE composition only. Original clips, Hit/dash/damage and frozen I stay intact. */
export function formDefinition(base:BasicDefinition,form:MainFormId):BasicDefinition{
 if(form==='I'||!['hunter-v2','al-basic-v1'].includes(base.id))return base;
 let d=derived.get(base);if(d)return d;
 const hunter=base.id==='hunter-v2',indices=hunter?[2,3]:[1,2];
 d=Object.freeze({...base,id:base.id+'-form-II',fullComboRecovery:.4,stages:Object.freeze(indices.map(i=>{const st=base.stages[i];return Object.freeze({...st,range:st.range!+(hunter?.25:.2),attackReadyAt:(st.attackReadyAt as number)+.18,moveReadyAt:st.moveReadyAt+.18});}))});derived.set(base,d);return d;
}
