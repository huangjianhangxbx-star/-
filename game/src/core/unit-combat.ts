import type {Unit} from './types';
export function configureCombat(u:Unit){
    const gun=['hunter','ranger','ranged'].includes(u.role);
    const cls=gun?'gun':'blade';
    u.compatibleClasses=[cls];u.capacity=u.role==='ranger'?7:10;
    u.defense={subtype:u.role==='guard'?'impact':u.role==='heavy'?'pierce':'slash',flat:u.role==='guard'||u.role==='heavy'?8:3};
    u.dodge=u.role==='ranger'?.12:u.role==='hunter'?.05:0;
    if(u.role==='ranger')for(const w of u.weapons)w.name=w.shadow?'影·长弓':'巡夜长弓';
    u.mental='steady';u.mentalTime=0;
    u.autoSkill=u.role==='guard';u.sniperMode=false;u.poisonMeter=0;
    for(const w of u.weapons){w.class=cls;w.damageKind='physical';w.subtype=gun||u.role==='guard'?'pierce':'slash';w.weight=w.shadow?1:gun?5:4;if(u.team==='ally')w.profession=u.role as 'hunter'|'guard'|'ranger';}
}
