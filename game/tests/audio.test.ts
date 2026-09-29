import {expect,it} from 'vitest';
import * as audio from '../src/audio';
import {createGame} from '../src/core/engine';
it('maps effects by exact source identity, including different roles sharing a tile',()=>{
 const s=createGame();const fx={id:1,kind:'shot' as const,from:{x:2,y:4},to:{x:3,y:4},color:'#fff',remaining:.2,sourceId:'hunter',action:'attack' as const};
 expect('effectSound' in audio).toBe(true);
 const choose=(audio as any).effectSound;
 expect(choose(s,fx)).toBe('shot');expect(choose(s,{...fx,sourceId:'guard'})).toBe('knife');expect(choose(s,{...fx,sourceId:'ranger'})).toBe('bow');expect(choose(s,{...fx,sourceId:'fiorre'})).toBe('fiorre');expect(choose(s,{...fx,kind:'heal',sourceId:'fiorre'})).toBe('rescue');
});
