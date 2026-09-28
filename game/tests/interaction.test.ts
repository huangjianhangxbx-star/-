import {describe,it,expect} from 'vitest';
import {Interaction,simulationDelta} from '../src/interaction';
describe('direct movement without facing selection',()=>{
 it('click destination submits move immediately',()=>{const i=new Interaction();i.select('hunter');expect(i.destination({x:4,y:4},false)).toEqual({type:'move',id:'hunter',to:{x:4,y:4}});expect(i.slow).toBe(false);});
 it('quick drag submits the same movement',()=>{const i=new Interaction();i.select('hunter');expect(i.destination({x:4,y:4},true)).toEqual({type:'move',id:'hunter',to:{x:4,y:4}});});
 it('deployment submits immediately with default facing',()=>{const i=new Interaction();i.deploy('guard');expect(i.destination({x:3,y:4},false)).toEqual({type:'deploy',id:'guard',to:{x:3,y:4},facing:'east'});expect(i.slow).toBe(false);});
 it('cancel selection releases slow time',()=>{const i=new Interaction();i.deploy('guard');i.cancel();expect(i.selectedId).toBeNull();expect(i.slow).toBe(false);});
 it('pause and hidden page override time multiplier',()=>{expect(simulationDelta(1,true,true,true,2)).toBe(0);expect(simulationDelta(.05,false,false,true,2)).toBeCloseTo(.005);});
 it('large gaps are clamped',()=>{expect(simulationDelta(10,false,false,false,1)).toBe(.05);});
});
