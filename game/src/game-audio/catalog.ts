import type {AudioBus} from './policy';
export type AudioRecipe={bus:AudioBus;priority:number;gain:number;duration:number;sample?:string;frequency?:number;loop?:boolean;maxPerSource?:number};
/** Local original recordings are served only by the allowlisted dev/offline provider. */
export const AUDIO_CATALOG:Readonly<Record<string,AudioRecipe>>={
 'battle.deploy':{bus:'player',priority:7,gain:.25,duration:.22,frequency:440},
 'battle.card':{bus:'ui',priority:5,gain:.16,duration:.12,frequency:780},
 'battle.cancel':{bus:'ui',priority:4,gain:.12,duration:.12,frequency:300},
 'battle.rescue':{bus:'player',priority:8,gain:.24,duration:.42,frequency:550},
 'battle.shot':{bus:'player',priority:5,gain:.22,duration:.18,frequency:120},
 'battle.melee':{bus:'player',priority:5,gain:.2,duration:.13,frequency:220},
 'battle.hurt':{bus:'player',priority:8,gain:.22,duration:.21,frequency:135},
 'battle.crystal':{bus:'interaction',priority:8,gain:.25,duration:.32,frequency:110},
 'battle.victory':{bus:'ui',priority:9,gain:.22,duration:.7,frequency:587},
 'battle.defeat':{bus:'ui',priority:9,gain:.2,duration:.7,frequency:247},
 'battle.skill':{bus:'player',priority:6,gain:.23,duration:.23,frequency:480},
 'battle.hunterShot':{bus:'player',priority:7,gain:.23,duration:.26,frequency:170},
 'battle.bow':{bus:'player',priority:5,gain:.19,duration:.21,frequency:610},
 'battle.knife':{bus:'player',priority:5,gain:.18,duration:.16,frequency:310},
 'battle.enemy':{bus:'enemy',priority:5,gain:.18,duration:.21,frequency:95},
 'battle.venom':{bus:'enemy',priority:8,gain:.24,duration:.38,frequency:82},
 'battle.wave':{bus:'ui',priority:7,gain:.18,duration:.48,frequency:330},
 'battle.ready':{bus:'ui',priority:6,gain:.15,duration:.16,frequency:840},
 'battle.loot':{bus:'interaction',priority:4,gain:.11,duration:.09,frequency:940},
 'battle.fiorre':{bus:'companion',priority:5,gain:.18,duration:.18,frequency:520},
 'reference.release':{bus:'player',priority:5,gain:.14,duration:.4,sample:'release',frequency:270},
 'reference.hit':{bus:'player',priority:7,gain:.22,duration:.4,sample:'hit',frequency:140},
 'reference.hurt':{bus:'player',priority:8,gain:.22,duration:.4,sample:'hurt',frequency:105},
 'reference.enemy.release':{bus:'enemy',priority:6,gain:.14,duration:.4,sample:'release',frequency:270},
 'reference.enemy.hit':{bus:'enemy',priority:7,gain:.18,duration:.4,sample:'hit',frequency:140},
 'reference.enemy.hurt':{bus:'enemy',priority:5,gain:.16,duration:.4,sample:'hurt',frequency:105},
 'reference.block':{bus:'player',priority:7,gain:.18,duration:.4,sample:'hit',frequency:180},
 'reference.dodge':{bus:'player',priority:6,gain:.15,duration:.4,sample:'release',frequency:470},
 'reference.return':{bus:'player',priority:6,gain:.18,duration:.4,sample:'hit',frequency:340},
 'reference.yellow.fire':{bus:'companion',priority:6,gain:.2,duration:.5,sample:'cannon-fire',frequency:110},
 'reference.yellow.gatling':{bus:'companion',priority:6,gain:.16,duration:.5,sample:'gatling-fire',frequency:155},
 'reference.yellow.hit':{bus:'companion',priority:7,gain:.2,duration:.5,sample:'cannon-hit',frequency:88},
 'reference.yellow.reload':{bus:'companion',priority:5,gain:.16,duration:.5,sample:'reload-complete',frequency:560},
 'ui.open':{bus:'ui',priority:4,gain:.13,duration:.11,frequency:640},
 'ui.close':{bus:'ui',priority:4,gain:.1,duration:.1,frequency:370},
 'ui.confirm':{bus:'ui',priority:5,gain:.12,duration:.14,frequency:780},
 'ui.reject':{bus:'ui',priority:5,gain:.1,duration:.12,frequency:230},
 'dialogue.line':{bus:'voice',priority:5,gain:.08,duration:.07,frequency:520},
 'world.ambience':{bus:'ambience',priority:2,gain:.045,duration:9.6,frequency:75,loop:true},
 'world.water':{bus:'ambience',priority:2,gain:.035,duration:9.6,frequency:130,loop:true},
};

export function validateCatalog(catalog:Readonly<Record<string,AudioRecipe>>):string[]{
 const errors:string[]=[];for(const [id,cue] of Object.entries(catalog)){
  if(!id||!Number.isFinite(cue.gain)||cue.gain<0||cue.gain>1||!Number.isFinite(cue.duration)||cue.duration<=0)errors.push(id+': invalid level or duration');
  if(!cue.sample&&!cue.frequency)errors.push(id+': no playable source');
  if(cue.loop&&cue.duration<=0)errors.push(id+': loop without duration');
 }return errors;
}
