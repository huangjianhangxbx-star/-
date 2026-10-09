import {describe,it,expect} from 'vitest';
import {yellowBasicPresentation} from '../src/view/yellow-basic-presentation';
describe('Yellow A3 presentation-only recovery',()=>{
 it('keeps original strikes and compresses only the post-End visual tail',()=>{
  expect(yellowBasicPresentation('a3',.1667)).toEqual({pose:'a3',time:.1667});
  expect(yellowBasicPresentation('a3',.4)).toEqual({pose:'a3',time:.4});
  const mid=yellowBasicPresentation('a3',.52);expect(mid.pose).toBe('a3');expect(mid.time).toBeCloseTo(.83335,5);
  expect(yellowBasicPresentation('a3',.64)).toEqual({pose:'_stand',time:0});
  expect(yellowBasicPresentation('a3',1.1).time).toBeCloseTo(.46,6);
 });
 it('does not retime A1 A2 or other original animations',()=>{
  for(const pose of ['a1','a2','r1','q1','_move'])expect(yellowBasicPresentation(pose,.85)).toEqual({pose,time:.85});
 });
});
