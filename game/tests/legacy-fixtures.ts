import {createGame} from './economy-fixtures';
import {createLegacyGuard,command} from '../src/core/engine';
/** Old rule regressions explicitly choose retained healer and guard content. */
export function legacyGame(mode?:string){
 const s=createGame(mode);s.units[2]=createLegacyGuard();command(s,{type:'weapon',id:'fiorre',index:0});return s;
}
