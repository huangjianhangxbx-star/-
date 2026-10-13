/** Runtime definitions are deliberately separate from the research catalog.
 * Adding a catalog row does not create an executable consumer.
 */
export type TrialProfession='blue'|'yellow';
export type TrialEffect='chisel'|'rush-frost'|'rocket-launch'|'frost-haste'|'unresolved';
export type SourceDefinition=Readonly<{id:string;nativeId:string;profession:TrialProfession;effect:TrialEffect;origin:'rune'|'active-branch';phase:number;requires?:'active'|'rush'|'rocket';damage?:number;upgraded?:boolean}>;
export const SOURCE_DEFINITIONS:Readonly<Record<string,SourceDefinition>>=Object.freeze(Object.fromEntries([
 {id:'chisel',nativeId:'凿冰',profession:'blue',effect:'chisel',origin:'rune',phase:0,damage:25},
 {id:'chisel-plus',nativeId:'凿冰+',profession:'blue',effect:'chisel',origin:'rune',phase:1,damage:40,upgraded:true},
 {id:'rush-frost',nativeId:'破阵猛冲1',profession:'blue',effect:'rush-frost',origin:'active-branch',phase:0,requires:'rush'},
 {id:'rocket-launch',nativeId:'火箭弹射3',profession:'yellow',effect:'rocket-launch',origin:'active-branch',phase:0,requires:'rocket'},
 {id:'frost-haste',nativeId:'凌凌如风',profession:'blue',effect:'frost-haste',origin:'rune',phase:0,requires:'active'},
 {id:'frost-aftershock',nativeId:'冰霜余震',profession:'blue',effect:'unresolved',origin:'rune',phase:0,requires:'active'},
].map(x=>[x.id,Object.freeze(x as SourceDefinition)])));
export type EffectSource={id:string;definitionId:string;effect:TrialEffect;priority:number;phase:number;upgraded:boolean};
export type SourceStatus='active'|'dormant'|'superseded'|'imported_unresolved';
export function evaluateSources(sources:readonly EffectSource[],profession:TrialProfession,roots:ReadonlySet<string>){
 const chosen=new Set<TrialEffect>();
 return [...sources].sort((a,b)=>b.priority-a.priority||b.phase-a.phase||a.id.localeCompare(b.id)).map(s=>{
  const def=SOURCE_DEFINITIONS[s.definitionId];let status:SourceStatus;
  if(!def||def.profession!==profession||def.effect==='unresolved')status='imported_unresolved';
  else if(def.requires&&(def.requires==='active'?!roots.size:!roots.has(def.requires)))status='dormant';
  else if(chosen.has(def.effect))status='superseded';
  else {chosen.add(def.effect);status='active';}
  return {...s,status,definition:def};
 });
}
