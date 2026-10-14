import {expect,test} from 'vitest';
test('wall microsteps settle to idle without restarting walking; real slide resumes',async()=>{
 const m=await import('../src/view/scene2d/actor-motion').catch(()=>undefined);expect(m).toBeDefined();const motion=new m!.ActorMotion({x:10,y:9});
 expect(motion.sample({x:10,y:8.7},.016)).toBe(true);for(let i=0;i<20;i++)motion.sample({x:10,y:8.7},.016);
 for(let i=0;i<50;i++)expect(motion.sample({x:10,y:8.7-i*.0001},.016)).toBe(false);
 expect(motion.sample({x:10.05,y:8.695},.016)).toBe(true);for(let i=1;i<10;i++)expect(motion.sample({x:10.05+i*.02,y:8.695},.016)).toBe(true);
});
