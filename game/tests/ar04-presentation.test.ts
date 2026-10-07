import {test,expect} from 'vitest';
import {basicPresentation} from '../src/view/basic-presentation';
test('presentation translates semantic ids without letting unknown ids select assets',()=>{
 expect(basicPresentation('hunter-shot-01')).toBe('attack_01');
 expect(basicPresentation('hunter-shot-02')).toBe('attack_02');
 expect(basicPresentation('skill_02')).toBeUndefined();
});
