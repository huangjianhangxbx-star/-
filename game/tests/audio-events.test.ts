import {expect,it} from 'vitest';
import {createGame} from './economy-fixtures';
import {hunterNote} from '../src/core/hunter-state';
import {audioActionsSince} from '../src/core/audio-events';

it('keeps accepted audio actions independent of disposable combat traces',()=>{
 const state=createGame(),hunter=state.units.find(u=>u.id==='hunter')!;
 hunterNote(state,hunter,'release',undefined,44,'release');
 hunter.hunterCombat!.trace.length=0;
 expect(audioActionsSince(state,0)).toMatchObject([{sourceId:'hunter',cue:'release',position:hunter.pos}]);
});
