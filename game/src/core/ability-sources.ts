/** Runtime definitions are deliberately separate from the research catalog.
 * Adding a catalog row does not create an executable consumer.
 */
export type TrialProfession='blue'|'yellow';
export type TrialEffect='chisel'|'rush-frost'|'rocket-launch'|'frost-haste'|'frost-capacity'|'skill-modifier'|'combo-prefix'|'unresolved';
export type SkillModifier=Readonly<{root:string;condition?:'last-round';damageRatio?:number;passesTargets?:boolean;damageAdd?:number;damagePerFrost?:number;cooldownAdd?:number;knockRatio?:number;stunSeconds?:number;instantReload?:boolean;ammoCount?:number;also?:readonly SkillModifier[]}>;
export type SourceDefinition=Readonly<{id:string;nativeId:string;profession:TrialProfession;effect:TrialEffect;origin:'rune'|'active-branch';phase:number;requires?:'active'|'rush'|'rocket'|'precision';damage?:number;upgraded?:boolean;upgradesTo?:string;exclusivePoint?:string;comboPrefix?:'rapid'|'rapid-plus';hastePerFrost?:number;frostCap?:number;frostRecovery?:number;skillModifier?:SkillModifier}>;
export const SOURCE_DEFINITIONS:Readonly<Record<string,SourceDefinition>>=Object.freeze(Object.fromEntries([
 {id:'chisel',nativeId:'凿冰',profession:'blue',effect:'chisel',origin:'rune',phase:0,damage:25,upgradesTo:'chisel-plus'},
 {id:'chisel-plus',nativeId:'凿冰+',profession:'blue',effect:'chisel',origin:'rune',phase:1,damage:40,upgraded:true},
 {id:'rush-frost',nativeId:'破阵猛冲1',profession:'blue',effect:'rush-frost',origin:'active-branch',phase:0,requires:'rush'},
 {id:'rush-force',nativeId:'破阵猛冲2',profession:'blue',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'rush',skillModifier:Object.freeze({root:'rush',damageAdd:30,knockRatio:.8})},
 {id:'rush-frost-power',nativeId:'破阵猛冲3',profession:'blue',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'rush',skillModifier:Object.freeze({root:'rush',damagePerFrost:15})},
 {id:'rush-cooldown',nativeId:'破阵猛冲4',profession:'blue',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'rush',skillModifier:Object.freeze({root:'rush',cooldownAdd:-2})},
 {id:'rush-through',nativeId:'破阵猛冲6',profession:'blue',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'rush',skillModifier:Object.freeze({root:'rush',passesTargets:true})},
 {id:'rocket-stun',nativeId:'火箭弹射1',profession:'yellow',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'rocket',skillModifier:Object.freeze({root:'rocket-land',stunSeconds:1.5,also:Object.freeze([Object.freeze({root:'rocket-launch',stunSeconds:1.5})])})},
 {id:'rocket-power',nativeId:'火箭弹射2',profession:'yellow',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'rocket',skillModifier:Object.freeze({root:'rocket-land',damageAdd:35,also:Object.freeze([Object.freeze({root:'rocket-launch',damageAdd:24})])})},
 {id:'rocket-launch',nativeId:'火箭弹射3',profession:'yellow',effect:'rocket-launch',origin:'active-branch',phase:0,requires:'rocket'},
 {id:'precision-cooldown',nativeId:'精准装填1',profession:'yellow',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'precision',skillModifier:Object.freeze({root:'precision',cooldownAdd:-4})},
 {id:'precision-instant',nativeId:'精准装填3',profession:'yellow',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'precision',skillModifier:Object.freeze({root:'precision',instantReload:true})},
 {id:'precision-more',nativeId:'精准装填5',profession:'yellow',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'precision',skillModifier:Object.freeze({root:'precision',ammoCount:6})},
 {id:'last-round',nativeId:'最后一击',profession:'yellow',effect:'skill-modifier',origin:'rune',phase:0,exclusivePoint:'yellow-last-round',upgradesTo:'last-round-plus',skillModifier:Object.freeze({root:'ranged-shot',condition:'last-round',damageRatio:1.25})},
 {id:'last-round-plus',nativeId:'最后一击+',profession:'yellow',effect:'skill-modifier',origin:'rune',phase:1,exclusivePoint:'yellow-last-round',upgraded:true,skillModifier:Object.freeze({root:'ranged-shot',condition:'last-round',damageRatio:1.85})},
 {id:'rapid-combo',nativeId:'迅猛连击',profession:'blue',effect:'combo-prefix',origin:'rune',phase:0,exclusivePoint:'blue-prefix',upgradesTo:'rapid-combo-plus',comboPrefix:'rapid'},
 {id:'rapid-combo-plus',nativeId:'迅猛连击+',profession:'blue',effect:'combo-prefix',origin:'rune',phase:1,exclusivePoint:'blue-prefix',upgraded:true,comboPrefix:'rapid-plus'},
 {id:'frost-haste',nativeId:'凌凌如风',profession:'blue',effect:'frost-haste',origin:'rune',phase:0,requires:'active',upgradesTo:'frost-haste-plus',exclusivePoint:'blue-frost-haste',hastePerFrost:.08},
 {id:'frost-haste-plus',nativeId:'凌凌如风+',profession:'blue',effect:'frost-haste',origin:'rune',phase:1,requires:'active',upgraded:true,exclusivePoint:'blue-frost-haste',hastePerFrost:.12},
 {id:'frost-aftershock',nativeId:'冰霜余震',profession:'blue',effect:'unresolved',origin:'rune',phase:0,requires:'active'},
 {id:'bastion',nativeId:'壁垒',profession:'blue',effect:'frost-capacity',origin:'rune',phase:0,exclusivePoint:'blue-bastion',upgradesTo:'bastion-plus',frostCap:2,frostRecovery:.33},
 {id:'bastion-plus',nativeId:'壁垒+',profession:'blue',effect:'frost-capacity',origin:'rune',phase:1,exclusivePoint:'blue-bastion',upgraded:true,frostCap:3,frostRecovery:.66},
].map(x=>[x.id,Object.freeze(x as SourceDefinition)])));
export type EffectSource={id:string;definitionId:string;effect:TrialEffect;priority:number;phase:number;upgraded:boolean};
export type SourceStatus='active'|'dormant'|'superseded'|'imported_unresolved';
export function evaluateSources(sources:readonly EffectSource[],profession:TrialProfession,roots:ReadonlySet<string>){
 const chosen=new Set<string>();
 return [...sources].sort((a,b)=>b.priority-a.priority||b.phase-a.phase||a.id.localeCompare(b.id)).map(s=>{
  const def=SOURCE_DEFINITIONS[s.definitionId];let status:SourceStatus;
  if(!def||def.profession!==profession||def.effect==='unresolved')status='imported_unresolved';
  else if(def.requires&&(def.requires==='active'?!roots.size:!roots.has(def.requires)))status='dormant';
  else if(chosen.has(def.exclusivePoint??(def.effect==='chisel'?'basic-stage-3':def.id)))status='superseded';
  else {chosen.add(def.exclusivePoint??(def.effect==='chisel'?'basic-stage-3':def.id));status='active';}
  return {...s,status,definition:def};
 });
}
